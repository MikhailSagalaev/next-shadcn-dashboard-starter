/**
 * @file: src/app/api/projects/[id]/payouts/export/route.ts
 * @description: GET — CSV-выгрузка выплат для бухгалтерии (план 007). Фильтр по
 *   статусу и диапазону дат подачи. Реквизиты (payoutDetails) НЕ выгружаются в
 *   открытом виде.
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma
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

const COLUMNS = [
  'payoutId',
  'status',
  'requestedAt',
  'paidAt',
  'partnerName',
  'partnerPhone',
  'telegramId',
  'amount',
  'currency',
  'payoutMethod',
  'externalRef',
  'reviewedBy',
  'paidBy'
];

/** Экранирование значения для CSV (запятые, кавычки, переводы строк). */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
    const statusParam = url.searchParams.get('status') as PayoutStatus | null;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const where: Prisma.PayoutWhereInput = {
      projectId,
      ...(statusParam && VALID_STATUSES.includes(statusParam)
        ? { status: statusParam }
        : {}),
      ...(from || to
        ? {
            requestedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {})
    };

    const payouts = await db.payout.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            telegramId: true
          }
        }
      }
    });

    const rows = payouts.map((p) => {
      const partnerName =
        [p.user.firstName, p.user.lastName].filter(Boolean).join(' ').trim() ||
        p.user.phone ||
        '';
      return [
        p.id,
        p.status,
        p.requestedAt.toISOString(),
        p.paidAt?.toISOString() ?? '',
        partnerName,
        p.user.phone ?? '',
        p.user.telegramId ? p.user.telegramId.toString() : '',
        Number(p.amount).toString(),
        p.currency,
        p.payoutMethod ?? '',
        p.externalRef ?? '',
        p.reviewedBy ?? '',
        p.paidBy ?? ''
      ];
    });

    // BOM, чтобы Excel корректно открыл UTF-8 кириллицу.
    const csv =
      '﻿' +
      [COLUMNS, ...rows]
        .map((cells) => cells.map(csvCell).join(','))
        .join('\r\n');

    const filename = `payouts_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    logger.error('GET /api/projects/[id]/payouts/export failed', {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      component: 'api-payouts-export'
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
