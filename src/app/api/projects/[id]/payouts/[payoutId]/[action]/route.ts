/**
 * @file: src/app/api/projects/[id]/payouts/[payoutId]/[action]/route.ts
 * @description: POST — действия админа над заявкой на вывод (план 007):
 *   approve | reject | paid | fail. Делегирует в PayoutService (машина состояний
 *   + возврат резерва на reject/fail).
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, PayoutService
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ProjectService } from '@/lib/services/project.service';
import { PayoutService } from '@/lib/services/payout.service';
import { PartnerNotificationService } from '@/lib/services/partner-notification.service';

const ACTIONS = ['approve', 'reject', 'paid', 'fail'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; payoutId: string; action: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, payoutId, action } = await context.params;

  if (!ACTIONS.includes(action as Action)) {
    return NextResponse.json(
      { error: `Недопустимое действие: ${action}` },
      { status: 400 }
    );
  }

  try {
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Заявка должна принадлежать проекту админа.
  const payout = await db.payout.findFirst({
    where: { id: payoutId, projectId },
    select: { id: true }
  });
  if (!payout) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  const body = await request
    .json()
    .catch(() => ({}) as Record<string, unknown>);
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const externalRef =
    typeof body.externalRef === 'string' ? body.externalRef : undefined;

  try {
    let result;
    switch (action as Action) {
      case 'approve':
        result = await PayoutService.approvePayout(payoutId, admin.sub);
        break;
      case 'reject':
        result = await PayoutService.rejectPayout(payoutId, admin.sub, reason);
        break;
      case 'paid':
        result = await PayoutService.markPaid(payoutId, admin.sub, externalRef);
        break;
      case 'fail':
        result = await PayoutService.failPayout(payoutId, admin.sub, reason);
        break;
    }

    // Уведомить партнёра о смене статуса (неблокирующе — метод глотает ошибки).
    await PartnerNotificationService.notifyPartnerPayoutStatus(
      payoutId,
      projectId
    );

    return NextResponse.json({ ok: true, payout: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Payout admin action failed', {
      projectId,
      payoutId,
      action,
      message,
      component: 'api-payouts-admin'
    });
    // Недопустимый переход / бизнес-ошибка → 409 (конфликт состояния).
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
