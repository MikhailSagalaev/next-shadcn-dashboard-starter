/**
 * @file: route.ts
 * @description: API endpoint для повторного выполнения webhook запросов из логов
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, logger
 * @created: 2025-09-23
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NextRequest as NextRequestType } from 'next/server';
import { db } from '@/lib/db';

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
    // Добавляем базовую проверку на валидность запроса
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'INVALID_REQUEST',
            message: 'ID проекта не указан'
          }
        },
        { status: 400 }
      );
    }

    let body: ReplayRequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('❌ Ошибка парсинга JSON:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'INVALID_JSON',
            message: 'Неверный JSON в запросе'
          }
        },
        { status: 400 }
      );
    }

    const { logId, endpoint, method, headers, body: requestBody } = body;

    if (!logId || !endpoint || !method || !headers || !requestBody) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'INVALID_REQUEST',
            message: 'Недостаточно данных для повторного выполнения'
          }
        },
        { status: 400 }
      );
    }

    // Получаем проект
    let project;
    try {
      project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, webhookSecret: true, name: true }
      });
    } catch (dbError) {
      console.error('❌ Ошибка при получении проекта из БД:', {
        projectId,
        error: dbError instanceof Error ? dbError.message : String(dbError),
        component: 'webhook-replay'
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'DATABASE_ERROR',
            message: 'Ошибка при получении проекта из базы данных',
            details:
              dbError instanceof Error ? dbError.message : String(dbError)
          }
        },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: { type: 'NOT_FOUND', message: 'Проект не найден' }
        },
        { status: 404 }
      );
    }

    // Логируем начало повторного выполнения
    console.log('🔄 Начинаем повторное выполнение webhook запроса', {
      projectId,
      logId,
      endpoint,
      method,
      component: 'webhook-replay'
    });

    // Выполняем повторный запрос на сервере с правильной конфигурацией
    console.log('🔄 Начинаем повторное выполнение webhook запроса', {
      projectId,
      logId,
      endpoint,
      method,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${endpoint}`,
      component: 'webhook-replay'
    });

    // Определяем URL для повторного запроса
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = `${baseUrl}${endpoint}`;

    // Выполняем запрос с правильной конфигурацией для Node.js
    let response;
    let responseBody;

    try {
      response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(requestBody)
      });

      // Читаем ответ
      try {
        responseBody = await response.json();
      } catch {
        responseBody = { _error: 'failed_to_parse_response' };
      }
    } catch (fetchError) {
      console.error('❌ Ошибка выполнения fetch запроса:', {
        projectId,
        logId,
        targetUrl,
        error:
          fetchError instanceof Error ? fetchError.message : String(fetchError),
        component: 'webhook-replay'
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'FETCH_ERROR',
            message: 'Ошибка выполнения запроса',
            details:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError)
          }
        },
        { status: 500 }
      );
    }

    // Логируем результат
    console.log('🔄 Webhook запрос выполнен', {
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
    let newLog;
    try {
      newLog = await db.webhookLog.create({
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

      console.log('📝 Новый лог создан', {
        projectId,
        logId: newLog.id,
        originalLogId: logId,
        component: 'webhook-replay'
      });
    } catch (dbCreateError) {
      console.error('❌ Ошибка при создании нового лога в БД:', {
        projectId,
        logId,
        error:
          dbCreateError instanceof Error
            ? dbCreateError.message
            : String(dbCreateError),
        component: 'webhook-replay'
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'DATABASE_CREATE_ERROR',
            message: 'Ошибка при создании лога в базе данных',
            details:
              dbCreateError instanceof Error
                ? dbCreateError.message
                : String(dbCreateError)
          }
        },
        { status: 500 }
      );
    }

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
    console.error('❌ Ошибка при повторном выполнении webhook запроса:', {
      projectId: resolvedParams?.id || 'undefined',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      component: 'webhook-replay'
    });

    // Логируем ошибку
    console.error('❌ Ошибка при повторном выполнении webhook запроса:', {
      projectId: resolvedParams?.id || 'undefined',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      component: 'webhook-replay'
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'REPLAY_ERROR',
          message:
            error instanceof Error ? error.message : 'Неизвестная ошибка',
          details: error instanceof Error ? error.stack : String(error)
        }
      },
      { status: 500 }
    );
  }
}
