/**
 * @file: route.ts
 * @description: InSales Webhook Receiver - принимает webhooks от InSales (XML формат)
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @updated: 2026-03-05 - добавлен парсинг XML
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { InSalesService } from '@/lib/insales/insales-service';
import type {
  InSalesWebhookPayload,
  InSalesWebhookEvent
} from '@/lib/insales/types';

/**
 * Парсит XML от InSales в объект
 */
function parseInSalesXML(
  xml: string,
  eventFromHeader?: string
): InSalesWebhookPayload {
  // Определяем корневой тег XML для более точной детекции
  const rootTagMatch = xml.match(/<([a-z0-9_-]+)[^>]*>/i);
  const rootTag = rootTagMatch ? rootTagMatch[1] : '';

  // Определяем тип события по тегу <topic> (если есть) или из заголовка
  const topicMatch = xml.match(/<topic>([^<]+)<\/topic>/);
  let event = (
    topicMatch ? topicMatch[1] : eventFromHeader
  ) as InSalesWebhookEvent;

  // Если из заголовков/тега <topic> событие не пришло или оно дефолтное,
  // обязательно уточняем по корневому тегу, так как InSales часто не присылает тему
  if (!event || event === 'orders/create') {
    if (rootTag === 'individual' || rootTag === 'client') {
      event = 'clients/create';
    } else if (rootTag === 'order') {
      event = 'orders/create';
    }
  }

  // Если все еще нет события - ставим дефолт
  if (!event) event = 'orders/create';

  // Нормализация события (InSales может слать client/create вместо clients/create)
  const normalizedEvent = event.toString();
  if (normalizedEvent === 'client/create') event = 'clients/create';
  if (normalizedEvent === 'client/update') event = 'clients/update';
  if (normalizedEvent === 'client/delete') event = 'clients/delete';
  if (normalizedEvent === 'order/create') event = 'orders/create';
  if (normalizedEvent === 'order/update') event = 'orders/update';
  if (normalizedEvent === 'order/delete') event = 'orders/delete';

  const payload: InSalesWebhookPayload = {
    event
  };

  // Проверяем корневой тег XML для более точной детекции
  const rootTagMatch = xml.match(/<([a-z0-9_-]+)[^>]*>/i);
  const rootTag = rootTagMatch ? rootTagMatch[1] : '';

  logger.debug(
    'Parsing InSales XML',
    { rootTag, event, xmlPreview: xml.substring(0, 100) },
    'insales-webhook'
  );

  // Парсим данные заказа для orders/*
  if (event.startsWith('orders/') || rootTag === 'order') {
    const idMatch = xml.match(/<id[^>]*>(\d+)<\/id>/);
    const numberMatch = xml.match(/<number>([^<]+)<\/number>/);
    const totalPriceMatch = xml.match(
      /<total-price[^>]*>([^<]+)<\/total-price>/
    );
    const clientIdMatch = xml.match(/<client-id[^>]*>(\d+)<\/client-id>/);
    const emailMatch = xml.match(/<client-email>([^<]+)<\/client-email>/);
    const phoneMatch = xml.match(/<client-phone>([^<]+)<\/client-phone>/);
    const nameMatch = xml.match(/<client-name>([^<]+)<\/client-name>/);
    const createdAtMatch = xml.match(/<created-at[^>]*>([^<]+)<\/created-at>/);

    payload.order = {
      id: idMatch ? parseInt(idMatch[1]) : 0,
      number: numberMatch ? numberMatch[1] : '',
      total_price: totalPriceMatch ? totalPriceMatch[1] : '0',
      items_price: '0',
      delivery_price: '0',
      payment_status: 'paid',
      fulfillment_status: 'new',
      created_at: createdAtMatch ? createdAtMatch[1] : new Date().toISOString(),
      updated_at: createdAtMatch ? createdAtMatch[1] : new Date().toISOString(),
      items: [],
      client: {
        id: clientIdMatch ? parseInt(clientIdMatch[1]) : 0,
        email: emailMatch ? emailMatch[1] : '',
        phone: phoneMatch ? phoneMatch[1] : '',
        name: nameMatch ? nameMatch[1] : '',
        created_at: createdAtMatch
          ? createdAtMatch[1]
          : new Date().toISOString(),
        updated_at: createdAtMatch
          ? createdAtMatch[1]
          : new Date().toISOString()
      }
    };
  }

  // Парсим данные клиента для clients/*
  if (
    event.startsWith('clients/') ||
    rootTag === 'client' ||
    rootTag === 'individual'
  ) {
    const idMatch = xml.match(/<id[^>]*>(\d+)<\/id>/);
    const emailMatch = xml.match(/<email>([^<]+)<\/email>/);
    const phoneMatch = xml.match(/<phone>([^<]+)<\/phone>/);
    const nameMatch = xml.match(/<name>([^<]+)<\/name>/);
    const createdAtMatch = xml.match(/<created-at[^>]*>([^<]+)<\/created-at>/);

    payload.client = {
      id: idMatch ? parseInt(idMatch[1]) : 0,
      email: emailMatch ? emailMatch[1] : '',
      phone: phoneMatch ? phoneMatch[1] : '',
      name: nameMatch ? nameMatch[1] : '',
      created_at: createdAtMatch ? createdAtMatch[1] : new Date().toISOString(),
      updated_at: createdAtMatch ? createdAtMatch[1] : new Date().toISOString()
    };
  }

  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const startTime = Date.now();
  const { projectId } = await params;

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

    // Получаем тело запроса
    const body = await request.text();
    const contentType = request.headers.get('content-type') || '';

    logger.info(
      'InSales webhook received',
      {
        projectId,
        contentType,
        bodyPreview: body.substring(0, 200)
      },
      'insales-webhook'
    );

    // InSales отправляет XML, парсим его
    let payload: InSalesWebhookPayload;
    let rawPayload: any = {};

    const insalesTopic = request.headers.get('x-insales-topic');
    logger.debug(
      'InSales webhook headers',
      {
        projectId,
        topic: insalesTopic,
        headers: Object.fromEntries(request.headers.entries())
      },
      'insales-webhook'
    );

    if (contentType.includes('xml') || body.trim().startsWith('<?xml')) {
      // Парсим XML
      payload = parseInSalesXML(body, insalesTopic || undefined);
      // Сохраняем исходный XML для отладки
      rawPayload = {
        format: 'xml',
        raw: body,
        parsed: payload,
        headerTopic: insalesTopic
      };
    } else {
      // Fallback на JSON (на случай если формат изменится)
      try {
        payload = JSON.parse(body);
        // Нормализация события для JSON
        if (payload.event === ('client/create' as any))
          payload.event = 'clients/create';

        rawPayload = {
          format: 'json',
          raw: body,
          parsed: payload,
          headerTopic: insalesTopic
        };
      } catch (e) {
        throw new Error('Invalid payload format: expected XML or JSON');
      }
    }

    logger.info(
      'InSales webhook parsed',
      {
        projectId,
        event: payload.event,
        hasOrder: !!payload.order,
        hasClient: !!payload.client
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
        if (!payload.client) {
          throw new Error('Client data is missing in webhook payload');
        }
        result = await insalesService.handleClientUpdate(
          projectId,
          payload.client
        );
        success = result.success;
        error = result.error;
        break;

      case 'orders/delete':
        if (!payload.order) {
          // Delete payload in insales might just have ID, but let's see.
          // If we have order info, cancel it.
          throw new Error('Order data is missing in webhook payload');
        }
        // orders/delete is essentially a cancellation if it hasn't been handled already.
        // We'll mark it as cancelled.
        payload.order.payment_status = 'cancelled';
        result = await insalesService.handleOrderCancellation(
          projectId,
          payload.order
        );
        success = result.success;
        error = result.error;
        break;

      case 'clients/delete':
        // Пока не обрабатываем удаление клиентов
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
        payload: rawPayload, // Сохраняем исходный XML + распарсенные данные
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
