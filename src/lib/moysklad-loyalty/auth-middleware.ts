/**
 * @file: auth-middleware.ts
 * @description: Authentication middleware для МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuthToken } from './auth';
import { LoyaltyApiErrorClass, ErrorCodes } from './types';
import { logger } from '@/lib/logger';

// Rate limiting store (in-memory, можно заменить на Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Извлекает auth token из заголовков запроса
 */
function extractAuthToken(request: NextRequest): string | null {
  return request.headers.get('Lognex-Discount-API-Auth-Token');
}

/**
 * Проверяет rate limit для проекта
 * Лимит: 1000 запросов в минуту на проект
 */
function checkRateLimit(projectId: string): boolean {
  const now = Date.now();
  const key = `moysklad:${projectId}`;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    // Новое окно или истекло время
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + 60000 // 1 минута
    });
    return true;
  }

  if (limit.count >= 1000) {
    return false; // Превышен лимит
  }

  limit.count++;
  return true;
}

/**
 * Middleware для аутентификации запросов от МойСклад
 *
 * Проверяет:
 * 1. Наличие auth token в заголовке
 * 2. Валидность токена
 * 3. Активность интеграции
 * 4. Rate limiting
 */
export async function authenticateRequest(
  request: NextRequest,
  projectId: string
): Promise<
  | { success: true; integrationId: string }
  | { success: false; response: NextResponse }
> {
  const startTime = Date.now();

  try {
    // 1. Извлекаем токен из заголовков
    const token = extractAuthToken(request);

    if (!token) {
      logger.warn(
        'МойСклад API: Missing auth token',
        {
          projectId,
          ip: request.ip || 'unknown'
        },
        'moysklad-loyalty'
      );

      return {
        success: false,
        response: NextResponse.json(
          new LoyaltyApiErrorClass(
            401,
            ErrorCodes.UNAUTHORIZED,
            'Отсутствует токен аутентификации'
          ).toJSON(),
          { status: 401 }
        )
      };
    }

    // 2. Находим интеграцию по projectId
    const integration = await db.moySkladIntegration.findUnique({
      where: { projectId },
      select: {
        id: true,
        authToken: true,
        isActive: true
      }
    });

    if (!integration) {
      logger.warn(
        'МойСклад API: Integration not found',
        {
          projectId,
          ip: request.ip || 'unknown'
        },
        'moysklad-loyalty'
      );

      return {
        success: false,
        response: NextResponse.json(
          new LoyaltyApiErrorClass(
            404,
            ErrorCodes.NOT_FOUND,
            'Интеграция не найдена'
          ).toJSON(),
          { status: 404 }
        )
      };
    }

    // 3. Проверяем активность интеграции
    if (!integration.isActive) {
      logger.warn(
        'МойСклад API: Integration is disabled',
        {
          projectId,
          integrationId: integration.id
        },
        'moysklad-loyalty'
      );

      return {
        success: false,
        response: NextResponse.json(
          new LoyaltyApiErrorClass(
            503,
            ErrorCodes.SERVICE_UNAVAILABLE,
            'Интеграция отключена'
          ).toJSON(),
          { status: 503 }
        )
      };
    }

    // 4. Проверяем токен
    const isValidToken = await verifyAuthToken(token, integration.authToken);

    if (!isValidToken) {
      logger.warn(
        'МойСклад API: Invalid auth token',
        {
          projectId,
          integrationId: integration.id,
          ip: request.ip || 'unknown'
        },
        'moysklad-loyalty'
      );

      return {
        success: false,
        response: NextResponse.json(
          new LoyaltyApiErrorClass(
            401,
            ErrorCodes.UNAUTHORIZED,
            'Неверный токен аутентификации'
          ).toJSON(),
          { status: 401 }
        )
      };
    }

    // 5. Проверяем rate limit
    if (!checkRateLimit(projectId)) {
      logger.warn(
        'МойСклад API: Rate limit exceeded',
        {
          projectId,
          integrationId: integration.id
        },
        'moysklad-loyalty'
      );

      return {
        success: false,
        response: NextResponse.json(
          new LoyaltyApiErrorClass(
            429,
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            'Превышен лимит запросов (1000 запросов в минуту)'
          ).toJSON(),
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      };
    }

    // 6. Обновляем lastRequestAt
    await db.moySkladIntegration.update({
      where: { id: integration.id },
      data: { lastRequestAt: new Date() }
    });

    const duration = Date.now() - startTime;
    logger.info(
      'МойСклад API: Authentication successful',
      {
        projectId,
        integrationId: integration.id,
        durationMs: duration
      },
      'moysklad-loyalty'
    );

    return {
      success: true,
      integrationId: integration.id
    };
  } catch (error) {
    logger.error(
      'МойСклад API: Authentication error',
      {
        error,
        projectId
      },
      'moysklad-loyalty'
    );

    return {
      success: false,
      response: NextResponse.json(
        new LoyaltyApiErrorClass(
          500,
          ErrorCodes.INTERNAL_ERROR,
          'Внутренняя ошибка сервера'
        ).toJSON(),
        { status: 500 }
      )
    };
  }
}

/**
 * Очистка старых записей rate limit (вызывать периодически)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Очистка каждые 5 минут
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}
