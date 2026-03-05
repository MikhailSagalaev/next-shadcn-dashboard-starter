/**
 * @file: route.ts
 * @description: API для получения логов InSales webhooks
 * @project: SaaS Bonus System
 * @created: 2026-03-05
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';

// GET - Получить логи webhooks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Получаем логи (последние 50)
    const logs = await db.inSalesWebhookLog.findMany({
      where: { projectId },
      orderBy: { processedAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error) {
    logger.error(
      'Error getting InSales webhook logs',
      { error },
      'insales-logs-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
