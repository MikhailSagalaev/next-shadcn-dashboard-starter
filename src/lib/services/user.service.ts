// Типизация восстановлена для обеспечения безопасности типов

import { randomUUID } from 'crypto';

import { db } from '@/lib/db';
import type {
  CreateUserInput,
  CreateBonusInput,
  CreateTransactionInput,
  User,
  Bonus,
  Transaction,
  UserBalance,
  BonusType,
  TransactionType,
  UserWithBonuses
} from '@/types/bonus';
import { ProjectService } from './project.service';
import { BonusLevelService } from './bonus-level.service';
import { ReferralService } from './referral.service';
import {
  sendBonusNotification,
  sendBonusSpentNotification
} from '@/lib/telegram/notifications';
import { logger } from '@/lib/logger';

export class UserService {
  // Создание нового пользователя с поддержкой UTM меток и реферальной системы
  static async createUser(data: CreateUserInput): Promise<User> {
    try {
      // Нормализуем телефон и email перед сохранением
      let normalizedPhone: string | null = data.phone || null;
      if (normalizedPhone) {
        try {
          const { normalizePhone } = await import('@/lib/phone');
          normalizedPhone = normalizePhone(normalizedPhone) || normalizedPhone;
        } catch {
          // no-op
        }
        // Если после нормализации получилась пустая строка, ставим null
        if (!normalizedPhone || normalizedPhone.trim() === '') {
          normalizedPhone = null;
        }
      }
      const normalizedEmail = (data.email || '').trim();

      // Ищем рефера только по utm_ref (теперь используем utmSource как utm_ref)
      let referredBy: string | undefined;
      if (data.utmSource) {
        const referrer = await ReferralService.findReferrer(
          data.projectId,
          data.utmSource
        );
        if (referrer) {
          referredBy = referrer.id;
        }
      }

      // Генерируем реферальный код для нового пользователя
      const user = await db.user.create({
        data: {
          ...data,
          // Перезаписываем нормализованными значениями
          email: normalizedEmail,
          phone: normalizedPhone,
          referredBy,
          // UTM метки сохраняются как есть из data
          totalPurchases: 0,
          currentLevel: 'Базовый'
        },
        include: {
          project: true,
          bonuses: true,
          transactions: true
        }
      });

      // Реферальные коды больше не используются для ссылок — пропускаем генерацию

      logger.info('Создан новый пользователь', {
        userId: user.id,
        projectId: data.projectId,
        hasReferrer: !!referredBy,
        utmSource: data.utmSource,
        component: 'user-service'
      });

      return user as any;
    } catch (error) {
      logger.error('Ошибка создания пользователя', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'user-service'
      });
      throw error;
    }
  }

  // Поиск пользователя по email или телефону в рамках проекта
  static async findUserByContact(
    projectId: string,
    email?: string,
    phone?: string
  ): Promise<User | null> {
    // Нормализуем входящие параметры
    const normalizedEmail = email && email.trim() ? email.trim() : null;
    const normalizedPhone = phone && phone.trim() ? phone.trim() : null;
    if (!normalizedEmail && !normalizedPhone) return null;

    // Нормализуем и подбираем варианты телефона для максимального совпадения
    const phoneCandidates: string[] = [];
    if (normalizedPhone) {
      try {
        const { normalizePhone } = await import('@/lib/phone');
        const trimmed = normalizedPhone;
        const normalized = normalizePhone(trimmed);
        const digits = trimmed.replace(/\D/g, '');

        if (normalized) phoneCandidates.push(normalized);
        // Вариант с ведущей 8 для старых данных
        if (
          normalized &&
          normalized.startsWith('+7') &&
          normalized.length === 12
        ) {
          phoneCandidates.push('8' + normalized.slice(2));
        }
        // Сырые цифры (вдруг в БД хранились без знака +)
        if (digits) phoneCandidates.push(digits);
        // Преобразуем локальные формы к +7XXXXXXXXXX
        if (digits.length === 11 && digits.startsWith('8')) {
          phoneCandidates.push('+7' + digits.slice(1));
        }
        if (digits.length === 10) {
          phoneCandidates.push('+7' + digits);
        }
        // Исходное
        phoneCandidates.push(trimmed);
      } catch {
        // В случае сбоя нормализации, используем исходное значение
        phoneCandidates.push(normalizedPhone);
      }
    }

    const orConditions: Array<{ email?: string; phone?: string }> = [];
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });
    for (const p of phoneCandidates) {
      orConditions.push({ phone: p });
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('Поиск пользователя по контакту (точный матч)', {
        projectId,
        email: normalizedEmail,
        phonePreview: normalizedPhone ? normalizedPhone.slice(-6) : undefined,
        phoneCandidates,
        component: 'user-service/findUserByContact'
      });
    }

    let user = await db.user.findFirst({
      where: {
        projectId,
        OR: orConditions
      },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    // Фолбэк: если по точным строкам не нашли, ищем по совпадению последних цифр
    if (!user && normalizedPhone) {
      try {
        const { normalizePhone } = await import('@/lib/phone');
        const trimmed = normalizedPhone;
        const normalized = normalizePhone(trimmed) || trimmed;
        const onlyDigits = (s: string) => s.replace(/\D/g, '');
        const candDigits = onlyDigits(normalized);
        const last10 = candDigits.slice(-10);

        if (last10) {
          const possible = await db.user.findMany({
            where: {
              projectId,
              // Ограничим набор по нескольким эвристикам, чтобы не грузить всех
              OR: [
                { phone: { contains: last10.slice(-4) } },
                { phone: { contains: last10 } }
              ]
            },
            include: {
              project: true,
              bonuses: true,
              transactions: true
            },
            take: 50
          });

          const matched = possible.find((u: any) => {
            const nd = onlyDigits(String(u.phone || ''));
            // Сравниваем по последним 10 цифрам
            return nd.slice(-10) === last10;
          });
          user = matched ?? null;

          if (process.env.NODE_ENV !== 'production') {
            logger.info('Фолбэк-поиск по последним цифрам телефона', {
              projectId,
              phoneLast10: last10,
              candidatesChecked: possible.length,
              matchedUserId: (user as any)?.id,
              component: 'user-service/findUserByContact'
            });
          }
        }
      } catch {
        // ignore fallback errors
      }
    }

    if (!user) return null;

    return user as any;
  }

  // Получение пользователя по Telegram ID
  static async getUserByTelegramId(
    projectId: string,
    telegramId: bigint
  ): Promise<User | null> {
    const user = await db.user.findFirst({
      where: { projectId, telegramId },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    if (!user) return null;

    return user as any;
  }

  // Привязка Telegram аккаунта к пользователю
  static async linkTelegramAccount(
    projectId: string,
    telegramId: bigint,
    telegramUsername?: string,
    contactInfo?: { email?: string; phone?: string }
  ): Promise<User | null> {
    const user = await this.findUserByContact(
      projectId,
      contactInfo?.email,
      contactInfo?.phone
    );

    if (!user) return null;

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        telegramId,
        telegramUsername
      },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    return updatedUser as any;
  }

  // Получение баланса пользователя с учётом уровня
  static async getUserBalance(userId: string): Promise<UserBalance> {
    const [earnTransactions, spendTransactions, expiringSoon] =
      await Promise.all([
        db.transaction.aggregate({
          where: {
            userId,
            type: 'EARN'
          },
          _sum: {
            amount: true
          }
        }),
        db.transaction.aggregate({
          where: {
            userId,
            type: 'SPEND'
          },
          _sum: {
            amount: true
          }
        }),
        db.bonus.aggregate({
          where: {
            userId,
            isUsed: false,
            expiresAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней
            }
          },
          _sum: {
            amount: true
          }
        })
      ]);

    const totalEarned = Number(earnTransactions._sum.amount || 0);
    const totalSpent = Number(spendTransactions._sum.amount || 0);
    const currentBalance = totalEarned - totalSpent;
    const expiringSoonAmount = Number(expiringSoon._sum.amount || 0);

    return {
      totalEarned,
      totalSpent,
      currentBalance,
      expiringSoon: expiringSoonAmount
    };
  }

  // Получение списка пользователей проекта с информацией об уровнях
  static async getProjectUsers(
    projectId: string,
    page = 1,
    limit = 10
  ): Promise<{ users: UserWithBonuses[]; total: number }> {
    const skip = (page - 1) * limit;

    // Загружаем пользователей страницы и общее количество
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: { projectId },
        skip,
        take: limit,
        include: {
          project: true,
          // Убираем загрузку бонусов/транзакций для предотвращения N+1
          referrer: true,
          referrals: true
        },
        orderBy: { registeredAt: 'desc' }
      }),
      db.user.count({ where: { projectId } })
    ]);

    if (users.length === 0) {
      return { users: [], total };
    }

    const userIds = users.map((u: { id: string }) => u.id);

    // Выполняем агрегаты ОДНИМ запросом для всех пользователей страницы
    const [txByUserAndType, activeBonusesByUser, projectLevels] =
      await Promise.all([
        db.transaction.groupBy({
          by: ['userId', 'type'],
          where: { userId: { in: userIds } },
          _sum: { amount: true }
        }),
        db.bonus.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          _sum: { amount: true }
        }),
        BonusLevelService.getBonusLevels(projectId)
      ]);

    // Преобразуем агрегаты в быстрые словари
    const earnedMap = new Map<string, number>();
    const spentMap = new Map<string, number>();
    for (const row of txByUserAndType) {
      const sum = Number(row._sum?.amount || 0);
      if (row.type === 'EARN') earnedMap.set(row.userId, sum);
      else if (row.type === 'SPEND') spentMap.set(row.userId, sum);
    }

    const activeBonusMap = new Map<string, number>();
    for (const row of activeBonusesByUser) {
      activeBonusMap.set(row.userId, Number(row._sum?.amount || 0));
    }

    // Считаем уровень на основе уже загруженных уровней (без доп. запросов)
    const usersWithBonuses = users.map((user) => {
      const activeBonuses = activeBonusMap.get(user.id) ?? 0;
      const totalEarned = earnedMap.get(user.id) ?? 0;
      const totalSpent = spentMap.get(user.id) ?? 0;

      const progress = BonusLevelService.calculateProgressToNextLevelFromLevels(
        projectLevels as any,
        Number(user.totalPurchases)
      );

      return {
        ...user,
        totalPurchases: Number(user.totalPurchases),
        activeBonuses,
        totalEarned,
        totalSpent,
        level: progress.currentLevel,
        progressToNext: progress.nextLevel
          ? {
              nextLevel: progress.nextLevel,
              amountNeeded: progress.amountNeeded,
              progressPercent: progress.progressPercent
            }
          : undefined
      };
    });

    return { users: usersWithBonuses as any, total };
  }

  // Получить расширенную информацию о пользователе с уровнем
  static async getUserWithLevel(
    userId: string
  ): Promise<UserWithBonuses | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        project: true,
        bonuses: {
          where: {
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        },
        transactions: true,
        referrer: true,
        referrals: true
      }
    });

    if (!user) return null;

    const activeBonuses = user.bonuses.reduce(
      (sum: number, bonus) => sum + Number(bonus.amount),
      0
    );

    const [totalEarned, totalSpent] = await Promise.all([
      db.transaction.aggregate({
        where: { userId: user.id, type: 'EARN' },
        _sum: { amount: true }
      }),
      db.transaction.aggregate({
        where: { userId: user.id, type: 'SPEND' },
        _sum: { amount: true }
      })
    ]);

    // Получаем информацию об уровне
    const progress = await BonusLevelService.calculateProgressToNextLevel(
      user.projectId,
      Number(user.totalPurchases)
    );

    return {
      ...user,
      totalPurchases: Number(user.totalPurchases),
      activeBonuses,
      totalEarned: Number(totalEarned._sum.amount || 0),
      totalSpent: Number(totalSpent._sum.amount || 0),
      level: progress.currentLevel || undefined,
      progressToNext: progress.nextLevel
        ? {
            nextLevel: progress.nextLevel,
            amountNeeded: progress.amountNeeded,
            progressPercent: progress.progressPercent
          }
        : undefined
    } as any;
  }

  // Получение истории транзакций пользователя
  static async getUserTransactions(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          user: true,
          bonus: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      db.transaction.count({
        where: { userId }
      })
    ]);

    return { transactions: transactions as any, total };
  }
}

