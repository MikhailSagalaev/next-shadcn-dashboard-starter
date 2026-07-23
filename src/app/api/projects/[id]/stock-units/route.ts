import { NextRequest, NextResponse } from 'next/server';
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
  const units = await db.markedUnit.findMany({
    where: {
      projectId: id,
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { gtin: { contains: search } },
              { serial: { contains: search } },
              { product: { name: { contains: search, mode: 'insensitive' } } }
            ]
          }
        : {})
    },
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
      goodsReceiptItem: {
        select: {
          goodsReceipt: {
            select: { id: true, documentNumber: true, supplierName: true }
          }
        }
      }
    },
    orderBy: { scannedAt: 'desc' },
    take: 500
  });
  const stockUnits = units.map((unit) => ({
    ...unit,
    createdAt: unit.scannedAt,
    receivedAt: unit.availableAt ?? unit.scannedAt,
    maskedCode: unit.serial ? `••••${unit.serial.slice(-6)}` : 'Код сохранён',
    quarantineReason: unit.discrepancies[0]?.message ?? null,
    receipt: unit.goodsReceiptItem?.goodsReceipt ?? null,
    discrepancies: undefined,
    goodsReceiptItem: undefined
  }));
  return NextResponse.json({
    stockUnits,
    units: stockUnits,
    items: stockUnits
  });
}
