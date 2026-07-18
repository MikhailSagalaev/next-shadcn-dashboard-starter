/**
 * @file: route.ts
 * @description: Перенос участника между B2B-организациями одного проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, Zod, PartnerOrganizationService
 * @created: 2026-07-06
 * @author: AI Assistant + User
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PartnerOrganizationService } from '@/lib/services/partner-organization.service';
import { withProjectAccess } from '@/lib/with-project-access';

const TransferMemberSchema = z.object({
  targetOrganizationId: z.string().min(1)
});

type TransferParams = {
  id: string;
  organizationId: string;
  userId: string;
};

export const POST = withProjectAccess<TransferParams>(
  async (request, { projectId, params }) => {
    const { organizationId, userId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = TransferMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    try {
      const result = await PartnerOrganizationService.transferMember(
        projectId,
        organizationId,
        userId,
        parsed.data.targetOrganizationId
      );
      return NextResponse.json(result, {
        headers: { 'X-Project-Id': projectId }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server error';
      const status = message.includes('не найден') ? 404 : 400;
      return NextResponse.json(
        { error: message },
        { status, headers: { 'X-Project-Id': projectId } }
      );
    }
  }
);
