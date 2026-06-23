/**
 * @file: src/app/api/notifications/admin/route.ts
 * @description: Лента in-app уведомлений текущего админа для колокольчика
 *   (план 009, core). Отдельный путь от /api/notifications (исходящие рассылки).
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, AdminNotificationService, getCurrentAdmin
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { AdminNotificationService } from '@/lib/services/admin-notification.service';

const COMPONENT = 'notifications-api';

// GET /api/notifications/admin?unread=true&limit=20&cursor=<id>
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : undefined;
    const limit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? parsedLimit
        : undefined;

    const [{ items, nextCursor }, unreadCount] = await Promise.all([
      AdminNotificationService.list(admin.sub, {
        unreadOnly,
        limit,
        cursor
      }),
      AdminNotificationService.unreadCount(admin.sub)
    ]);

    return NextResponse.json({ items, nextCursor, unreadCount });
  } catch (error) {
    logger.error('GET /api/notifications/admin failed', {
      error: error instanceof Error ? error.message : String(error),
      component: COMPONENT
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
