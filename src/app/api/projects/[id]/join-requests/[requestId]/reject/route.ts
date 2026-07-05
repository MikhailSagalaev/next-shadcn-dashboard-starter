/**
 * @file: src/app/api/projects/[id]/join-requests/[requestId]/reject/route.ts
 * @description: Ручное отклонение заявки на вступление админом проекта —
 *   см. approve/route.ts по соседству за обоснованием adminOverride.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withProjectAccess } from '@/lib/with-project-access';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

type Params = { id: string; requestId: string };

const BodySchema = z.object({
  reason: z.string().trim().max(500).optional()
});

export const POST = withProjectAccess<Params>(
  async (request, { projectId, admin, params }) => {
    const { requestId } = await params;

    let reason: string | undefined;
    try {
      const raw = await request.text();
      if (raw) {
        const parsed = BodySchema.safeParse(JSON.parse(raw));
        if (parsed.success) reason = parsed.data.reason;
      }
    } catch {
      // Тело необязательно — отклонение без причины тоже валидно.
    }

    try {
      await PartnerTeamService.rejectJoinRequest({
        projectId,
        requestId,
        reviewerUserId: admin.sub,
        reason,
        adminOverride: true
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      const status = msg.includes('не найдена') ? 404 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  }
);
