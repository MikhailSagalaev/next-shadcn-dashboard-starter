/**
 * @file: src/app/api/projects/[id]/users/[userId]/referrer/route.ts
 * @description: Ручная привязка реферера ("кто привёл") к пользователю админом.
 *   В отличие от PATCH основного роута, запускает полную b2b-привязку:
 *   referredBy + syncAttribution комиссий + уведомление вышестоящих.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { UserService } from '@/lib/services/user.service';

const BodySchema = z.object({
  referrerId: z.string().min(1)
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, userId } = await context.params;
  try {
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await UserService.assignReferrerManually({
      projectId,
      userId,
      referrerId: parsed.data.referrerId
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    const status = msg.includes('не найден') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
