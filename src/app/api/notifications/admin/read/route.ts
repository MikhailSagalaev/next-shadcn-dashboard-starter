/**
 * @file: src/app/api/notifications/admin/read/route.ts
 * @description: Пометить выбранные уведомления админа прочитанными (план 009).
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, AdminNotificationService, getCurrentAdmin
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { AdminNotificationService } from '@/lib/services/admin-notification.service';

const COMPONENT = 'notifications-api';

// POST /api/notifications/admin/read  body: { ids: string[] }
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty string array' },
        { status: 400 }
      );
    }

    await AdminNotificationService.markRead(admin.sub, ids);
    const unreadCount = await AdminNotificationService.unreadCount(admin.sub);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    logger.error('POST /api/notifications/admin/read failed', {
      error: error instanceof Error ? error.message : String(error),
      component: COMPONENT
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
