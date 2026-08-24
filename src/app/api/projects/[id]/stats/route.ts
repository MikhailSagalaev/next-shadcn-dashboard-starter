/**
 * @file: src/app/api/projects/[id]/stats/route.ts
 * @description: API для получения статистики проекта
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ProjectService } from '@/lib/services/project.service';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(id, admin.sub);

    // Получаем статистику параллельно
    const [
      totalUsers,
      activeUsers,
      telegramTotal,
      maxTotal,
      noMessenger,
      totalTransactions
    ] = await Promise.all([
      db.user.count({ where: { projectId: id } }),
      db.user.count({
        where: {
          projectId: id,
          OR: [
            { isActive: true },
            { telegramId: { not: null } },
            { maxId: { not: null } }
          ]
        }
      }),
      db.user.count({ where: { projectId: id, telegramId: { not: null } } }),
      db.user.count({ where: { projectId: id, maxId: { not: null } } }),
      db.user.count({
        where: { projectId: id, telegramId: null, maxId: null }
      }),
      db.transaction.count({
        where: { user: { projectId: id } }
      })
    ]);

    const telegramEligible = telegramTotal;
    const maxEligible = maxTotal;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      telegramTotal,
      telegramEligible,
      maxTotal,
      maxEligible,
      noMessenger,
      totalTransactions
    });
  } catch (error) {
    const { id } = await context.params;

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error('Ошибка получения статистики проекта', {
      projectId: id,
      error: error instanceof Error ? error.message : String(error),
      component: 'projects-api'
    });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
