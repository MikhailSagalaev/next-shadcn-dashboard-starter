/**
 * @file: src/app/api/cron/cleanup-executions/route.ts
 * @description: Cron job для очистки старых выполнений workflow (7 дней по умолчанию)
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

/**
 * Количество дней хранения выполнений workflow
 * По умолчанию 7 дней
 */
const RETENTION_DAYS = parseInt(
  process.env.WORKFLOW_EXECUTION_RETENTION_DAYS || '7',
  10
);

/**
 * Cron job для очистки старых выполнений workflow
 * Рекомендуется запускать ежедневно в 03:00 (низкая нагрузка)
 *
 * Vercel Cron: добавить в vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-executions",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию cron job
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron использует CRON_SECRET автоматически
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron access attempt', {
        source: 'cleanup-executions-cron'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting workflow execution cleanup cron job', {
      source: 'cleanup-executions-cron',
      retentionDays: RETENTION_DAYS
    });

    // Вычисляем дату отсечки
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Удаляем старые выполнения (каскадно удалятся связанные logs)
    const result = await db.workflowExecution.deleteMany({
      where: {
        startedAt: { lt: cutoffDate }
      }
    });

    logger.info('Workflow execution cleanup completed', {
      source: 'cleanup-executions-cron',
      deletedCount: result.count,
      cutoffDate: cutoffDate.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Workflow execution cleanup completed',
      deleted: result.count,
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Workflow execution cleanup cron failed', {
      source: 'cleanup-executions-cron',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Ручной запуск (для тестирования)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
