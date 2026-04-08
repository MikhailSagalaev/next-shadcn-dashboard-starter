/**
 * @file: insales-service.ts
 * @description: Сервис для обработки InSales webhooks и API запросов
 * @project: SaaS Bonus System
 * @dependencies: Prisma, UserService
 * @created: 2026-03-02
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UserService } from '@/lib/services/user.service';
import type {
  InSalesOrder,
  InSalesClient,
  ProcessOrderResult,
  ProcessClientResult,
  GetBalanceRequest,
  GetBalanceResponse,
  ApplyBonusesRequest,
  ApplyBonusesResponse
} from './types';
import { InSalesApiClient } from './insales-api-client';

export class InSalesService {
  constructor() {}

  /**
   * Обработка создания заказа
   */
  async handleOrderCreate(
    projectId: string,
    order: InSalesOrder
  ): Promise<ProcessOrderResult> {
    try {
      logger.info(
        'Processing InSales order',
        {
          projectId,
          orderId: order.id,
          orderNumber: order.number,
          totalPrice: order.total_price
        },
        'insales-service'
      );

      // Проверяем статус оплаты
      if (
        order.payment_status === 'refunded' ||
        order.payment_status === 'cancelled' ||
        order.fulfillment_status === 'cancelled'
      ) {
        logger.info(
          'Order is cancelled or refunded, processing cancellation',
          {
            orderId: order.id,
            paymentStatus: order.payment_status,
            fulfillmentStatus: order.fulfillment_status
          },
          'insales-service'
        );
        return this.handleOrderCancellation(projectId, order);
      }

      if (order.payment_status !== 'paid') {
        logger.info(
          'Order not paid yet, skipping bonus award',
          { orderId: order.id, paymentStatus: order.payment_status },
          'insales-service'
        );
        return {
          success: true,
          orderId: order.number
        };
      }

      // Проверяем, не обработан ли уже этот заказ (используем уникальный внешний ID)
      const externalId = `insales_order_${order.id}`;
      const existingTransaction = await db.transaction.findUnique({
        where: { externalId }
      });

      if (existingTransaction) {
        logger.info(
          'Order already processed, skipping',
          {
            orderId: order.id,
            orderNumber: order.number,
            transactionId: existingTransaction.id
          },
          'insales-service'
        );
        return {
          success: true,
          orderId: order.number,
          bonusAwarded: 0,
          message: 'Order already processed'
        };
      }

      // Находим или создаем пользователя
      const identifier = order.client.email || order.client.phone;
      if (!identifier) {
        throw new Error('No email or phone in order client data');
      }

      let user = await UserService.findUserByContact(projectId, identifier);

      if (!user) {
        // Создаем нового пользователя
        user = await UserService.createUser({
          projectId,
          email: order.client.email,
          phone: order.client.phone,
          firstName: order.client.name,
          lastName: order.client.surname
        });

        logger.info(
          'Created new user from InSales order',
          { userId: user.id, email: user.email },
          'insales-service'
        );
      }

      // Получаем настройки проекта и интеграции
      const [project, integration] = await Promise.all([
        db.project.findUnique({
          where: { id: projectId },
          include: {
            bonusLevels: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          }
        }),
        db.inSalesIntegration.findUnique({
          where: { projectId }
        })
      ]);

      if (!project) {
        throw new Error('Project not found');
      }

      if (!integration) {
        throw new Error('InSales integration not found');
      }

      // Рассчитываем сумму для начисления бонусов
      const orderTotal = parseFloat(order.total_price);

      // Проверяем, были ли использованы бонусы
      // Вариант 1: Из custom_fields (если InSales передает)
      // Вариант 2: Из discount_amount если промокод начинается с BONUS_
      let bonusSpent = 0;

      // Пытаемся получить из custom_fields
      if (order.custom_fields && typeof order.custom_fields === 'object') {
        const customFields = order.custom_fields as Record<string, any>;
        if (customFields.bonus_spent) {
          bonusSpent = parseFloat(String(customFields.bonus_spent)) || 0;
        }
      }

      // Если не нашли в custom_fields, проверяем discount_code
      if (bonusSpent === 0 && order.discount_code) {
        const discountCode = String(order.discount_code);
        // Наши промокоды имеют формат BONUS_{amount}_{random}
        if (discountCode.startsWith('BONUS_')) {
          const match = discountCode.match(/^BONUS_(\d+)_/);
          if (match) {
            bonusSpent = parseFloat(match[1]) || 0;
          }
        }
      }

      let amountForBonus = orderTotal;

      // Применяем логику BonusBehavior
      if (bonusSpent > 0) {
        if (project.bonusBehavior === 'SPEND_AND_EARN') {
          // Начисляем на остаток
          amountForBonus = orderTotal - bonusSpent;
        } else if (project.bonusBehavior === 'SPEND_ONLY') {
          // Не начисляем бонусы
          amountForBonus = 0;
        }
      }

      if (amountForBonus <= 0) {
        logger.info(
          'No bonus to award (SPEND_ONLY mode or negative amount)',
          { orderId: order.id, bonusSpent },
          'insales-service'
        );
        return {
          success: true,
          userId: user.id,
          orderId: order.number,
          bonusAwarded: 0
        };
      }

      // Определяем процент начисления
      let bonusPercent = 0;

      if (integration.useProjectSettings) {
        // Используем настройки проекта
        bonusPercent = project.bonusPercentage.toNumber();

        // Проверяем уровни лояльности
        if (project.bonusLevels.length > 0) {
          const userTotalPurchases = Number(user.totalPurchases);

          for (const level of project.bonusLevels) {
            const minAmount = Number(level.minAmount);
            const maxAmount = level.maxAmount
              ? Number(level.maxAmount)
              : undefined;

            if (
              userTotalPurchases >= minAmount &&
              (!maxAmount || userTotalPurchases < maxAmount)
            ) {
              bonusPercent = level.bonusPercent;
              break;
            }
          }
        }
      } else {
        // Используем специфичные настройки интеграции
        bonusPercent = integration.bonusPercent;
      }

      // Начисляем бонусы
      const bonusAmount = Math.floor((amountForBonus * bonusPercent) / 100);

      if (bonusAmount > 0) {
        // Создаем бонус
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + project.bonusExpiryDays);

        const externalId = `insales_order_${order.id}`;
        await db.bonus.create({
          data: {
            userId: user.id,
            amount: bonusAmount,
            type: 'PURCHASE',
            expiresAt,
            isUsed: false,
            externalId
          }
        });

        // Создаем транзакцию
        await db.transaction.create({
          data: {
            userId: user.id,
            type: 'EARN',
            amount: bonusAmount,
            description: `Покупка #${order.number}`,
            externalId,
            metadata: {
              orderId: order.id,
              orderNumber: order.number,
              orderTotal: orderTotal,
              bonusPercent: bonusPercent
            }
          }
        });

        logger.info(
          'Bonus awarded for InSales order',
          {
            userId: user.id,
            orderId: order.number,
            bonusAmount,
            bonusPercent
          },
          'insales-service'
        );
      }

      // Обновляем общую сумму покупок пользователя
      await db.user.update({
        where: { id: user.id },
        data: {
          totalPurchases: {
            increment: orderTotal
          }
        }
      });

      // Обновляем статистику интеграции
      await db.inSalesIntegration.update({
        where: { projectId },
        data: {
          totalOrders: { increment: 1 },
          totalBonusAwarded: { increment: bonusAmount },
          lastWebhookAt: new Date()
        }
      });

      // Синхронизируем баланс в InSales API (в фоне, чтобы не блокировать вебхук)
      this.syncClientBalanceToInSales(projectId, user.id).catch((err) => {
        logger.error(
          'Failed to async sync balance',
          { error: err.message },
          'insales-service'
        );
      });

      return {
        success: true,
        userId: user.id,
        orderId: order.number,
        bonusAwarded: bonusAmount,
        bonusSpent: bonusSpent
      };
    } catch (error) {
      logger.error(
        'Error processing InSales order',
        {
          projectId,
          orderId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обработка создания клиента
   */
  async handleClientCreate(
    projectId: string,
    client: InSalesClient
  ): Promise<ProcessClientResult> {
    try {
      logger.info(
        'Processing InSales client creation',
        {
          projectId,
          clientId: client.id,
          email: client.email
        },
        'insales-service'
      );

      // Проверяем, существует ли уже пользователь
      const identifier = client.email || client.phone;
      if (!identifier) {
        throw new Error('No email or phone in client data');
      }

      const existingUser = await UserService.findUserByContact(
        projectId,
        identifier
      );

      if (existingUser) {
        logger.info(
          'User already exists, skipping creation',
          { userId: existingUser.id },
          'insales-service'
        );
        return {
          success: true,
          userId: existingUser.id
        };
      }

      // Создаем нового пользователя
      // UserService автоматически начислит приветственные бонусы
      const user = await UserService.createUser({
        projectId,
        email: client.email,
        phone: client.phone,
        firstName: client.name,
        lastName: client.surname
      });

      logger.info(
        'Created new user from InSales client',
        { userId: user.id, email: user.email },
        'insales-service'
      );

      // Получаем информацию о начисленных приветственных бонусах
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: {
          referralProgram: true
        }
      });

      let welcomeBonus = 0;
      if (project) {
        if (
          project.referralProgram?.isActive &&
          project.referralProgram.welcomeRewardType === 'BONUS'
        ) {
          welcomeBonus = Number(project.referralProgram.welcomeBonus);
        } else if (project.welcomeRewardType === 'BONUS') {
          welcomeBonus = Number(project.welcomeBonus);
        }
      }

      return {
        success: true,
        userId: user.id,
        welcomeBonusAwarded: welcomeBonus
      };
    } catch (error) {
      logger.error(
        'Error processing InSales client',
        {
          projectId,
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Получить баланс бонусов пользователя
   */
  async getBonusBalance(
    projectId: string,
    request: GetBalanceRequest
  ): Promise<GetBalanceResponse> {
    try {
      const identifier = request.email || request.phone;
      if (!identifier) {
        return {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'Email or phone is required'
        };
      }

      const user = await UserService.findUserByContact(projectId, identifier);

      if (!user) {
        return {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'User not found'
        };
      }

      // Получаем баланс бонусов
      const bonuses = await db.bonus.findMany({
        where: {
          userId: user.id,
          isUsed: false,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      const balance = bonuses.reduce(
        (sum, bonus) => sum + Number(bonus.amount),
        0
      );

      return {
        success: true,
        balance,
        currency: 'RUB',
        user: {
          id: user.id,
          email: user.email || undefined,
          phone: user.phone || undefined,
          level: user.currentLevel
        }
      };
    } catch (error) {
      logger.error(
        'Error getting bonus balance',
        {
          projectId,
          request,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        balance: 0,
        currency: 'RUB',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Применить бонусы к заказу
   */
  async applyBonuses(
    projectId: string,
    request: ApplyBonusesRequest
  ): Promise<ApplyBonusesResponse> {
    try {
      const identifier = request.email || request.phone;
      if (!identifier) {
        return {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Email or phone is required'
        };
      }

      const user = await UserService.findUserByContact(projectId, identifier);

      if (!user) {
        return {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'User not found'
        };
      }

      // Проверяем баланс
      const bonuses = await db.bonus.findMany({
        where: {
          userId: user.id,
          isUsed: false,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      const currentBalance = bonuses.reduce(
        (sum, bonus) => sum + Number(bonus.amount),
        0
      );

      if (currentBalance < request.bonusAmount) {
        return {
          success: false,
          applied: 0,
          newBalance: currentBalance,
          discount: 0,
          error: 'Insufficient bonus balance'
        };
      }

      // Получаем настройки проекта и интеграции
      const [project, integration] = await Promise.all([
        db.project.findUnique({
          where: { id: projectId },
          include: {
            bonusLevels: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          }
        }),
        db.inSalesIntegration.findUnique({
          where: { projectId }
        })
      ]);

      if (!project || !integration) {
        return {
          success: false,
          applied: 0,
          newBalance: currentBalance,
          discount: 0,
          error: 'Integration or project not configured'
        };
      }

      // Проверяем максимальный процент оплаты бонусами
      let maxBonusPercent = integration.maxBonusSpend;

      if (integration.useProjectSettings) {
        // Если проект использует уровни, берем из уровня пользователя
        if (project.bonusLevels.length > 0) {
          const userTotalPurchases = Number(user.totalPurchases);
          // По умолчанию берем первый уровень (или 100 если нет уровней вообще)
          maxBonusPercent = project.bonusLevels[0].paymentPercent;

          for (const level of project.bonusLevels) {
            const minAmount = Number(level.minAmount);
            const maxAmount = level.maxAmount
              ? Number(level.maxAmount)
              : undefined;

            if (
              userTotalPurchases >= minAmount &&
              (!maxAmount || userTotalPurchases < maxAmount)
            ) {
              maxBonusPercent = level.paymentPercent;
              break;
            }
          }
        } else {
          // Если уровней нет, ищем глобальный лимит или используем 100%
          maxBonusPercent = 100;
        }
      }

      const maxBonusAmount = (request.orderTotal * maxBonusPercent) / 100;

      const bonusToApply = Math.min(
        request.bonusAmount,
        maxBonusAmount,
        currentBalance
      );

      if (bonusToApply <= 0) {
        return {
          success: false,
          applied: 0,
          newBalance: currentBalance,
          discount: 0,
          error: 'Cannot apply bonuses to this order'
        };
      }

      // Списываем бонусы (FIFO - сначала самые старые)
      let remainingToSpend = bonusToApply;
      const sortedBonuses = bonuses.sort(
        (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()
      );

      for (const bonus of sortedBonuses) {
        if (remainingToSpend <= 0) break;

        const bonusAmount = Number(bonus.amount);
        const amountToDeduct = Math.min(bonusAmount, remainingToSpend);

        if (amountToDeduct >= bonusAmount) {
          // Полностью используем бонус
          await db.bonus.update({
            where: { id: bonus.id },
            data: { isUsed: true }
          });
        } else {
          // Частично используем бонус
          await db.bonus.update({
            where: { id: bonus.id },
            data: {
              amount: {
                decrement: amountToDeduct
              }
            }
          });
        }

        remainingToSpend -= amountToDeduct;
      }

      // Создаем транзакцию списания
      await db.transaction.create({
        data: {
          userId: user.id,
          type: 'SPEND',
          amount: bonusToApply,
          description: `Оплата заказа #${request.orderId}`,
          metadata: {
            orderId: request.orderId,
            orderTotal: request.orderTotal
          }
        }
      });

      const newBalance = currentBalance - bonusToApply;

      // Обновляем статистику
      await db.inSalesIntegration.update({
        where: { projectId },
        data: {
          totalBonusSpent: { increment: bonusToApply }
        }
      });

      logger.info(
        'Bonuses applied to InSales order',
        {
          userId: user.id,
          orderId: request.orderId,
          bonusApplied: bonusToApply,
          newBalance
        },
        'insales-service'
      );

      // Синхронизируем баланс в InSales API
      this.syncClientBalanceToInSales(projectId, user.id).catch((err) => {
        logger.error(
          'Failed to async sync balance',
          { error: err.message },
          'insales-service'
        );
      });

      return {
        success: true,
        applied: bonusToApply,
        newBalance,
        discount: bonusToApply
      };
    } catch (error) {
      logger.error(
        'Error applying bonuses',
        {
          projectId,
          request,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        applied: 0,
        newBalance: 0,
        discount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обработка обновления клиента
   */
  async handleClientUpdate(
    projectId: string,
    client: InSalesClient
  ): Promise<ProcessClientResult> {
    try {
      logger.info(
        'Processing InSales client update',
        {
          projectId,
          clientId: client.id,
          email: client.email,
          phone: client.phone
        },
        'insales-service'
      );

      const identifier = client.email || client.phone;
      if (!identifier) {
        throw new Error('No email or phone in client data');
      }

      const existingUser = await UserService.findUserByContact(
        projectId,
        identifier
      );

      if (!existingUser) {
        // Если пользователя нет, создаем его
        return this.handleClientCreate(projectId, client);
      }

      // Обновляем данные пользователя
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          email: client.email || existingUser.email,
          phone: client.phone || existingUser.phone,
          firstName: client.name || existingUser.firstName,
          lastName: client.surname || existingUser.lastName
        }
      });

      return {
        success: true,
        userId: existingUser.id
      };
    } catch (error) {
      logger.error(
        'Error processing InSales client update',
        {
          projectId,
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обработка отмены/возврата заказа
   */
  async handleOrderCancellation(
    projectId: string,
    order: InSalesOrder
  ): Promise<ProcessOrderResult> {
    try {
      logger.info(
        'Processing InSales order cancellation',
        {
          projectId,
          orderId: order.id,
          orderNumber: order.number
        },
        'insales-service'
      );

      const identifier = order.client.email || order.client.phone;
      if (!identifier) {
        return { success: true, orderId: order.number };
      }

      const user = await UserService.findUserByContact(projectId, identifier);
      if (!user) {
        return { success: true, orderId: order.number };
      }

      // 1. Возврат списанных бонусов на баланс (если клиент ими платил)
      const spendTx = await db.transaction.findFirst({
        where: {
          userId: user.id,
          description: { contains: `Оплата заказа #${order.id}` },
          type: 'SPEND'
        }
      });

      if (spendTx) {
        // Перепроверяем, не возвращали ли мы их уже
        const alreadyRefunded = await db.transaction.findFirst({
          where: {
            userId: user.id,
            description: {
              contains: `Возврат за отмену заказа #${order.number}`
            },
            type: 'REFUND'
          }
        });

        if (!alreadyRefunded) {
          const bonusAmount = Number(spendTx.amount);
          const project = await db.project.findUnique({
            where: { id: projectId }
          });
          const expiresAt = new Date();
          expiresAt.setDate(
            expiresAt.getDate() + (project?.bonusExpiryDays || 30)
          );

          await db.bonus.create({
            data: {
              userId: user.id,
              amount: bonusAmount,
              type: 'MANUAL', // REFUND missing in BonusType Enum
              expiresAt,
              isUsed: false,
              description: `Возврат за отмену заказа #${order.number}`
            }
          });

          await db.transaction.create({
            data: {
              userId: user.id,
              type: 'REFUND',
              amount: bonusAmount,
              description: `Возврат за отмену заказа #${order.number}`,
              metadata: { orderId: order.id, refunded: true }
            }
          });

          await db.inSalesIntegration.update({
            where: { projectId },
            data: { totalBonusSpent: { decrement: bonusAmount } }
          });

          logger.info(
            'Refunded bonuses for cancelled order',
            { orderId: order.number, amount: bonusAmount },
            'insales-service'
          );
        }
      }

      // 2. Аннулирование начисленных бонусов за этот заказ (если мы их успели начислить и заказ не был оплачен полностью)
      const earnTx = await db.transaction.findFirst({
        where: {
          userId: user.id,
          description: { contains: `Покупка #${order.number}` },
          type: 'EARN'
        }
      });

      if (earnTx) {
        const alreadyCancelled = await db.transaction.findFirst({
          where: {
            userId: user.id,
            description: { contains: `Отмена покупки #${order.number}` },
            type: 'RETURN'
          }
        });

        if (!alreadyCancelled) {
          const bonusAmount = Number(earnTx.amount);

          const bonuses = await db.bonus.findMany({
            where: { userId: user.id, isUsed: false },
            orderBy: { expiresAt: 'asc' }
          });

          let remainingToCancel = bonusAmount;
          for (const bonus of bonuses) {
            if (remainingToCancel <= 0) break;
            const amt = Number(bonus.amount);
            const toDeduct = Math.min(amt, remainingToCancel);

            if (toDeduct >= amt) {
              await db.bonus.update({
                where: { id: bonus.id },
                data: { isUsed: true }
              });
            } else {
              await db.bonus.update({
                where: { id: bonus.id },
                data: { amount: { decrement: toDeduct } }
              });
            }
            remainingToCancel -= toDeduct;
          }

          await db.transaction.create({
            data: {
              userId: user.id,
              type: 'RETURN',
              amount: bonusAmount,
              description: `Отмена покупки #${order.number}`,
              metadata: { orderId: order.id, cancelledReward: true }
            }
          });

          const orderTotal = parseFloat(order.total_price);
          await db.user.update({
            where: { id: user.id },
            data: { totalPurchases: { decrement: orderTotal } }
          });

          await db.inSalesIntegration.update({
            where: { projectId },
            data: { totalBonusAwarded: { decrement: bonusAmount } }
          });

          logger.info(
            'Cancelled earned bonuses for order',
            { orderId: order.number, amount: bonusAmount },
            'insales-service'
          );
        }
      }

      // Синхронизируем баланс с InSales
      this.syncClientBalanceToInSales(projectId, user.id).catch((err) => {
        logger.error(
          'Failed to sync balance on cancellation',
          { error: err.message },
          'insales-service'
        );
      });

      return {
        success: true,
        orderId: order.number
      };
    } catch (error) {
      logger.error(
        'Error cancelling InSales order bonuses',
        {
          projectId,
          orderId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-service'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Синхронизация баланса клиента в InSales
   */
  async syncClientBalanceToInSales(
    projectId: string,
    userId: string
  ): Promise<void> {
    try {
      const integration = await db.inSalesIntegration.findUnique({
        where: { projectId }
      });

      if (!integration || !integration.isActive || !integration.apiKey) {
        return;
      }

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || (!user.email && !user.phone)) return;

      const apiClient = new InSalesApiClient({
        apiKey: integration.apiKey,
        apiPassword: integration.apiPassword,
        shopDomain: integration.shopDomain
      });

      // Ищем клиента в InSales
      const searchResponse = await apiClient.getClients({
        email: user.email || undefined,
        phone: user.phone || undefined
      });

      // Status codes for success are typically 200, 201 etc.
      // But we mapped error to !searchResponse.data when API request fails
      if (searchResponse.error || !searchResponse.data) {
        logger.warn(
          'Failed to find InSales client for balance sync',
          { userId, status: searchResponse.status },
          'insales-service'
        );
        return;
      }

      const clients = searchResponse.data;
      if (clients.length === 0) return;

      const insalesClient = clients[0];

      // Подсчитываем актуальный баланс
      const bonuses = await db.bonus.findMany({
        where: { userId, isUsed: false, expiresAt: { gt: new Date() } }
      });
      const balance = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

      logger.info(
        'Syncing balance to InSales',
        { clientId: insalesClient.id, balance },
        'insales-service'
      );

      // Здесь в InSales нужно обновлять определенное доп. поле (например, "Бонусы").
      // У нас нет жестко зашитого ID этого поля, но мы можем отправлять
      // его в fields_values_attributes, если пользователь заведет кастомное поле `bonus_balance`.
      // Пример:
      // await apiClient.updateClient(insalesClient.id, {
      //   fields_values_attributes: [{ id: 1234567, value: balance }] // где 1234567 - ID поля бонусов
      // });
    } catch (error) {
      logger.error(
        'Error syncing balance to InSales',
        { error },
        'insales-service'
      );
    }
  }
}
