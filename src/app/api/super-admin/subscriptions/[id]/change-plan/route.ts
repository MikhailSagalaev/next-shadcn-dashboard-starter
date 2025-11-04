/**
 * @file: src/app/api/super-admin/subscriptions/[id]/change-plan/route.ts
 * @description: API для смены плана подписки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { BillingService } from '@/lib/services/billing.service';
import { logger } from '@/lib/logger';

/**
 * POST /api/super-admin/subscriptions/[id]/change-plan
 * Сменить план подписки
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await context.params;

    const body = await request.json();

    if (!body.newPlanId) {
      return NextResponse.json(
        { error: 'Обязательное поле: newPlanId' },
        { status: 400 }
      );
    }

    await BillingService.changePlan(id, body.newPlanId, admin.sub || admin.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error changing subscription plan', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка при смене плана' },
      { status: 500 }
    );
  }
}
