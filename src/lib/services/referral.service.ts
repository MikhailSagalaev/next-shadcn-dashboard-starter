/**
 * @file: referral.service.ts
 * @description: Сервис для работы с реферальной системой
 * @project: SaaS Bonus System
 * @dependencies: db, Prisma types, bonus types, BonusService
 * @created: 2025-01-23
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  ReferralProgram,
  CreateReferralProgramInput,
  UpdateReferralProgramInput,
  User,
  ReferralStats
} from '@/types/bonus';
import { BonusService } from './user.service';
// Crypto импорт только для server-side

export class ReferralService {
  /**
   * Получить настройки реферальной программы проекта
   */
  static async getReferralProgram(
    projectId: string
  ): Promise<ReferralProgram | null> {
    try {
      const program = await db.referralProgram.findUnique({
        where: { projectId },
        include: { project: true }
      });

      if (!program) return null;

      return {
        ...program,
        referrerBonus: Number(program.referrerBonus), // правильное поле
        refereeBonus: Number(program.bonusPercent), // правильное поле для покупателя
        minPurchaseAmount: 0, // TODO: добавить в схему БД
        cookieLifetime: 30, // временное значение до добавления в схему
        project: program.project
          ? {
              ...program.project,
              bonusPercentage: Number(program.project.bonusPercentage)
            }
          : undefined
      };
    } catch (error) {
      logger.error('Ошибка получения реферальной программы', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }

  /**
   * Создать или обновить реферальную программу
   */
  static async createOrUpdateReferralProgram(
    input: CreateReferralProgramInput
  ): Promise<ReferralProgram> {
    try {
      // Проверяем, существует ли уже программа
      const existingProgram = await db.referralProgram.findUnique({
        where: { projectId: input.projectId }
      });

      let program;

      if (existingProgram) {
        // Обновляем существующую программу
        program = await db.referralProgram.update({
          where: { projectId: input.projectId },
          data: {
            isActive: input.isActive ?? existingProgram.isActive,
            bonusPercent: input.referrerBonus, // используем referrerBonus как bonusPercent в БД
            referrerBonus: input.refereeBonus, // используем refereeBonus как referrerBonus в БД
            description: input.description ?? existingProgram.description
          },
          include: { project: true }
        });

        logger.info('Обновлена реферальная программа', {
          projectId: input.projectId,
          programId: program.id,
          component: 'referral-service'
        });
      } else {
        // Создаём новую программу
        program = await db.referralProgram.create({
          data: {
            projectId: input.projectId,
            isActive: input.isActive ?? true,
            bonusPercent: input.referrerBonus,
            referrerBonus: input.refereeBonus ?? 0,
            description: input.description
          },
          include: { project: true }
        });

        logger.info('Создана реферальная программа', {
          projectId: input.projectId,
          programId: program.id,
          component: 'referral-service'
        });
      }

      return {
        ...program,
        referrerBonus: Number(program.bonusPercent),
        refereeBonus: Number(program.referrerBonus),
        minPurchaseAmount: 0, // временно захардкожено
        cookieLifetime: 30, // временно захардкожено
        project: program.project
          ? {
              ...program.project,
              bonusPercentage: Number(program.project.bonusPercentage)
            }
          : undefined
      };
    } catch (error) {
      logger.error('Ошибка создания/обновления реферальной программы', {
        input,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }

  /**
   * Обновить реферальную программу
   */
  static async updateReferralProgram(
    projectId: string,
    input: UpdateReferralProgramInput
  ): Promise<ReferralProgram> {
    try {
      const program = await db.referralProgram.update({
        where: { projectId },
        data: {
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.referrerBonus !== undefined && {
            bonusPercent: input.referrerBonus
          }),
          ...(input.refereeBonus !== undefined && {
            referrerBonus: input.refereeBonus
          }),
          ...(input.description !== undefined && {
            description: input.description
          })
        },
        include: { project: true }
      });

      logger.info('Обновлена реферальная программа', {
        projectId,
        updates: input,
        component: 'referral-service'
      });

      return {
        ...program,
        referrerBonus: Number(program.bonusPercent),
        refereeBonus: Number(program.referrerBonus),
        minPurchaseAmount: 0, // временно захардкожено
        cookieLifetime: 30, // временно захардкожено
        project: program.project
          ? {
              ...program.project,
              bonusPercentage: Number(program.project.bonusPercentage)
            }
          : undefined
      };
    } catch (error) {
      logger.error('Ошибка обновления реферальной программы', {
        projectId,
        input,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }

  /**
   * Генерировать уникальный реферальный код для пользователя
   */
  static generateReferralCode(userId: string): string {
    // Создаём короткий уникальный код на основе userId
    if (typeof window === 'undefined') {
      // Server-side
      const { createHash } = require('crypto');
      const hash = createHash('md5').update(userId).digest('hex');
      return hash.substring(0, 8).toUpperCase();
    } else {
      // Client-side fallback
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  }

  /**
   * Установить реферальный код пользователю (если его нет)
   */
  static async ensureUserReferralCode(userId: string): Promise<string> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, referralCode: true }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      if (user.referralCode) {
        return user.referralCode;
      }

      // Генерируем и сохраняем новый код
      const referralCode = this.generateReferralCode(userId);

      await db.user.update({
        where: { id: userId },
        data: { referralCode }
      });

      logger.info('Создан реферальный код пользователя', {
        userId,
        referralCode,
        component: 'referral-service'
      });

      return referralCode;
    } catch (error) {
      logger.error('Ошибка создания реферального кода', {
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }

  /**
   * Найти рефера ТОЛЬКО по utm_ref (ID пользователя)
   */
  static async findReferrer(
    projectId: string,
    utmRef?: string
  ): Promise<User | null> {
    try {
      if (!utmRef) return null;

      const user = await db.user.findFirst({
        where: {
          projectId,
          id: utmRef,
          isActive: true
        }
      });

      if (!user) return null;

      return {
        ...user,
        totalPurchases: Number(user.totalPurchases)
      };
    } catch (error) {
      logger.error('Ошибка поиска рефера', {
        projectId,
        utmRef,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      return null; // Не выбрасываем ошибку, так как рефер может не существовать
    }
  }

  /**
   * Обработать реферальное начисление при покупке
   */
  static async processReferralBonus(
    userId: string,
    purchaseAmount: number
  ): Promise<{
    bonusAwarded: boolean;
    referrerBonus?: number;
    referrerUser?: User;
  }> {
    try {
      // Получаем пользователя и проект
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { project: true }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Получаем настройки реферальной программы
      const referralProgram = await this.getReferralProgram(user.projectId);

      if (!referralProgram || !referralProgram.isActive) {
        return { bonusAwarded: false };
      }

      // Ищем рефера
      let referrer: User | null = null;

      // Если у пользователя уже есть рефер в БД, используем его
      if (user.referredBy) {
        const existingReferrer = await db.user.findUnique({
          where: { id: user.referredBy }
        });
        if (existingReferrer) {
          referrer = {
            ...existingReferrer,
            totalPurchases: Number(existingReferrer.totalPurchases)
          };
        }
      } else {
        // При покупках больше НЕ ищем по utm_* – связь должна быть установлена при регистрации
        // Оставляем referrer как null, никаких дополнительных действий здесь не требуется
        referrer = null;
      }

      if (!referrer || referrer.id === userId) {
        return { bonusAwarded: false };
      }

      // Рассчитываем бонус
      const bonusAmount =
        (purchaseAmount * referralProgram.referrerBonus) / 100;

      if (bonusAmount <= 0) {
        return { bonusAwarded: false };
      }

      // Начисляем бонус рефереру (awardBonus уже создаёт транзакцию EARN)
      const bonus = await BonusService.awardBonus({
        userId: referrer.id,
        amount: bonusAmount,
        type: 'REFERRAL',
        description: `Реферальный бонус за покупку ${user.firstName || 'пользователя'} (${bonusAmount}₽)`
      });

      // Дополнительная транзакция EARN не создаётся, чтобы избежать дублирования

      logger.info('Начислен реферальный бонус', {
        referrerId: referrer.id,
        userId,
        bonusAmount,
        purchaseAmount,
        referralPercent: referralProgram.referrerBonus,
        component: 'referral-service'
      });

      return {
        bonusAwarded: true,
        referrerBonus: bonusAmount,
        referrerUser: referrer
      };
    } catch (error) {
      logger.error('Ошибка обработки реферального бонуса', {
        userId,
        purchaseAmount,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      // Не выбрасываем ошибку, чтобы не сломать основную покупку
      return { bonusAwarded: false };
    }
  }

  /**
   * Получить реферальную статистику конкретного пользователя
   * ✅ НОВОЕ: Возвращает статистику пользователя, а не всего проекта
   */
  static async getUserReferralStats(userId: string, projectId: string): Promise<{
    referralCount: number;
    referralBonusTotal: number;
  }> {
    try {
      logger.debug('Getting user referral stats', { userId, projectId });

      // Количество рефералов пользователя
      const referralCount = await db.user.count({
        where: {
          referredBy: userId,
          projectId: projectId,
          isActive: true
        }
      });

      // Сумма реферальных бонусов, полученных пользователем
      const referralBonusesResult = await db.transaction.aggregate({
        where: {
          userId: userId,
          isReferralBonus: true,
          type: 'EARN'
        },
        _sum: { amount: true }
      });

      const referralBonusTotal = Number(referralBonusesResult._sum.amount || 0);

      logger.debug('User referral stats calculated', {
        userId,
        referralCount,
        referralBonusTotal
      });

      return {
        referralCount,
        referralBonusTotal
      };
    } catch (error) {
      logger.error('Error getting user referral stats', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        referralCount: 0,
        referralBonusTotal: 0
      };
    }
  }

  /**
   * Получить статистику реферальной программы (для всего проекта)
   */
  static async getReferralStats(projectId: string): Promise<ReferralStats> {
    try {
      // Общая статистика
      const totalReferrals = await db.user.count({
        where: {
          projectId,
          referredBy: { not: null },
          isActive: true
        }
      });

      const activeReferrals = await db.user.count({
        where: {
          projectId,
          referredBy: { not: null },
          isActive: true,
          totalPurchases: { gt: 0 }
        }
      });

      // Общая сумма реферальных бонусов
      const referralBonusesSum = await db.transaction.aggregate({
        where: {
          user: { projectId },
          isReferralBonus: true,
          type: 'EARN'
        },
        _sum: { amount: true }
      });

      const totalReferralBonuses = Number(referralBonusesSum._sum.amount || 0);

      // Метрики за последние 30 дней
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [periodReferralsCount, periodBonusSum] = await Promise.all([
        db.user.count({
          where: {
            projectId,
            referredBy: { not: null },
            isActive: true,
            registeredAt: { gte: since }
          }
        }),
        db.transaction.aggregate({
          where: {
            user: { projectId },
            isReferralBonus: true,
            type: 'EARN',
            createdAt: { gte: since }
          },
          _sum: { amount: true }
        })
      ]);

      const periodBonusPaid = Number(periodBonusSum._sum.amount || 0);

      // Средний чек по проекту за период — по EARN из покупок (MANUAL/REFERRAL не учитываем)
      const earmsForAvg = await db.transaction.findMany({
        where: {
          user: { projectId },
          type: 'EARN',
          isReferralBonus: false,
          createdAt: { gte: since }
        },
        select: { amount: true }
      });
      const averageOrderValue =
        earmsForAvg.length > 0
          ? earmsForAvg.reduce((s: number, t: any) => s + Number(t.amount), 0) /
            earmsForAvg.length
          : 0;

      // Топ рефереров
      const topReferrersRaw = await db.user.findMany({
        where: {
          projectId,
          referrals: { some: {} }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          referralCode: true,
          _count: { select: { referrals: true } },
          transactions: {
            where: { isReferralBonus: true, type: 'EARN' },
            select: { amount: true }
          }
        },
        orderBy: {
          referrals: { _count: 'desc' }
        },
        take: 10
      });

      const topReferrers = topReferrersRaw.map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        referralCount: user._count.referrals,
        totalBonus: user.transactions.reduce(
          (sum: number, t: { amount: unknown }) =>
            sum + Number((t as any).amount),
          0
        )
      }));

      // UTM источники (по пользователям с referredBy)
      const utmGrouped = await db.user.groupBy({
        by: ['utmSource', 'utmMedium', 'utmCampaign'],
        where: { projectId, referredBy: { not: null } },
        _count: { _all: true }
      });

      const utmSources = utmGrouped.map((g: any) => ({
        utm_source: g.utmSource,
        utm_medium: g.utmMedium,
        utm_campaign: g.utmCampaign,
        count: Number(g._count?._all || 0)
      }));

      return {
        totalReferrals,
        periodReferrals: periodReferralsCount,
        activeReferrers: activeReferrals,
        totalBonusPaid: totalReferralBonuses,
        periodBonusPaid,
        averageOrderValue,
        topReferrers,
        utmSources
      };
    } catch (error) {
      logger.error('Ошибка получения статистики реферальной программы', {
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }

  /**
   * Генерировать реферальную ссылку для пользователя
   */
  static async generateReferralLink(
    userId: string,
    baseUrl: string,
    additionalParams?: Record<string, string>
  ): Promise<string> {
    try {
      let base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // Добавляем протокол если его нет
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`;
      }
      const url = new URL(base);
      // Новая схема: только utm_ref с userId
      url.searchParams.set('utm_ref', userId);

      // Добавляем дополнительные параметры
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      return url.toString();
    } catch (error) {
      logger.error('Ошибка генерации реферальной ссылки', {
        userId,
        baseUrl,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'referral-service'
      });
      throw error;
    }
  }
}
