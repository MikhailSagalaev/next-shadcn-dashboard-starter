/**
 * @file: route.ts
 * @description: API endpoint для повторного выполнения webhook запросов из логов
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, logger
 * @created: 2025-09-23
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ReplayRequestBody {
  logId: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

// Безопасное усечение больших тел
const safeJson = (obj: any, limit = 10000) => {
  try {
    const str = JSON.stringify(obj);
    if (str.length > limit) {
      return { _truncated: true, preview: str.slice(0, limit) } as any;
    }
    return obj;
  } catch {
    return { _error: 'serialization_failed' } as any;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const body: ReplayRequestBody = await request.json();
    const { logId, endpoint, method, headers, body: requestBody } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: { type: 'INVALID_REQUEST', message: 'ID проекта не указан' } },
        { status: 400 }
      );
    }

    if (!logId || !endpoint || !method || !headers || !requestBody) {
      return NextResponse.json(
        {
          error: {
            type: 'INVALID_REQUEST',
            message: 'Недостаточно данных для повторного выполнения'
          }
        },
        { status: 400 }
      );
    }

    // Получаем проект
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, webhookSecret: true, name: true }
    });

    if (!project) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Проект не найден' } },
        { status: 404 }
      );
    }

    // Логируем начало повторного выполнения
    logger.info('🔄 Начинаем повторное выполнение webhook запроса', {
      projectId,
      logId,
      endpoint,
      method,
      component: 'webhook-replay'
    });

    // Определяем URL для повторного запроса
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = `${baseUrl}${endpoint}`;

    // Выполняем запрос
    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(requestBody)
    });

    // Читаем ответ
    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = { _error: 'failed_to_parse_response' };
    }

    // Логируем результат
    logger.info('🔄 Webhook запрос выполнен', {
      projectId,
      logId,
      endpoint,
      method,
      requestStatus: response.status,
      responseSuccess: response.ok,
      responseBody: safeJson(responseBody),
      component: 'webhook-replay'
    });

    // Сохраняем новый лог
    const newLog = await db.webhookLog.create({
      data: {
        projectId,
        endpoint,
        method,
        headers: safeJson(headers),
        body: safeJson(requestBody),
        response: safeJson(responseBody),
        status: response.status,
        success: response.ok
      }
    });

    logger.info('📝 Новый лог создан', {
      projectId,
      logId: newLog.id,
      originalLogId: logId,
      component: 'webhook-replay'
    });

    return NextResponse.json({
      success: true,
      message: 'Запрос успешно выполнен',
      log: {
        id: newLog.id,
        status: response.status,
        success: response.ok,
        response: responseBody
      }
    });
  } catch (error) {
    logger.error('❌ Ошибка при повторном выполнении webhook запроса', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
      component: 'webhook-replay'
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'REPLAY_ERROR',
          message:
            error instanceof Error ? error.message : 'Неизвестная ошибка',
          details: error
        }
      },
      { status: 500 }
    );
  }
}
