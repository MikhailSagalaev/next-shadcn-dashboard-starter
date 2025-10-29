/**
 * @file: src/lib/services/workflow/query-executor.ts
 * @description: Безопасный executor для database queries с whitelist
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * Типы для параметров запросов
 */
export interface CheckUserParams {
  telegramId: string;
  projectId: string;
  phone?: string;
  email?: string;
}

export interface CreateUserParams {
  telegramId: string;
  projectId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface AddBonusParams {
  userId: string;
  amount: number;
  type: string;
  description?: string;
  expiresAt?: Date;
}

export interface SpendBonusParams {
  userId: string;
  amount: number;
  description?: string;
}

export interface GetUserBalanceParams {
  userId: string;
}

export interface UpdateUserParams {
  userId: string;
  data: {
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Whitelist безопасных запросов
 * Каждый запрос использует Prisma методы вместо raw SQL
 */
export const SAFE_QUERIES = {
  /**
   * Проверить пользователя по Telegram ID, телефону или email
   */
  check_user_by_telegram: async (db: PrismaClient, params: CheckUserParams) => {
    logger.debug('Executing check_user_by_telegram', { params });

    // Сначала ищем по Telegram ID
    if (params.telegramId) {
      let user = await db.user.findFirst({
        where: {
          telegramId: BigInt(params.telegramId),
          projectId: params.projectId
        },
        include: {
          bonuses: {
            where: {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      });

      if (user) {
        const balance = user.bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);
        
        // Возвращаем только сериализуемые данные пользователя
        return {
          id: user.id,
          projectId: user.projectId,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          birthDate: user.birthDate,
          telegramId: user.telegramId?.toString(),
          telegramUsername: user.telegramUsername,
          isActive: user.isActive,
          registeredAt: user.registeredAt,
          updatedAt: user.updatedAt,
          currentLevel: user.currentLevel,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          totalPurchases: Number(user.totalPurchases),
          utmCampaign: user.utmCampaign,
          utmContent: user.utmContent,
          utmMedium: user.utmMedium,
          utmSource: user.utmSource,
          utmTerm: user.utmTerm,
          balance
        };
      }
    }

    // Если не нашли по Telegram ID, ищем по телефону
    if (params.phone) {
      let user = await db.user.findFirst({
        where: {
          phone: params.phone,
          projectId: params.projectId
        },
        include: {
          bonuses: {
            where: {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      });

      if (user) {
        const balance = user.bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);
        
        // Возвращаем только сериализуемые данные пользователя
        return {
          id: user.id,
          projectId: user.projectId,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          birthDate: user.birthDate,
          telegramId: user.telegramId?.toString(),
          telegramUsername: user.telegramUsername,
          isActive: user.isActive,
          registeredAt: user.registeredAt,
          updatedAt: user.updatedAt,
          currentLevel: user.currentLevel,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          totalPurchases: Number(user.totalPurchases),
          utmCampaign: user.utmCampaign,
          utmContent: user.utmContent,
          utmMedium: user.utmMedium,
          utmSource: user.utmSource,
          utmTerm: user.utmTerm,
          balance
        };
      }
    }

    // Если не нашли по телефону, ищем по email
    if (params.email) {
      let user = await db.user.findFirst({
        where: {
          email: params.email,
          projectId: params.projectId
        },
        include: {
          bonuses: {
            where: {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      });

      if (user) {
        const balance = user.bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);
        
        // Возвращаем только сериализуемые данные пользователя
        return {
          id: user.id,
          projectId: user.projectId,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          birthDate: user.birthDate,
          telegramId: user.telegramId?.toString(),
          telegramUsername: user.telegramUsername,
          isActive: user.isActive,
          registeredAt: user.registeredAt,
          updatedAt: user.updatedAt,
          currentLevel: user.currentLevel,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          totalPurchases: Number(user.totalPurchases),
          utmCampaign: user.utmCampaign,
          utmContent: user.utmContent,
          utmMedium: user.utmMedium,
          utmSource: user.utmSource,
          utmTerm: user.utmTerm,
          balance
        };
      }
    }

    return null;
  },

  /**
   * Создать нового пользователя
   */
  create_user: async (db: PrismaClient, params: CreateUserParams) => {
    logger.debug('Executing create_user', { params });

    const user = await db.user.create({
      data: {
        telegramId: BigInt(params.telegramId),
        projectId: params.projectId,
        telegramUsername: params.username,
        firstName: params.firstName,
        lastName: params.lastName,
        phone: params.phone,
        email: params.email
      }
    });

    return user;
  },

  /**
   * Начислить бонусы
   */
  add_bonus: async (db: PrismaClient, params: AddBonusParams) => {
    logger.debug('Executing add_bonus', { params });

    // Проверяем существование пользователя
    const user = await db.user.findUnique({
      where: { id: params.userId }
    });

    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // Создаем бонус
    const bonus = await db.bonus.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        type: params.type as 'PURCHASE' | 'BIRTHDAY' | 'MANUAL' | 'REFERRAL' | 'PROMO' | 'WELCOME',
        description: params.description,
        expiresAt: params.expiresAt
      }
    });

    // Создаем транзакцию
    await db.transaction.create({
      data: {
        userId: params.userId,
        type: 'EARN',
        amount: params.amount,
        description: params.description || `Начислено ${params.amount} бонусов`
      }
    });

    return bonus;
  },

  /**
   * Списать бонусы
   */
  spend_bonus: async (db: PrismaClient, params: SpendBonusParams) => {
    logger.debug('Executing spend_bonus', { params });

    // Получаем активные бонусы пользователя
    const bonuses = await db.bonus.findMany({
      where: {
        userId: params.userId,
        amount: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: {
        createdAt: 'asc' // FIFO - сначала старые
      }
    });

    const totalAvailable = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

    if (totalAvailable < params.amount) {
      throw new Error(`Insufficient bonus balance. Available: ${totalAvailable}, Required: ${params.amount}`);
    }

    // Списываем бонусы
    let remaining = params.amount;
    const updates = [];

    for (const bonus of bonuses) {
      if (remaining <= 0) break;

      const bonusAmount = Number(bonus.amount);
      const toSpend = Math.min(bonusAmount, remaining);
      
      updates.push(
        db.bonus.update({
          where: { id: bonus.id },
          data: { amount: bonusAmount - toSpend }
        })
      );

      remaining -= toSpend;
    }

    await db.$transaction(updates);

    // Создаем транзакцию
    await db.transaction.create({
      data: {
        userId: params.userId,
        type: 'SPEND',
        amount: -params.amount,
        description: params.description || `Списано ${params.amount} бонусов`
      }
    });

    return { spent: params.amount, remaining: totalAvailable - params.amount };
  },

  /**
   * Получить баланс пользователя
   */
  get_user_balance: async (db: PrismaClient, params: GetUserBalanceParams) => {
    logger.debug('Executing get_user_balance', { params });

    const bonuses = await db.bonus.findMany({
      where: {
        userId: params.userId,
        amount: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    const balance = bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);

    return { userId: params.userId, balance };
  },

  /**
   * Обновить данные пользователя
   */
  update_user: async (db: PrismaClient, params: UpdateUserParams) => {
    logger.debug('Executing update_user', { params });

    const user = await db.user.update({
      where: { id: params.userId },
      data: params.data
    });

    return user;
  },

  /**
   * Получить историю транзакций
   */
  get_transactions: async (db: PrismaClient, params: { userId: string; limit?: number }) => {
    logger.debug('Executing get_transactions', { params });

    const transactions = await db.transaction.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      take: params.limit || 10
    });

    return transactions;
  },

  /**
   * Получить статистику пользователя
   */
  get_user_stats: async (db: PrismaClient, params: { userId: string }) => {
    logger.debug('Executing get_user_stats', { params });

    const [user, transactions, bonuses] = await Promise.all([
      db.user.findUnique({
        where: { id: params.userId }
      }),
      db.transaction.findMany({
        where: { userId: params.userId }
      }),
      db.bonus.findMany({
        where: {
          userId: params.userId,
          amount: { gt: 0 },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      })
    ]);

    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    const totalEarned = transactions
      .filter(t => t.type === 'EARN')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSpent = Math.abs(
      transactions
        .filter(t => t.type === 'SPEND')
        .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    const currentBalance = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

    return {
      user,
      stats: {
        totalEarned,
        totalSpent,
        currentBalance,
        transactionCount: transactions.length
      }
    };
  },

  /**
   * Получить полную информацию о пользователе для отображения
   */
  get_user_profile: async (db: PrismaClient, params: { userId: string }) => {
    logger.debug('Executing get_user_profile', { params });

    const user = await db.user.findUnique({
      where: { id: params.userId },
      include: {
        bonuses: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        referrer: {
          select: {
            firstName: true,
            lastName: true,
            telegramUsername: true
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    const balance = user.bonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);
    const totalEarned = user.transactions
      .filter(t => t.type === 'EARN')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalSpent = Math.abs(
      user.transactions
        .filter(t => t.type === 'SPEND')
        .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    // ✨ НОВОЕ: Подсчёт истекающих бонусов в ближайшие 30 дней
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringBonuses = user.bonuses
      .filter(b => b.expiresAt && b.expiresAt <= thirtyDaysFromNow && b.expiresAt > new Date())
      .reduce((sum, bonus) => sum + Number(bonus.amount), 0);

    // Форматируем историю транзакций
    const transactionHistory = user.transactions.map(t => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      isReferralBonus: t.isReferralBonus
    }));

    // Форматируем активные бонусы
    const activeBonuses = user.bonuses.map(b => ({
      id: b.id,
      amount: Number(b.amount),
      type: b.type,
      description: b.description,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt
    }));

    return {
      // Основная информация
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
      
      // Финансовая информация
      balance,
      totalEarned,
      totalSpent,
      totalPurchases: Number(user.totalPurchases),
      expiringBonuses, // ✨ НОВОЕ: Истекающие бонусы
      
      // Уровень и рефералы
      currentLevel: user.currentLevel,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      referrerName: user.referrer ? 
        `${user.referrer.firstName || ''} ${user.referrer.lastName || ''}`.trim() || 
        user.referrer.telegramUsername || 
        'Неизвестно' : null,
      
      // Даты
      registeredAt: user.registeredAt,
      updatedAt: user.updatedAt,
      
      // История
      transactionHistory,
      activeBonuses,
      transactionCount: user.transactions.length,
      bonusCount: user.bonuses.length
    };
  },

  /**
   * Получить реферальную ссылку пользователя
   */
  get_referral_link: async (db: PrismaClient, params: { userId: string; projectId: string }) => {
    logger.debug('Executing get_referral_link', { params });

    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { referralCode: true }
    });

    if (!user || !user.referralCode) {
      return null;
    }

    // ✨ ИСПРАВЛЕНО: Получаем настройки бота из bot_settings
    const [project, botSettings] = await Promise.all([
      db.project.findUnique({
        where: { id: params.projectId },
        select: { name: true }
      }),
      db.botSettings.findFirst({
        where: { projectId: params.projectId },
        select: { botUsername: true }
      })
    ]);

    // Формируем реферальную ссылку с реальным username бота
    const botUsername = botSettings?.botUsername || 'your_bot_username';
    const referralLink = `https://t.me/${botUsername}?start=ref_${user.referralCode}`;
    
    return {
      referralCode: user.referralCode,
      referralLink,
      projectName: project?.name || 'Бонусная система'
    };
  },

  /**
   * Проверить пользователя по контакту (телефон или email)
   */
        check_user_by_contact: async (db: PrismaClient, params: { phone?: string | object; email?: string; projectId: string }) => {
          console.log('🔍 check_user_by_contact called with params', { 
            phone: params.phone,
            phoneType: typeof params.phone,
            email: params.email,
            projectId: params.projectId
          });

          let user = null;

          // Обрабатываем телефон
          if (params.phone) {
            let phoneNumber: string;
            
            // Если phone - это объект contactReceived, извлекаем phoneNumber
            if (typeof params.phone === 'object' && params.phone !== null) {
              phoneNumber = (params.phone as any).phoneNumber || '';
            } else if (typeof params.phone === 'string') {
              phoneNumber = params.phone.trim();
            } else {
              phoneNumber = '';
            }
            
            console.log('📞 Ищем по телефону:', phoneNumber);
            
            // Пропускаем поиск если телефон пустой или содержит неразрешенные переменные
            if (phoneNumber && !phoneNumber.includes('{{') && !phoneNumber.includes('}}')) {
              // Создаем варианты для поиска
              const digits = phoneNumber.replace(/[^0-9]/g, '');
              const variants = [
                phoneNumber,
                digits,
                `+${digits}`,
                digits.slice(-10)
              ];
              
              // Добавляем варианты для российских номеров
              if (digits.startsWith('8') && digits.length === 11) {
                variants.push(`+7${digits.slice(1)}`);
                variants.push(`7${digits.slice(1)}`);
              } else if (digits.startsWith('7') && digits.length === 11) {
                variants.push(`8${digits.slice(1)}`);
              }
              
              console.log('📞 Варианты для поиска:', variants);

              user = await db.user.findFirst({
                where: {
                  projectId: params.projectId,
                  OR: variants.map(phone => ({ phone }))
                }
              });
            } else {
              console.log('⚠️ Пропускаем поиск по телефону - неразрешенная переменная или пустое значение');
            }
          }

          // Если не нашли по телефону, ищем по email
          if (!user && params.email) {
            const email = (params.email || '').trim().toLowerCase();
            console.log('📧 Ищем по email:', email);
            
            // Пропускаем поиск если email пустой или содержит неразрешенные переменные
            if (email && !email.includes('{{') && !email.includes('}}')) {
              user = await db.user.findFirst({
                where: {
                  email,
                  projectId: params.projectId
                }
              });
            } else {
              console.log('⚠️ Пропускаем поиск по email - неразрешенная переменная или пустое значение');
            }
          }

          if (user) {
            console.log('✅ Пользователь найден:', {
              userId: user.id,
              phone: user.phone,
              email: user.email,
              isActive: user.isActive
            });
            
            // Возвращаем только сериализуемые данные пользователя
            return {
              id: user.id,
              projectId: user.projectId,
              email: user.email,
              phone: user.phone,
              firstName: user.firstName,
              lastName: user.lastName,
              birthDate: user.birthDate,
              telegramId: user.telegramId?.toString(),
              telegramUsername: user.telegramUsername,
              isActive: user.isActive,
              registeredAt: user.registeredAt,
              updatedAt: user.updatedAt,
              currentLevel: user.currentLevel,
              referralCode: user.referralCode,
              referredBy: user.referredBy,
              totalPurchases: Number(user.totalPurchases),
              utmCampaign: user.utmCampaign,
              utmContent: user.utmContent,
              utmMedium: user.utmMedium,
              utmSource: user.utmSource,
              utmTerm: user.utmTerm
            };
          }

          console.log('❌ Пользователь не найден');
          return null;
        },

  /**
   * Активировать пользователя (привязать Telegram)
   */
  activate_user: async (db: PrismaClient, params: { userId: string; telegramId: string; telegramUsername?: string }) => {
    logger.debug('Executing activate_user', { params });

    const user = await db.user.update({
      where: { id: params.userId },
      data: {
        telegramId: BigInt(params.telegramId),
        telegramUsername: params.telegramUsername,
        isActive: true,
        updatedAt: new Date()
      }
    });

    return user;
  },

  /**
   * Проверить, есть ли у пользователя приветственные бонусы
   */
  check_welcome_bonus: async (db: PrismaClient, params: { userId: string }) => {
    logger.debug('Executing check_welcome_bonus', { params });

    const welcomeBonus = await db.bonus.findFirst({
      where: {
        userId: params.userId,
        type: 'WELCOME'
      }
    });

    return !!welcomeBonus;
  }
};

/**
 * Типы запросов
 */
export type QueryType = keyof typeof SAFE_QUERIES;

/**
 * Безопасный executor запросов
 */
export class QueryExecutor {
  /**
   * Выполнить безопасный запрос
   */
  static async execute(
    db: PrismaClient,
    queryType: string,
    params: any
  ): Promise<any> {
    // Проверяем, что запрос в whitelist
    if (!(queryType in SAFE_QUERIES)) {
      logger.error('Attempted to execute unauthorized query', { queryType });
      throw new Error(`Unauthorized query type: ${queryType}. Only whitelisted queries are allowed.`);
    }

    const queryFn = SAFE_QUERIES[queryType as QueryType];

    try {
      const result = await queryFn(db, params);
      logger.info('Query executed successfully', { queryType, hasResult: !!result });
      return result;
    } catch (error) {
      logger.error('Query execution failed', { queryType, error });
      throw error;
    }
  }

  /**
   * Получить список доступных запросов
   */
  static getAvailableQueries(): QueryType[] {
    return Object.keys(SAFE_QUERIES) as QueryType[];
  }

  /**
   * Проверить, доступен ли запрос
   */
  static isQueryAvailable(queryType: string): boolean {
    return queryType in SAFE_QUERIES;
  }
}

export default QueryExecutor;

