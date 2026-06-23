/**
 * @file: src/app/api/projects/[id]/payouts/route.ts
 * @description: GET — список заявок на вывод b2b-комиссии (план 007) для админ-очереди.
 *   Фильтр по статусу, пагинация, имя партнёра-получателя.
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma, PayoutService
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PayoutStatus, Prisma } from '@prisma/client';

import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ProjectService } from '@/lib/services/project.service';

const VALID_STATUSES: PayoutStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PAID',
  'REJECTED',
  'CANCELLED',
  'FAILED'
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await context.params;

  try {
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const url = request.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10))
    );
    const statusParam = url.searchParams.get('status') as PayoutStatus | null;

    const where: Prisma.PayoutWhereInput = {
      projectId,
      ...(statusParam && VALID_STATUSES.includes(statusParam)
        ? { status: statusParam }
        : {})
    };

    const [total, payouts] = await Promise.all([
      db.payout.count({ where }),
      db.payout.findMany({
        where,
        // REQUESTED первыми (их разбирать), затем по дате.
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        }
      })
    ]);

    const items = payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      payoutMethod: p.payoutMethod,
      requestedAt: p.requestedAt.toISOString(),
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
      rejectReason: p.rejectReason,
      failReason: p.failReason,
      externalRef: p.externalRef,
      partner: {
        id: p.user.id,
        name:
          [p.user.firstName, p.user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          p.user.phone ||
          p.user.email ||
          p.user.id
      }
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    logger.error('GET /api/projects/[id]/payouts failed', {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      component: 'api-payouts-admin'
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
