import { db } from '@/lib/db';
import { botManager } from '@/lib/telegram/bot-manager';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface RecentProject {
  id: string;
  name: string;
  userCount: number;
  botStatus: string;
  createdAt: string;
}

export interface MonthlyUserGrowth {
  name: string;
  total: number;
}

export interface SystemStats {
  totalProjects: number;
  totalUsers: number;
  activeBots: number;
  totalBonuses: number;
  recentProjects: RecentProject[];
  userGrowth: MonthlyUserGrowth[];
}

export async function getDashboardStats(): Promise<SystemStats> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/auth/login');
  }

  // Фильтр по владельцу для всех запросов
  const ownerFilter = { ownerId: admin.sub };

  try {
    // Получаем общую статистику
    const [totalProjects, totalUsers, totalBonuses, recentProjects] =
      await Promise.all([
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

        // Сумма начисленных бонусов для пользователей проектов владельца
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

        // Последние проекты владельца с информацией
        db.project.findMany({
          where: ownerFilter,
          take: 5,
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            botToken: true,
            botSettings: {
              select: {
                isActive: true
              }
            },
            botStatus: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        })
      ]);

    // Подсчитываем активных ботов (логика упрощена для RSC, но должна совпадать с API)
    // 1. Из менеджера:
    let activeBotsFromManager = 0;
    // Note: botManager is a singleton in memory, might not work if scaling, but fine for single instance
    const allBots = botManager.getAllBots();
    const ownerProjects = await db.project.findMany({
      where: ownerFilter,
      select: { id: true }
    });
    const ownerProjectIds = new Set(ownerProjects.map((p) => p.id));

    for (const [projectId, botInstance] of allBots) {
      if (ownerProjectIds.has(projectId) && botInstance.isActive) {
        activeBotsFromManager++;
      }
    }

    // 2. Из БД:
    const activeBotsFromDb = await db.project.count({
      where: {
        ...ownerFilter,
        OR: [
          { botStatus: 'ACTIVE' },
          {
            AND: [
              { botToken: { not: null } },
              { botSettings: { isActive: true } }
            ]
          }
        ]
      }
    });

    // 3. Из Workflows:
    const activeWorkflowsCount = await db.workflow.count({
      where: {
        project: ownerFilter,
        isActive: true
      }
    });

    const activeBots = Math.max(
      activeBotsFromManager,
      activeBotsFromDb,
      activeWorkflowsCount
    );

    // Получаем статистику роста пользователей за последние 6 месяцев
    const userGrowth = await getUserGrowthStats(admin.sub);

    return {
      totalProjects,
      totalUsers,
      activeBots,
      totalBonuses: Number(totalBonuses._sum.amount || 0),
      recentProjects: recentProjects.map((project) => ({
        id: project.id,
        name: project.name,
        userCount: project._count.users,
        botStatus: project.botSettings?.isActive ? 'ACTIVE' : 'INACTIVE',
        createdAt: project.createdAt.toISOString()
      })),
      userGrowth
    };
  } catch (error) {
    logger.error(
      'Error fetching dashboard stats',
      { error },
      'dashboard-service'
    );
    // Return empty stats on error rather than crashing the whole page
    return {
      totalProjects: 0,
      totalUsers: 0,
      activeBots: 0,
      totalBonuses: 0,
      recentProjects: [],
      userGrowth: []
    };
  }
}

/**
 * Получить статистику роста пользователей по месяцам
 */
async function getUserGrowthStats(
  ownerId: string
): Promise<MonthlyUserGrowth[]> {
  try {
    // Получаем дату 6 месяцев назад
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Получаем всех пользователей за последние 6 месяцев
    const users = await db.user.findMany({
      where: {
        project: {
          ownerId
        },
        registeredAt: {
          gte: sixMonthsAgo
        }
      },
      select: {
        registeredAt: true
      },
      orderBy: {
        registeredAt: 'asc'
      }
    });

    // Группируем по месяцам
    const monthNames = [
      'Янв',
      'Фев',
      'Мар',
      'Апр',
      'Май',
      'Июн',
      'Июл',
      'Авг',
      'Сен',
      'Окт',
      'Ноя',
      'Дек'
    ];
    const monthlyData = new Map<string, number>();

    // Инициализируем последние 6 месяцев нулями
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, 0);
    }

    // Подсчитываем кумулятивное количество пользователей
    let cumulativeCount = 0;
    const sortedKeys = Array.from(monthlyData.keys()).sort();

    for (const user of users) {
      const userDate = new Date(user.registeredAt);
      const key = `${userDate.getFullYear()}-${String(userDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(key)) {
        cumulativeCount++;
        monthlyData.set(key, cumulativeCount);
      }
    }

    // Обновляем кумулятивные значения для всех месяцев
    let lastCount = 0;
    for (const key of sortedKeys) {
      const count = monthlyData.get(key) || lastCount;
      monthlyData.set(key, count);
      lastCount = count;
    }

    // Преобразуем в формат для графика
    return sortedKeys.map((key) => {
      const [year, month] = key.split('-');
      const monthIndex = parseInt(month) - 1;
      return {
        name: monthNames[monthIndex],
        total: monthlyData.get(key) || 0
      };
    });
  } catch (error) {
    logger.error(
      'Error fetching user growth stats',
      { error },
      'dashboard-service'
    );
    return [];
  }
}