export class BonusService {
  // Начисление бонусов пользователю с учётом уровня
  static async awardBonus(data: CreateBonusInput): Promise<Bonus> {
    const user = await db.user.findUnique({
      where: { id: data.userId },
      include: { project: true }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Если дата истечения не указана, рассчитываем по настройкам проекта
    let expiresAt = data.expiresAt;
    if (!expiresAt && user.project) {
      const expireDays = user.project.bonusExpiryDays;
      expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
    }

    const bonus = await db.bonus.create({
      data: {
        ...data,
        expiresAt
      },
      include: {
        user: true,
        transactions: true
      }
    });

    // Создаем транзакцию начисления
    await this.createTransaction({
      userId: data.userId,
      bonusId: bonus.id,
      amount: data.amount,
      type: 'EARN',
      description: data.description || `Начисление бонусов: ${data.type}`
    });

    // Отправляем уведомление в Telegram (неблокирующе)
    try {
      await sendBonusNotification(user as any, bonus as any, user.projectId);
    } catch (error) {
      logger.error('Ошибка отправки уведомления о бонусах', {
        userId: data.userId,
        bonusId: bonus.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'bonus-service'
      });
      // Не блокируем основной процесс
    }

    return bonus as any;
  }

  // Списание бонусов пользователя
  static async spendBonuses(
    userId: string,
    amount: number,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<Transaction[]> {
    // Получаем пользователя для контекста уровня и уведомлений
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const currentLevel = await BonusLevelService.calculateUserLevel(
      user.projectId,
      Number(user.totalPurchases)
    );

    const baseMetadata = metadata ? { ...metadata } : {};
    const spendBatchId =
      typeof baseMetadata.spendBatchId === 'string'
        ? baseMetadata.spendBatchId
        : randomUUID();
    baseMetadata.spendBatchId = spendBatchId;

    const normalizedOrderId =
      baseMetadata.spendOrderId ??
      baseMetadata.orderId ??
      baseMetadata.order_id ??
      baseMetadata.orderID ??
      baseMetadata.orderNumber ??
      undefined;

    if (normalizedOrderId && !baseMetadata.spendOrderId) {
      baseMetadata.spendOrderId = normalizedOrderId;
    }

    const transactions = await db.$transaction(async (tx) => {
      const availableBonuses = await tx.bonus.findMany({
        where: {
          userId,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        orderBy: { expiresAt: 'asc' }
      });

      const totalAvailable = availableBonuses.reduce(
        (sum: number, bonus) => sum + Number(bonus.amount),
        0
      );

      if (totalAvailable < amount) {
        throw new Error(
          `Недостаточно бонусов. Доступно: ${totalAvailable}, требуется: ${amount}`
        );
      }

      const created: Transaction[] = [];
      let remainingAmount = amount;

      for (const bonus of availableBonuses) {
        if (remainingAmount <= 0) break;

        const bonusAmount = Number(bonus.amount);
        const spendFromThisBonus = Math.min(bonusAmount, remainingAmount);

        const transactionMetadata = {
          ...baseMetadata,
          spendBatchId,
          spendBatchIndex: created.length,
          spendOrderId: baseMetadata.spendOrderId,
          spendSource: baseMetadata.source || baseMetadata.spendSource,
          spentFromBonusId: bonus.id,
          originalBonusAmount: bonusAmount
        };

        const transaction = await tx.transaction.create({
          data: {
            userId,
            bonusId: bonus.id,
            amount: spendFromThisBonus,
            type: 'SPEND',
            description: description || 'Списание бонусов',
            metadata: transactionMetadata,
            userLevel: currentLevel?.name,
            appliedPercent: currentLevel?.paymentPercent
          },
          include: { user: true, bonus: true }
        });

        created.push(transaction as any);

        const newAmount = bonusAmount - spendFromThisBonus;
        if (newAmount <= 0) {
          await tx.bonus.update({
            where: { id: bonus.id },
            data: { isUsed: true }
          });
        } else {
          await tx.bonus.update({
            where: { id: bonus.id },
            data: { amount: newAmount }
          });
        }

        remainingAmount -= spendFromThisBonus;
      }

      return created;
    });

    // Неблокирующее уведомление
    if (transactions.length > 0) {
      try {
        await sendBonusSpentNotification(
          user as any,
          amount,
          description || 'Списание бонусов',
          user.projectId
        );
      } catch (error) {
        logger.error('Ошибка отправки уведомления о списании бонусов', {
          userId,
          amount,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bonus-service'
        });
      }
    }

    return transactions;
  }

  // Создание транзакции
  static async createTransaction(
    data: CreateTransactionInput
  ): Promise<Transaction> {
    const transaction = await db.transaction.create({
      data,
      include: {
        user: true,
        bonus: true
      }
    });

    return transaction as any;
  }

  // Начисление за покупку с учётом уровня и реферальной системы
  static async awardPurchaseBonus(
    userId: string,
    purchaseAmount: number,
    orderId: string,
    description?: string,
    bonusType: BonusType = 'PURCHASE',
    metadata?: Record<string, any>
  ): Promise<{
    bonus: Bonus;
    levelInfo: {
      currentLevel: string;
      bonusPercent: number;
      levelChanged: boolean;
    };
    referralInfo?: {
      bonusAwarded: boolean;
      referrerBonus?: number;
      referrerUser?: User;
    };
  }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });

    if (!user || !user.project) {
      throw new Error('Пользователь или проект не найден');
    }

    // Обновляем общую сумму покупок и уровень пользователя
    const newTotalPurchases = Number(user.totalPurchases) + purchaseAmount;
    const levelUpdateResult = await BonusLevelService.updateUserLevel(
      userId,
      newTotalPurchases
    );

    // Определяем процент бонуса на основе уровня
    let bonusPercent = Number(user.project.bonusPercentage); // Базовый процент

    if (levelUpdateResult.newLevel) {
      const currentLevel = await BonusLevelService.calculateUserLevel(
        user.projectId,
        newTotalPurchases
      );
      if (currentLevel) {
        bonusPercent = currentLevel.bonusPercent;
      }
    }

    const bonusAmount = (purchaseAmount * bonusPercent) / 100;

    // Начисляем основной бонус
    const bonus = await this.awardBonus({
      userId,
      amount: bonusAmount,
      type: bonusType,
      description:
        description ||
        `Бонус за покупку на сумму ${purchaseAmount}₽ (заказ ${orderId})`
    });

    // Дополнительная EARN-транзакция не создаётся, чтобы избежать дублирования.
    // Подробности покупки уже отражены в описании бонуса.

    // Обрабатываем реферальную систему
    const referralInfo = await ReferralService.processReferralBonus(
      userId,
      purchaseAmount
    );

    logger.info('Начислен бонус за покупку', {
      userId,
      purchaseAmount,
      bonusAmount,
      bonusPercent,
      currentLevel: levelUpdateResult.newLevel,
      levelChanged: levelUpdateResult.levelChanged,
      referralBonusAwarded: referralInfo.bonusAwarded,
      component: 'bonus-service'
    });

    return {
      bonus,
      levelInfo: {
        currentLevel: levelUpdateResult.newLevel || 'Базовый',
        bonusPercent,
        levelChanged: levelUpdateResult.levelChanged
      },
      referralInfo: referralInfo.bonusAwarded ? referralInfo : undefined
    };
  }

  // Начисление ко дню рождения
  static async awardBirthdayBonus(
    userId: string,
    amount: number
  ): Promise<Bonus> {
    return this.awardBonus({
      userId,
      amount,
      type: 'BIRTHDAY',
      description: `Бонус ко дню рождения`
    });
  }
}
