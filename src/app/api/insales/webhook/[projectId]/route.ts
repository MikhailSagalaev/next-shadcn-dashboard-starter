/**
 * @file: route.ts
 * @description: InSales Webhook Receiver - принимает webhooks от InSales
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { InSalesService } from '@/lib/insales/insales-service';
import type { InSalesWebhookPayload } from '@/lib/insales/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const startTime = Date.now();
  const projectId = params.projectId;

  try {
    // Получаем интеграцию
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      logger.error(
        'InSales integration not found',
        { projectId },
        'insales-webhook'
      );

      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      logger.warn(
        'InSales integration is not active',
        { projectId },
        'insales-webhook'
      );

      return NextResponse.json(
        { error: 'Integration is not active' },
        { status: 403 }
      );
    }

    // Парсим payload
    const payload: InSalesWebhookPayload = await request.json();

    logger.info(
      'InSales webhook received',
      {
        projectId,
        event: payload.event
      },
      'insales-webhook'
    );

    // Создаем сервис
    const insalesService = new InSalesService();

    let result: any;
    let success = true;
    let error: string | undefined;

    // Обрабатываем событие
    switch (payload.event) {
      case 'orders/create':
      case 'orders/update':
        if (!payload.order) {
          throw new Error('Order data is missing in webhook payload');
        }
        result = await insalesService.handleOrderCreate(
          projectId,
          payload.order
        );
        success = result.success;
        error = result.error;
        break;

      case 'clients/create':
        if (!payload.client) {
          throw new Error('Client data is missing in webhook payload');
        }
        result = await insalesService.handleClientCreate(
          projectId,
          payload.client
        );
        success = result.success;
        error = result.error;
        break;

      case 'clients/update':
        // Пока не обрабатываем обновление клиентов
        logger.info(
          'Client update event received (not processed)',
          { projectId },
          'insales-webhook'
        );
        result = {
          success: true,
          message: 'Event acknowledged but not processed'
        };
        break;

      case 'orders/delete':
      case 'clients/delete':
        // Пока не обрабатываем удаление
        logger.info(
          'Delete event received (not processed)',
          { projectId, event: payload.event },
          'insales-webhook'
        );
        result = {
          success: true,
          message: 'Event acknowledged but not processed'
        };
        break;

      default:
        logger.warn(
          'Unknown webhook event',
          { projectId, event: payload.event },
          'insales-webhook'
        );
        result = { success: false, error: 'Unknown event type' };
        success = false;
        error = 'Unknown event type';
    }

    const processingTime = Date.now() - startTime;

    // Логируем webhook
    await db.inSalesWebhookLog.create({
      data: {
        integrationId: integration.id,
        event: payload.event,
        payload: payload as any,
        status: success ? 200 : 400,
        success,
        response: result,
        error,
        processingTimeMs: processingTime
      }
    });

    logger.info(
      'InSales webhook processed',
      {
        projectId,
        event: payload.event,
        success,
        processingTime
      },
      'insales-webhook'
    );

    return NextResponse.json(result, { status: success ? 200 : 400 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      'InSales webhook error',
      {
        projectId,
        error: errorMessage,
        processingTime
      },
      'insales-webhook'
    );

    // Пытаемся залогировать ошибку
    try {
      const integration = await db.inSalesIntegration.findUnique({
        where: { projectId }
      });

      if (integration) {
        await db.inSalesWebhookLog.create({
          data: {
            integrationId: integration.id,
            event: 'unknown',
            payload: {},
            status: 500,
            success: false,
            error: errorMessage,
            processingTimeMs: processingTime
          }
        });
      }
    } catch (logError) {
      logger.error(
        'Failed to log webhook error',
        { error: logError },
        'insales-webhook'
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
