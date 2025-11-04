/**
 * @file: src/app/api/super-admin/subscriptions/[id]/cancel/route.ts
 * @description: API для отмены подписки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { BillingService } from '@/lib/services/billing.service';
import { logger } from '@/lib/logger';

/**
 * POST /api/super-admin/subscriptions/[id]/cancel
 * Отменить подписку
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await context.params;

    const body = await request.json();

    await BillingService.cancelSubscription(id, admin.sub || admin.email, body.reason);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error cancelling subscription', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка при отмене подписки' },
      { status: 500 }
    );
  }
}
