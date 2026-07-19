/**
 * @file: route.ts
 * @description: Partner API — список ожидающих заявок на вступление
 * @project: SaaS Bonus System
 * @created: 2026-06-07
 */

import { NextRequest, NextResponse } from 'next/server';

import { requirePartnerUser } from '@/lib/with-partner-auth';
import { withRateLimit } from '@/lib/with-rate-limit';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

async function getHandler(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const auth = await requirePartnerUser(request, projectId);
  if ('error' in auth) return auth.error;

  const requests = await PartnerTeamService.listPendingRequestsForReviewer(
    projectId,
    auth.partner.id
  );

  return NextResponse.json({ requests });
}

export const GET = withRateLimit(getHandler, {
  maxRequests: 30,
  windowMs: 60_000
});
