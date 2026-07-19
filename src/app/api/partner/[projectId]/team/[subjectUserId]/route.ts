/**
 * @file: route.ts
 * @description: Partner API — удаление участника из команды
 * @project: SaaS Bonus System
 * @created: 2026-06-07
 */

import { NextRequest, NextResponse } from 'next/server';

import { requirePartnerUser } from '@/lib/with-partner-auth';
import { withRateLimit } from '@/lib/with-rate-limit';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

async function deleteHandler(
  request: NextRequest,
  context: {
    params: Promise<{ projectId: string; subjectUserId: string }>;
  }
) {
  const { projectId, subjectUserId } = await context.params;
  const auth = await requirePartnerUser(request, projectId);
  if ('error' in auth) return auth.error;

  try {
    await PartnerTeamService.removeFromTeam({
      projectId,
      managerUserId: auth.partner.id,
      subjectUserId
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

export const DELETE = withRateLimit(deleteHandler, {
  maxRequests: 20,
  windowMs: 60_000
});
