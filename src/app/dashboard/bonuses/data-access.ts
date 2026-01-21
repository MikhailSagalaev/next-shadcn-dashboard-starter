/**
 * @file: data-access.ts
 * @description: Data access layer для страницы управления бонусами
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface BonusStats {
  totalProjects: number;
  totalUsers: number;
  totalBonuses: number;
  activeBonuses: number;
  expiringSoon: number;
}

export interface BonusTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string; // TransactionType from Prisma
  description: string;
  createdAt: Date;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    project: {
      id: string;
      name: string;
    };
  };
}

export interface BonusPageData {
  stats: BonusStats;
  recentTransactions: BonusTransaction[];
  projects: Array<{
    id: string;
    name: string;
    userCount: number;
    bonusCount: number;
  }>;
}

export interface TransactionsPageData {
  transactions: BonusTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getBonusesData(): Promise<BonusPageData> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/auth/sign-in');
  }

  // Фильтр по владельцу для мультитенантности
  const ownerFilter = { ownerId: admin.sub };

  try {
    // Параллельная загрузка данных
    const [
      totalProjects,
      totalUsers,
      totalBonusesData,
      activeBonusesData,
      expiringSoonData,
      recentTransactions,
      projectsData
    ] = await Promise.all([
      // Количество проектов владельца
      db.project.count({
        where: ownerFilter
      }),

      // Количество пользователей в проектах владельца
      db.user.count({
        where: {
          project: ownerFilter
        }
      }),

      // Сумма всех бонусов
      db.bonus.aggregate({
        _sum: {
          amount: true
        },
        where: {
          user: {
            project: ownerFilter
          }
        }
      }),

      // Сумма активных бонусов (не истекших)
      db.bonus.aggregate({
        _sum: {
          amount: true
        },
        where: {
          user: {
            project: ownerFilter
          },
          expiresAt: {
            gt: new Date()
          }
        }
      }),

      // Бонусы истекающие в течение 30 дней
      db.bonus.aggregate({
        _sum: {
          amount: true
        },
        where: {
          user: {
            project: ownerFilter
          },
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Последние 10 транзакций
      db.transaction.findMany({
        where: {
          user: {
            project: ownerFilter
          }
        },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }),

      // Проекты с статистикой
      db.project.findMany({
        where: ownerFilter,
        take: 5,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              users: true
            }
          }
        }
      })
    ]);

    // Получаем количество бонусов для каждого проекта
    const projectsWithBonuses = await Promise.all(
      projectsData.map(async (project) => {
        const bonusCount = await db.bonus.count({
          where: {
            user: {
              projectId: project.id
            }
          }
        });

        return {
          id: project.id,
          name: project.name,
          userCount: project._count.users,
          bonusCount
        };
      })
    );

    return {
      stats: {
        totalProjects,
        totalUsers,
        totalBonuses: Number(totalBonusesData._sum.amount || 0),
        activeBonuses: Number(activeBonusesData._sum.amount || 0),
        expiringSoon: Number(expiringSoonData._sum.amount || 0)
      },
      recentTransactions: recentTransactions.map((t) => ({
        ...t,
        amount: Number(t.amount)
      })) as BonusTransaction[],
      projects: projectsWithBonuses
    };
  } catch (error) {
    logger.error('Error fetching bonuses data', { error }, 'bonuses-service');
    // Возвращаем пустые данные вместо краша
    return {
      stats: {
        totalProjects: 0,
        totalUsers: 0,
        totalBonuses: 0,
        activeBonuses: 0,
        expiringSoon: 0
      },
      recentTransactions: [],
      projects: []
    };
  }
}

/**
 * Получить транзакции с пагинацией и фильтрацией
 */
export async function getTransactions(
  page: number = 1,
  pageSize: number = 50,
  searchTerm: string = '',
  projectId?: string,
  type?: string
): Promise<TransactionsPageData> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/auth/sign-in');
  }

  const ownerFilter = { ownerId: admin.sub };

  try {
    // Строим фильтр
    const where: any = {
      user: {
        project: ownerFilter
      }
    };

    // Фильтр по проекту
    if (projectId) {
      where.user.project.id = projectId;
    }

    // Фильтр по типу транзакции
    if (type && type !== 'ALL') {
      where.type = type;
    }

    // Поиск по пользователю
    if (searchTerm) {
      where.user = {
        ...where.user,
        OR: [
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } }
        ]
      };
    }

    // Параллельная загрузка данных и подсчет
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }),
      db.transaction.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount)
      })) as BonusTransaction[],
      total,
      page,
      pageSize,
      totalPages
    };
  } catch (error) {
    logger.error('Error fetching transactions', { error }, 'bonuses-service');
    return {
      transactions: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0
    };
  }
}
