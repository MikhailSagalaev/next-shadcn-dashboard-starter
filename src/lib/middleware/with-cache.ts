/**
 * @file: src/lib/middleware/with-cache.ts
 * @description: Middleware для кэширования API responses с Redis
 * @project: SaaS Bonus System
 * @dependencies: Redis, Logger
 * @created: 2025-10-02
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheService } from '@/lib/redis';
import { logger } from '@/lib/logger';

export type CacheOptions = {
  ttl?: number; // TTL в секундах
  keyPrefix?: string; // Префикс ключа
  generateKey?: (request: NextRequest) => string; // Кастомная генерация ключа
  skipCache?: (request: NextRequest) => boolean; // Условие пропуска кэша
};

/**
 * Middleware для кэширования GET запросов
 */
export function withCache(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  options: CacheOptions = {}
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    // Кэшируем только GET запросы
    if (request.method !== 'GET') {
      return handler(request, context);
    }

    const {
      ttl = 300, // 5 минут по умолчанию
      keyPrefix = 'api',
      generateKey,
      skipCache
    } = options;

    // Проверяем условие пропуска кэша
    if (skipCache && skipCache(request)) {
      return handler(request, context);
    }

    // Генерируем ключ кэша
    const cacheKey = generateKey
      ? generateKey(request)
      : `${keyPrefix}:${request.url}`;

    try {
      // Пытаемся получить из кэша
      const cached = await CacheService.get<any>(cacheKey);
      if (cached) {
        logger.debug('Ответ из кэша', { cacheKey });

        // Возвращаем закэшированный ответ с заголовком
        return new NextResponse(JSON.stringify(cached), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          }
        });
      }

      // Вызываем оригинальный handler
      const response = await handler(request, context);

      // Кэшируем только успешные ответы
      if (response.status === 200) {
        const data = await response.json();
        await CacheService.set(cacheKey, data, ttl);

        logger.debug('Ответ закэширован', { cacheKey, ttl });

        // Возвращаем новый response с данными и заголовком
        return new NextResponse(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS'
          }
        });
      }

      return response;
    } catch (error) {
      logger.error('Ошибка кэширования', {
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheKey
      });

      // При ошибке кэширования просто вызываем handler
      return handler(request, context);
    }
  };
}

/**
 * Инвалидация кэша для определенных ключей
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await CacheService.deletePattern(pattern);
    logger.info('Кэш инвалидирован', { pattern });
  } catch (error) {
    logger.error('Ошибка инвалидации кэша', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pattern
    });
  }
}
