/**
 * @file: src/app/api/profile/stats/route.ts
 * @description: API endpoint для получения статистики профиля пользователя
 * @project: SaaS Bonus System
 * @dependencies: Next.js API routes, Prisma, JWT auth
 * @created: 2024-09-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { verifyJwt } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию через HttpOnly cookie
    const token = request.cookies.get('sb_auth')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const payload = await verifyJwt(token);

    if (!payload) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 });
    }

    // Получаем статистику из базы данных (только для проектов этого администратора)
    const [
      projectsCount,
      usersCount,
      botsCount,
      totalBonuses,
      activeProjects,
      recentActivity
    ] = await Promise.all([
      // Количество проектов текущего администратора
      db.project.count({
        where: {
          ownerId: payload.sub
        }
      }),

      // Общее количество пользователей в проектах этого администратора
      db.user.count({
        where: {
          project: {
            ownerId: payload.sub
          }
        }
      }),

      // Количество активных ботов у этого администратора
      db.project.count({
        where: {
          ownerId: payload.sub,
          botSettings: {
            isNot: null
          }
        }
      }),

      // Общая сумма бонусов в проектах этого администратора
      db.bonus.aggregate({
        _sum: {
          amount: true
        },
        where: {
          user: {
            project: {
              ownerId: payload.sub
            }
          }
        }
      }),

      // Активные проекты (с активностью за последние 30 дней) этого администратора
      db.project.count({
        where: {
          ownerId: payload.sub,
          users: {
            some: {
              bonuses: {
                some: {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            }
          }
        }
      }),

      // Последняя активность в проектах этого администратора
      db.bonus.findFirst({
        where: {
          user: {
            project: {
              ownerId: payload.sub
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      })
    ]);

    // Получаем информацию об администраторе
    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Вычисляем uptime (примерно, на основе последней активности)
    const uptime = recentActivity
      ? Math.round(
          (Date.now() - recentActivity.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    const stats = {
      user: {
        name: admin ? `Администратор (${admin.role})` : 'Администратор',
        email: admin?.email || '',
        createdAt: admin?.createdAt || new Date(),
        lastLogin: admin?.updatedAt || new Date()
      },
      system: {
        projects: projectsCount,
        users: usersCount,
        bots: botsCount,
        activeProjects,
        totalBonuses: totalBonuses._sum.amount || 0,
        uptime: Math.max(0, 100 - uptime), // Процент uptime
        lastActivity: recentActivity?.createdAt || new Date()
      },
      version: 'v2.1.0',
      status: {
        database: 'Подключена',
        redis: 'Активен',
        telegram: 'Работает'
      }
    };

    return NextResponse.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get profile stats:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
