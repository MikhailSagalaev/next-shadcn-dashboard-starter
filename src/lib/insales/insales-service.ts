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

      // Проверяем, не обработан ли уже этот заказ
      const existingTransaction = await db.transaction.findFirst({
        where: {
          user: {
            projectId
          },
          description: {
            contains: `Заказ #${order.number}`
          },
          type: 'EARN'
        }
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

      // Получаем настройки проекта
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: {
          bonusLevels: {
            where: { isActive: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      if (!project) {
        throw new Error('Project not found');
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
      let bonusPercent = project.bonusPercentage.toNumber();

      // Проверяем уровни лояльности
      if (project.bonusLevels.length > 0) {
        const userTotalPurchases = user.totalPurchases.toNumber();

        for (const level of project.bonusLevels) {
          const minAmount = level.minAmount.toNumber();
          const maxAmount = level.maxAmount?.toNumber();

          if (
            userTotalPurchases >= minAmount &&
            (!maxAmount || userTotalPurchases < maxAmount)
          ) {
            bonusPercent = level.bonusPercent;
            break;
          }
        }
      }

      // Начисляем бонусы
      const bonusAmount = Math.floor((amountForBonus * bonusPercent) / 100);

      if (bonusAmount > 0) {
        // Создаем бонус
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + project.bonusExpiryDays);

        await db.bonus.create({
          data: {
            userId: user.id,
            amount: bonusAmount,
            type: 'PURCHASE',
            expiresAt,
            isActive: true
          }
        });

        // Создаем транзакцию
        await db.transaction.create({
          data: {
            userId: user.id,
            type: 'EARN',
            amount: bonusAmount,
            description: `Покупка #${order.number}`,
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
          welcomeBonus = project.referralProgram.welcomeBonus.toNumber();
        } else if (project.welcomeRewardType === 'BONUS') {
          welcomeBonus = project.welcomeBonus.toNumber();
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
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      const balance = bonuses.reduce(
        (sum, bonus) => sum + bonus.amount.toNumber(),
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
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      const currentBalance = bonuses.reduce(
        (sum, bonus) => sum + bonus.amount.toNumber(),
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

      // Получаем настройки проекта
      const integration = await db.inSalesIntegration.findUnique({
        where: { projectId }
      });

      if (!integration) {
        return {
          success: false,
          applied: 0,
          newBalance: currentBalance,
          discount: 0,
          error: 'Integration not configured'
        };
      }

      // Проверяем максимальный процент оплаты бонусами
      const maxBonusAmount =
        (request.orderTotal * integration.maxBonusSpend) / 100;

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

        const bonusAmount = bonus.amount.toNumber();
        const amountToDeduct = Math.min(bonusAmount, remainingToSpend);

        if (amountToDeduct >= bonusAmount) {
          // Полностью используем бонус
          await db.bonus.update({
            where: { id: bonus.id },
            data: { isActive: false }
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
}
