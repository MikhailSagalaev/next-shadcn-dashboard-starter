/**
 * @file: src/app/api/projects/[id]/join-requests/route.ts
 * @description: Заявки на вступление в b2b-команду — список для АДМИНА
 *   проекта (в отличие от /api/partner/[projectId]/join-requests, который
 *   авторизуется как партнёр и видит только "свои" заявки через
 *   canReviewJoinRequest). Нужен, потому что раньше единственный способ
 *   одобрить/отклонить заявку — Telegram-бот того, кто пригласил; если он
 *   недоступен, заявка зависает без альтернативы в дашборде.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

import { NextResponse } from 'next/server';

import { withProjectAccess } from '@/lib/with-project-access';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

export const GET = withProjectAccess(async (request, { projectId }) => {
  const url = new URL(request.url);
  const statusParam = (url.searchParams.get('status') || 'PENDING') as
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED';

  try {
    const requests = await PartnerTeamService.listJoinRequestsForAdmin(
      projectId,
      statusParam
    );
    return NextResponse.json({ requests });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
