/**
 * @file: api-logger.ts
 * @description: Сервис логирования API запросов для МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Санитизирует чувствительные данные перед логированием
 */
function sanitizeData(data: any): any {
  if (!data) return data;

  const sanitized = { ...data };

  // Маскируем телефоны
  if (sanitized.phone) {
    sanitized.phone = sanitized.phone.replace(
      /(\d{2})\d{7}(\d{2})/,
      '$1*******$2'
    );
  }

  // Маскируем email
  if (sanitized.email) {
    const [local, domain] = sanitized.email.split('@');
    sanitized.email = `${local.substring(0, 2)}***@${domain}`;
  }

  // Маскируем коды верификации
  if (sanitized.verificationCode) {
    sanitized.verificationCode = '******';
  }

  // Рекурсивно обрабатываем вложенные объекты
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Логирует API запрос
 */
export async function logApiRequest(
  integrationId: string,
  endpoint: string,
  method: string,
  requestBody: any
): Promise<string> {
  try {
    const sanitizedBody = sanitizeData(requestBody);

    const log = await db.moySkladApiLog.create({
      data: {
        integrationId,
        endpoint,
        method,
        requestBody: sanitizedBody,
        responseStatus: 0, // Будет обновлено позже
        processingTimeMs: 0 // Будет обновлено позже
      }
    });

    return log.id;
  } catch (error) {
    logger.error(
      'Error logging API request',
      {
        error,
        integrationId,
        endpoint
      },
      'moysklad-loyalty'
    );

    // Возвращаем пустой ID если логирование не удалось
    return '';
  }
}

/**
 * Обновляет лог с ответом
 */
export async function logApiResponse(
  logId: string,
  status: number,
  responseBody: any,
  processingTimeMs: number
): Promise<void> {
  if (!logId) return; // Пропускаем если логирование запроса не удалось

  try {
    const sanitizedBody = sanitizeData(responseBody);

    await db.moySkladApiLog.update({
      where: { id: logId },
      data: {
        responseStatus: status,
        responseBody: sanitizedBody,
        processingTimeMs
      }
    });
  } catch (error) {
    logger.error(
      'Error logging API response',
      {
        error,
        logId
      },
      'moysklad-loyalty'
    );
  }
}

/**
 * Логирует ошибку API
 */
export async function logApiError(
  logId: string,
  status: number,
  errorMessage: string,
  processingTimeMs: number
): Promise<void> {
  if (!logId) return;

  try {
    await db.moySkladApiLog.update({
      where: { id: logId },
      data: {
        responseStatus: status,
        errorMessage,
        processingTimeMs
      }
    });
  } catch (error) {
    logger.error(
      'Error logging API error',
      {
        error,
        logId
      },
      'moysklad-loyalty'
    );
  }
}

/**
 * Получает статистику API для интеграции
 */
export async function getApiStatistics(integrationId: string): Promise<{
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastRequestAt: Date | null;
}> {
  try {
    // Получаем все логи за последние 24 часа
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await db.moySkladApiLog.findMany({
      where: {
        integrationId,
        createdAt: { gte: oneDayAgo }
      },
      select: {
        responseStatus: true,
        processingTimeMs: true,
        createdAt: true
      }
    });

    const totalRequests = logs.length;

    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        lastRequestAt: null
      };
    }

    const successCount = logs.filter(
      (log) => log.responseStatus >= 200 && log.responseStatus < 300
    ).length;

    const successRate = (successCount / totalRequests) * 100;

    const totalTime = logs.reduce((sum, log) => sum + log.processingTimeMs, 0);
    const averageResponseTime = totalTime / totalRequests;

    const lastRequestAt = logs.reduce((latest, log) => {
      return log.createdAt > latest ? log.createdAt : latest;
    }, logs[0].createdAt);

    return {
      totalRequests,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      lastRequestAt
    };
  } catch (error) {
    logger.error(
      'Error getting API statistics',
      {
        error,
        integrationId
      },
      'moysklad-loyalty'
    );

    return {
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      lastRequestAt: null
    };
  }
}

/**
 * Архивирует старые логи (старше 90 дней)
 */
export async function archiveOldApiLogs(): Promise<void> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await db.moySkladApiLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo }
      }
    });

    logger.info(
      'Archived old API logs',
      {
        deletedCount: result.count
      },
      'moysklad-loyalty'
    );
  } catch (error) {
    logger.error(
      'Error archiving old API logs',
      {
        error
      },
      'moysklad-loyalty'
    );
  }
}

// Архивация каждый день в 3:00
if (typeof window === 'undefined') {
  const scheduleArchiving = () => {
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);

    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const timeUntil3AM = next3AM.getTime() - now.getTime();

    setTimeout(() => {
      archiveOldApiLogs();
      scheduleArchiving(); // Планируем следующую архивацию
    }, timeUntil3AM);
  };

  scheduleArchiving();
}
