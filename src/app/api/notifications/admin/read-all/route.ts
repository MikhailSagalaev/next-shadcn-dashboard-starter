/**
 * @file: src/app/api/notifications/admin/read-all/route.ts
 * @description: Пометить все уведомления админа прочитанными (план 009).
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, AdminNotificationService, getCurrentAdmin
 */

import { NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { AdminNotificationService } from '@/lib/services/admin-notification.service';

const COMPONENT = 'notifications-api';

// POST /api/notifications/admin/read-all
export async function POST() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await AdminNotificationService.markAllRead(admin.sub);
    const unreadCount = await AdminNotificationService.unreadCount(admin.sub);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    logger.error('POST /api/notifications/admin/read-all failed', {
      error: error instanceof Error ? error.message : String(error),
      component: COMPONENT
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
