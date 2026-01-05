/**
 * @file: src/app/api/cron/subscription-expiration/route.ts
 * @description: Cron job для обработки истекающих подписок
 * @project: SaaS Bonus System
 * @dependencies: SubscriptionNotificationService
 * @created: 2026-01-05
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { SubscriptionNotificationService } from '@/lib/services/subscription-notification.service';

/**
 * Cron job для обработки истечения подписок
 * Рекомендуется запускать ежедневно в 09:00
 *
 * Vercel Cron: добавить в vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/subscription-expiration",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию cron job
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron использует CRON_SECRET автоматически
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron access attempt', {
        source: 'subscription-expiration-cron'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting subscription expiration cron job', {
      source: 'subscription-expiration-cron'
    });

    const result =
      await SubscriptionNotificationService.processExpiringSubscriptions();

    logger.info('Subscription expiration cron completed', {
      source: 'subscription-expiration-cron',
      result
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription expiration processing completed',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Subscription expiration cron failed', {
      source: 'subscription-expiration-cron',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Ручной запуск (для тестирования)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
