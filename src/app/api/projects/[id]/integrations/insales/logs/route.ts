/**
 * @file: route.ts
 * @description: Admin API для просмотра логов InSales webhooks
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Получаем интеграцию
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Параметры пагинации
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const event = searchParams.get('event');
    const success = searchParams.get('success');

    const skip = (page - 1) * limit;

    // Фильтры
    const where: any = {
      integrationId: integration.id
    };

    if (event) {
      where.event = event;
    }

    if (success !== null && success !== undefined) {
      where.success = success === 'true';
    }

    // Получаем логи
    const [logs, total] = await Promise.all([
      db.inSalesWebhookLog.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit
      }),
      db.inSalesWebhookLog.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(
      'Error getting InSales webhook logs',
      { error },
      'insales-admin-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
