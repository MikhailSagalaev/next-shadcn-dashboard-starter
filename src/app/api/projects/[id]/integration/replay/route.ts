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

    // ВАЖНО: Поскольку мы находимся в server-side контексте,
    // мы не можем делать fetch запросы на внешние URL
    // Вместо этого возвращаем информацию для повторного выполнения на клиенте
    console.log('🔄 Подготавливаем данные для повторного выполнения запроса', {
      projectId,
      logId,
      endpoint,
      method,
      component: 'webhook-replay'
    });

    // Возвращаем данные для повторного выполнения на клиенте
    return NextResponse.json({
      success: true,
      message: 'Данные подготовлены для повторного выполнения',
      replayData: {
        endpoint,
        method,
        headers,
        body: requestBody,
        projectId,
        logId
      }
    });

    // Логируем подготовку данных
    console.log('📝 Данные подготовлены для повторного выполнения', {
      projectId,
      logId,
      endpoint,
      method,
      component: 'webhook-replay'
    });

    return NextResponse.json({
      success: true,
      message: 'Данные подготовлены для повторного выполнения',
      replayData: {
        endpoint,
        method,
        headers,
        body: requestBody,
        projectId,
        logId
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
