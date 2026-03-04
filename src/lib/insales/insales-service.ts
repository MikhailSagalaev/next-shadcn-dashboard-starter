/**
 * @file: insales-service.ts
 * @description: Сервис для обработки InSales webhooks и API запросов
 * @project: SaaS Bonus System
 * @dependencies: Prisma, UserService, BonusService
 * @created: 2026-03-02
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UserService } from '@/lib/services/user.service';
import { BonusService } from '@/lib/services/bonus.service';
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
  private userService: UserService;
  private bonusService: BonusService;

  constructor() {
    this.userService = new UserService();
    this.bonusService = new BonusService();
  }

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

      // Находим или создаем пользователя
      const identifier = order.client.email || order.client.phone;
      if (!identifier) {
        throw new Error('No email or phone in order client data');
      }

      let user = await this.userService.findUserByContact(
        projectId,
        identifier
      );

      if (!user) {
        // Создаем нового пользователя
        user = await this.userService.createUser({
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
      // (это можно определить по custom полям заказа или по скидке)
      const bonusSpent = 0; // TODO: получить из custom_fields заказа

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
        await this.bonusService.awardBonus({
          userId: user.id,
          amount: bonusAmount,
          type: 'PURCHASE',
          description: `Покупка #${order.number}`,
          expiresInDays: project.bonusExpiryDays,
          metadata: {
            orderId: order.id,
            orderNumber: order.number,
            orderTotal: orderTotal,
            bonusPercent: bonusPercent
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

      const existingUser = await this.userService.findUserByContact(
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
      const user = await this.userService.createUser({
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

      const user = await this.userService.findUserByContact(
        projectId,
        identifier
      );

      if (!user) {
        return {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'User not found'
        };
      }

      const balance = await this.bonusService.getUserBalance(user.id);

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

      const user = await this.userService.findUserByContact(
        projectId,
        identifier
      );

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
      const currentBalance = await this.bonusService.getUserBalance(user.id);

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

      // Списываем бонусы
      await this.bonusService.spendBonus({
        userId: user.id,
        amount: bonusToApply,
        description: `Оплата заказа #${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          orderTotal: request.orderTotal
        }
      });

      const newBalance = await this.bonusService.getUserBalance(user.id);

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
