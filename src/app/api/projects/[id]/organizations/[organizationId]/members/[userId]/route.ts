/**
 * @file: route.ts
 * @description: Участник организации — обновление и удаление из сети
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withProjectAccess } from '@/lib/with-project-access';
import { PartnerOrganizationService } from '@/lib/services/partner-organization.service';

const ReferrerLinkSchema = z.object({
  referrerId: z.string().min(1),
  sharePercent: z.number().min(0).max(100).optional(),
  isPrimary: z.boolean().optional()
});

const UpdateMemberSchema = z.object({
  level: z.number().int().min(1).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  canManage: z.boolean().optional(),
  referredBy: z.string().nullable().optional(),
  referrerLinks: z.array(ReferrerLinkSchema).optional(),
  outboundReferralPlanId: z.string().nullable().optional()
});

type MemberParams = { id: string; organizationId: string; userId: string };

export const PATCH = withProjectAccess<MemberParams>(
  async (request, { projectId, params }) => {
    const { organizationId, userId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = UpdateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const { user, attributionLocked } =
        await PartnerOrganizationService.updateMember(
          projectId,
          organizationId,
          userId,
          {
            ...parsed.data,
            referrerLinks: parsed.data.referrerLinks?.map((link) => ({
              referrerId: link.referrerId as string,
              sharePercent: link.sharePercent,
              isPrimary: link.isPrimary
            }))
          }
        );
      // Do not expose the raw Prisma User here: it can contain a BigInt
      // telegramId, which NextResponse JSON cannot serialize.
      return NextResponse.json({ user: { id: user.id }, attributionLocked });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
);

export const DELETE = withProjectAccess<MemberParams>(
  async (_request, { projectId, params }) => {
    const { organizationId, userId } = await params;
    try {
      await PartnerOrganizationService.removeMember(
        projectId,
        organizationId,
        userId
      );
      return NextResponse.json({ success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
);
