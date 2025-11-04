/**
 * @file: src/app/api/super-admin/stats/route.ts
 * @description: API endpoint для статистики супер-администратора
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Базовые метрики
    const [
      totalUsers,
      totalProjects,
      totalBots,
      activeBots,
      totalAdminAccounts
    ] = await Promise.all([
      db.user.count(),
      db.project.count(),
      db.botSettings.count(),
      db.botSettings.count({ where: { isActive: true } }),
      db.adminAccount.count()
    ]);

    // Регистрации пользователей за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await db.user.findMany({
      where: {
        registeredAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        registeredAt: true
      },
      orderBy: {
        registeredAt: 'asc'
      }
    });

    // Группируем по дням
    const usersByDay: Record<string, number> = {};
    recentUsers.forEach((user) => {
      const date = user.registeredAt.toISOString().split('T')[0];
      usersByDay[date] = (usersByDay[date] || 0) + 1;
    });

    // Создаем массив для графика (последние 30 дней)
    const usersChartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      usersChartData.push({
        date: dateStr,
        count: usersByDay[dateStr] || 0
      });
    }

    // Последние 10 пользователей
    const latestUsers = await db.user.findMany({
      take: 10,
      orderBy: { registeredAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        registeredAt: true,
        project: {
          select: {
            name: true
          }
        }
      }
    });

    // Последние 10 проектов
    const latestProjects = await db.project.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        owner: {
          select: {
            email: true
          }
        }
      }
    });

    // Последние ошибки (из SystemLog)
    let latestErrors: any[] = [];
    try {
      latestErrors = await db.systemLog.findMany({
        where: {
          level: 'error'
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          level: true,
          message: true,
          source: true,
          createdAt: true,
          project: {
            select: {
              name: true
            }
          }
        }
      });
    } catch (error) {
      console.log('SystemLog table may not exist yet');
    }

    // === НОВАЯ АНАЛИТИКА: Метрики производительности ===

    // 1. Webhook запросы за последние 24 часа
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const webhookStats = await db.webhookLog.groupBy({
      by: ['status', 'success'],
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      },
      _count: {
        id: true
      }
    });

    const totalWebhookRequests = webhookStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const successfulWebhooks = webhookStats
      .filter(stat => stat.success)
      .reduce((sum, stat) => sum + stat._count.id, 0);
    const failedWebhooks = totalWebhookRequests - successfulWebhooks;

    // Webhook запросы по часам (последние 24 часа)
    const webhookLogs24h = await db.webhookLog.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      },
      select: {
        createdAt: true,
        status: true,
        success: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const webhooksByHour: Record<string, { total: number; success: number; failed: number }> = {};
    webhookLogs24h.forEach((log) => {
      const hour = new Date(log.createdAt).toISOString().slice(0, 13) + ':00:00';
      if (!webhooksByHour[hour]) {
        webhooksByHour[hour] = { total: 0, success: 0, failed: 0 };
      }
      webhooksByHour[hour].total++;
      if (log.success) {
        webhooksByHour[hour].success++;
      } else {
        webhooksByHour[hour].failed++;
      }
    });

    // 2. Системные логи по уровням (последние 24 часа)
    let systemLogsStats = {
      info: 0,
      warn: 0,
      error: 0,
      debug: 0
    };

    try {
      const logs24h = await db.systemLog.groupBy({
        by: ['level'],
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          }
        },
        _count: {
          id: true
        }
      });

      logs24h.forEach((stat) => {
        systemLogsStats[stat.level as keyof typeof systemLogsStats] = stat._count.id;
      });
    } catch (error) {
      console.log('SystemLog stats may not be available');
    }

    // 3. Топ проектов по активности (webhook запросы)
    const topProjectsByActivity = await db.webhookLog.groupBy({
      by: ['projectId'],
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    const projectsWithActivity = await db.project.findMany({
      where: {
        id: {
          in: topProjectsByActivity.map(p => p.projectId).filter(Boolean) as string[]
        }
      },
      select: {
        id: true,
        name: true,
        domain: true
      }
    });

    const topProjects = topProjectsByActivity.map(stat => {
      const project = projectsWithActivity.find(p => p.id === stat.projectId);
      return {
        projectId: stat.projectId,
        projectName: project?.name || 'Unknown',
        projectDomain: project?.domain || null,
        requestCount: stat._count.id
      };
    });

    // 4. Статистика по источникам ошибок
    let errorSources: Record<string, number> = {};
    try {
      const errorLogs = await db.systemLog.groupBy({
        by: ['source'],
        where: {
          level: 'error',
          createdAt: {
            gte: twentyFourHoursAgo
          }
        },
        _count: {
          id: true
        }
      });

      errorLogs.forEach((stat) => {
        errorSources[stat.source] = stat._count.id;
      });
    } catch (error) {
      console.log('Error sources stats may not be available');
    }

    // 5. Статистика транзакций (последние 24 часа)
    const transactions24h = await db.transaction.count({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      }
    });

    const transactionsByType = await db.transaction.groupBy({
      by: ['type'],
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    // Распределение по статусам ботов
    const botsByStatus = {
      active: activeBots,
      inactive: totalBots - activeBots
    };

    // MRR (Monthly Recurring Revenue) - расчет из подписок
    let mrr = 0;
    try {
      const activeSubscriptions = await db.subscription.findMany({
        where: {
          status: 'active'
        },
        include: {
          plan: true
        }
      });

      mrr = activeSubscriptions.reduce((sum, sub) => {
        const monthlyPrice = sub.plan.interval === 'year' 
          ? Number(sub.plan.price) / 12 
          : Number(sub.plan.price);
        return sum + monthlyPrice;
      }, 0);
    } catch (error) {
      console.log('MRR calculation may not be available yet');
    }

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalProjects,
        totalBots,
        activeBots,
        totalAdminAccounts,
        mrr
      },
      charts: {
        usersByDay: usersChartData,
        botsByStatus,
        webhooksByHour: Object.entries(webhooksByHour).map(([hour, data]) => ({
          hour,
          ...data
        }))
      },
      performance: {
        webhooks: {
          total24h: totalWebhookRequests,
          successful24h: successfulWebhooks,
          failed24h: failedWebhooks,
          successRate: totalWebhookRequests > 0 
            ? ((successfulWebhooks / totalWebhookRequests) * 100).toFixed(2) 
            : '0'
        },
        systemLogs: systemLogsStats,
        transactions: {
          total24h: transactions24h,
          byType: transactionsByType.map(t => ({
            type: t.type,
            count: t._count.id,
            totalAmount: Number(t._sum.amount || 0)
          }))
        },
        topProjects,
        errorSources
      },
      recent: {
        users: latestUsers,
        projects: latestProjects,
        errors: latestErrors
      }
    });
  } catch (error) {
    console.error('Error fetching super admin stats:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении статистики' },
      { status: 500 }
    );
  }
}
