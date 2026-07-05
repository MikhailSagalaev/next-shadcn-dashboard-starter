/**
 * @file: src/app/api/projects/[id]/join-requests/[requestId]/approve/route.ts
 * @description: Ручное одобрение заявки на вступление админом проекта —
 *   на случай, если реферер (менеджер/директор) недоступен, чтобы одобрить
 *   заявку в Telegram-боте. Админ — не `User` в этом проекте, поэтому идёт
 *   через `adminOverride`, минуя canReviewJoinRequest (доступ уже проверен
 *   через withProjectAccess).
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

import { NextResponse } from 'next/server';

import { withProjectAccess } from '@/lib/with-project-access';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

type Params = { id: string; requestId: string };

export const POST = withProjectAccess<Params>(
  async (_request, { projectId, admin, params }) => {
    const { requestId } = await params;

    try {
      const { partnerRole } = await PartnerTeamService.approveJoinRequest({
        projectId,
        requestId,
        reviewerUserId: admin.sub,
        adminOverride: true
      });
      return NextResponse.json({ success: true, partnerRole });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      const status = msg.includes('не найдена') ? 404 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  }
);
