import { NextRequest, NextResponse } from 'next/server';
import type { MarkedUnitStatus, Prisma } from '@prisma/client';
import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectService } from '@/lib/services/project.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('pageSize')) || 25)
  );
  const where: Prisma.MarkedUnitWhereInput = {
    projectId: id,
    ...(status ? { status: status as MarkedUnitStatus } : {}),
    ...(search
      ? {
          OR: [
            { gtin: { contains: search } },
            { serial: { contains: search } },
            {
              product: {
                is: { name: { contains: search, mode: 'insensitive' } }
              }
            }
          ]
        }
      : {})
  };
  const [units, total, available, reserved, quarantine] = await Promise.all([
    db.markedUnit.findMany({
      where,
      select: {
        id: true,
        gtin: true,
        serial: true,
        status: true,
        scannedAt: true,
        availableAt: true,
        reservedAt: true,
        soldAt: true,
        returnedAt: true,
        quarantinedAt: true,
        product: { select: { id: true, name: true, sku: true, gtin: true } },
        order: { select: { id: true, orderNumber: true } },
        discrepancies: {
          where: { resolvedAt: null },
          select: { message: true },
          take: 1
        },
        holds: {
          where: { status: { in: ['OPEN', 'PENDING_EXTERNAL'] } },
          select: {
            id: true,
            source: true,
            status: true,
            resolution: true,
            reason: true,
            resolutionComment: true,
            complianceDocument: {
              select: {
                id: true,
                kind: true,
                status: true,
                documentNumber: true,
                externalId: true,
                lastError: true,
                outboxEntries: {
                  select: { id: true, status: true, lastError: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            }
          },
          take: 1
        },
        goodsReceiptItem: {
          select: {
            goodsReceipt: {
              select: { id: true, documentNumber: true, supplierName: true }
            }
          }
        }
      },
      orderBy: { scannedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.markedUnit.count({ where }),
    db.markedUnit.count({ where: { projectId: id, status: 'AVAILABLE' } }),
    db.markedUnit.count({ where: { projectId: id, status: 'RESERVED' } }),
    db.markedUnit.count({ where: { projectId: id, status: 'QUARANTINED' } })
  ]);
  const stockUnits = units.map((unit) => ({
    ...unit,
    createdAt: unit.scannedAt,
    receivedAt: unit.availableAt ?? unit.scannedAt,
    maskedCode: unit.serial ? `••••${unit.serial.slice(-6)}` : 'Код сохранён',
    quarantineReason:
      unit.holds[0]?.reason ?? unit.discrepancies[0]?.message ?? null,
    hold: unit.holds[0] ?? null,
    receipt: unit.goodsReceiptItem?.goodsReceipt ?? null,
    discrepancies: undefined,
    goodsReceiptItem: undefined,
    holds: undefined
  }));
  return NextResponse.json({
    stockUnits,
    units: stockUnits,
    items: stockUnits,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    },
    summary: {
      available,
      reserved,
      quarantine,
      total: await db.markedUnit.count({ where: { projectId: id } })
    }
  });
}
