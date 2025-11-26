/**
 * @file: src/lib/services/rate-limiter.service.ts
 * @description: Сервис для rate limiting с sliding window алгоритмом
 * @project: SaaS Bonus System
 * @dependencies: ioredis
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

/**
 * Конфигурация лимитов по умолчанию
 */
export const DEFAULT_RATE_LIMITS = {
  WORKFLOW_EXECUTION: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 100 // per user
  },
  API_REQUEST: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 60 // per project
  },
  TELEGRAM_MESSAGE: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 30 // per user
  },
  DATABASE_QUERY: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 200 // per project
  },
  TELEGRAM_CHANNEL_CHECK: {
    windowMs: 1000, // 1 секунда
    maxRequests: 30 // Telegram API limit ~30 req/sec
  }
} as const;

export type RateLimitType = keyof typeof DEFAULT_RATE_LIMITS;

/**
 * Результат проверки rate limit
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Timestamp в миллисекундах
  retryAfter?: number; // Секунды до следующего разрешенного запроса
}

/**
 * Сервис для rate limiting с использованием Redis
 * Использует sliding window алгоритм для более точного контроля
 */
export class RateLimiterService {
  private static redisClient: Redis | null = null;

  /**
   * Инициализация Redis клиента
   */
  static initialize(): void {
    if (this.redisClient) {
      return;
    }

    try {
      this.redisClient = redis as Redis;
      logger.info('✅ RateLimiterService initialized with Redis');
    } catch (error) {
      logger.error('Failed to initialize RateLimiterService', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fallback на in-memory store (для development без Redis)
      logger.warn(
        'Rate limiting will use in-memory store (not production-ready)'
      );
    }
  }

  /**
   * Проверяет, разрешен ли запрос согласно rate limit
   * @param type Тип лимита
   * @param identifier Уникальный идентификатор (userId, projectId и т.д.)
   * @param customLimit Опциональный кастомный лимит (переопределяет дефолтный)
   * @returns Результат проверки
   */
  static async checkLimit(
    type: RateLimitType,
    identifier: string,
    customLimit?: { windowMs: number; maxRequests: number }
  ): Promise<RateLimitResult> {
    this.initialize();

    const limit = customLimit || DEFAULT_RATE_LIMITS[type];
    const key = `rate_limit:${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    // Если Redis недоступен, используем in-memory fallback
    if (!this.redisClient || !(this.redisClient instanceof Redis)) {
      return this.checkLimitInMemory(key, limit, now, windowStart);
    }

    try {
      // Используем Redis Sorted Set для sliding window
      const pipeline = this.redisClient.pipeline();

      // Удаляем старые записи (до начала окна)
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Добавляем текущий запрос с timestamp как score
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Устанавливаем TTL для ключа (окно + 1 секунда для безопасности)
      pipeline.expire(key, Math.ceil(limit.windowMs / 1000) + 1);

      // Подсчитываем количество запросов в окне
      pipeline.zcard(key);

      const results = await pipeline.exec();

      if (!results || results.length === 0) {
        logger.warn('Rate limit check failed - no results from pipeline');
        return {
          allowed: true, // Fail open в случае ошибки
          remaining: limit.maxRequests - 1,
          reset: now + limit.windowMs
        };
      }

      // Последний результат - количество запросов (zcard)
      const requestCount = results[results.length - 1][1] as number;

      const allowed = requestCount <= limit.maxRequests;
      const remaining = Math.max(0, limit.maxRequests - requestCount);
      const reset = now + limit.windowMs;

      // Если превышен лимит, вычисляем retryAfter
      let retryAfter: number | undefined;
      if (!allowed && requestCount > 0) {
        // Находим самый старый запрос в окне
        const oldestRequest = await this.redisClient.zrange(
          key,
          0,
          0,
          'WITHSCORES'
        );
        if (oldestRequest && oldestRequest.length >= 2) {
          const oldestTimestamp = parseInt(oldestRequest[1] as string);
          retryAfter = Math.ceil(
            (oldestTimestamp + limit.windowMs - now) / 1000
          );
        }
      }

      return {
        allowed,
        remaining,
        reset,
        retryAfter
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        type,
        identifier,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fail open - разрешаем запрос при ошибке Redis
      return {
        allowed: true,
        remaining: limit.maxRequests - 1,
        reset: now + limit.windowMs
      };
    }
  }

  /**
   * In-memory fallback для rate limiting (только для development)
   */
  private static inMemoryStore = new Map<
    string,
    { requests: number[]; windowMs: number; maxRequests: number }
  >();

  private static checkLimitInMemory(
    key: string,
    limit: { windowMs: number; maxRequests: number },
    now: number,
    windowStart: number
  ): RateLimitResult {
    const store = this.inMemoryStore.get(key);

    if (!store) {
      this.inMemoryStore.set(key, {
        requests: [now],
        windowMs: limit.windowMs,
        maxRequests: limit.maxRequests
      });

      return {
        allowed: true,
        remaining: limit.maxRequests - 1,
        reset: now + limit.windowMs
      };
    }

    // Удаляем старые запросы
    store.requests = store.requests.filter(
      (timestamp) => timestamp > windowStart
    );

    // Проверяем лимит
    const allowed = store.requests.length < limit.maxRequests;

    if (allowed) {
      store.requests.push(now);
    }

    const remaining = Math.max(0, limit.maxRequests - store.requests.length);
    const reset = now + limit.windowMs;

    // Очистка старых записей каждые 100 проверок (простая оптимизация)
    if (Math.random() < 0.01) {
      const keysToDelete: string[] = [];
      for (const [k, v] of this.inMemoryStore.entries()) {
        if (v.requests.length === 0) {
          keysToDelete.push(k);
        }
      }
      keysToDelete.forEach((k) => this.inMemoryStore.delete(k));
    }

    return {
      allowed,
      remaining,
      reset
    };
  }

  /**
   * Сбрасывает счетчик для указанного идентификатора
   * @param type Тип лимита
   * @param identifier Уникальный идентификатор
   */
  static async resetLimit(
    type: RateLimitType,
    identifier: string
  ): Promise<void> {
    this.initialize();

    const key = `rate_limit:${type}:${identifier}`;

    if (this.redisClient && this.redisClient instanceof Redis) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        logger.error('Failed to reset rate limit', {
          type,
          identifier,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      // In-memory fallback
      this.inMemoryStore.delete(key);
    }
  }

  /**
   * Получает текущее состояние rate limit
   * @param type Тип лимита
   * @param identifier Уникальный идентификатор
   */
  static async getLimitStatus(
    type: RateLimitType,
    identifier: string
  ): Promise<{ count: number; limit: number; reset: number } | null> {
    this.initialize();

    const limit = DEFAULT_RATE_LIMITS[type];
    const key = `rate_limit:${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    if (this.redisClient && this.redisClient instanceof Redis) {
      try {
        // Удаляем старые записи
        await this.redisClient.zremrangebyscore(key, 0, windowStart);

        // Получаем количество запросов
        const count = await this.redisClient.zcard(key);

        return {
          count,
          limit: limit.maxRequests,
          reset: now + limit.windowMs
        };
      } catch (error) {
        logger.error('Failed to get rate limit status', {
          type,
          identifier,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    } else {
      // In-memory fallback
      const store = this.inMemoryStore.get(key);
      if (!store) {
        return {
          count: 0,
          limit: limit.maxRequests,
          reset: now + limit.windowMs
        };
      }

      store.requests = store.requests.filter(
        (timestamp) => timestamp > windowStart
      );

      return {
        count: store.requests.length,
        limit: limit.maxRequests,
        reset: now + limit.windowMs
      };
    }
  }
}

// Автоматическая инициализация при импорте
RateLimiterService.initialize();
