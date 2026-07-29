/**
 * @file: route.ts
 * @description: Участники B2B-организации — список и добавление
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

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  partnerRole: z.enum(['CLIENT', 'TRAINER', 'MANAGER', 'DIRECTOR']).optional(),
  level: z.number().int().min(1).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  canManage: z.boolean().optional(),
  referredBy: z.string().nullable().optional(),
  referrerLinks: z.array(ReferrerLinkSchema).optional(),
  outboundReferralPlanId: z.string().nullable().optional()
});

type OrgParams = { id: string; organizationId: string };

export const GET = withProjectAccess<OrgParams>(
  async (_request, { projectId, params }) => {
    const { organizationId } = await params;
    try {
      const members = await PartnerOrganizationService.listMembers(
        projectId,
        organizationId
      );
      return NextResponse.json({ members });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      const status = msg.includes('не найдена') ? 404 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  }
);

export const POST = withProjectAccess<OrgParams>(
  async (request, { projectId, params }) => {
    const { organizationId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = AddMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const { user, attributionLocked } =
        await PartnerOrganizationService.addMember(projectId, organizationId, {
          userId: parsed.data.userId,
          partnerRole: parsed.data.partnerRole,
          level: parsed.data.level,
          title: parsed.data.title,
          canManage: parsed.data.canManage,
          referredBy: parsed.data.referredBy,
          referrerLinks: parsed.data.referrerLinks?.map((link) => ({
            referrerId: link.referrerId as string,
            sharePercent: link.sharePercent,
            isPrimary: link.isPrimary
          })),
          outboundReferralPlanId: parsed.data.outboundReferralPlanId
        });
      // Prisma User contains telegramId (BigInt). Never return the raw record:
      // JSON.stringify cannot serialize BigInt and the successful mutation used
      // to be reported to the UI as a server error.
      return NextResponse.json(
        { user: { id: user.id }, attributionLocked },
        { status: 201 }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
);
