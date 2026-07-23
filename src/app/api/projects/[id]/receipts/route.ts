import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ReceivingConflictError,
  ReceivingService
} from '@/lib/services/receiving.service';

const createSchema = z.object({
  supplierName: z.string().min(1),
  supplierInn: z.string().optional(),
  documentNumber: z.string().min(1),
  documentDate: z.coerce.date().optional(),
  source: z.enum(['MANUAL', 'UPD_XML', 'EDO']).optional(),
  expectedUnits: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        name: z.string().min(1),
        gtin: z.string().regex(/^\d{8,14}$/),
        expectedQuantity: z.number().int().positive(),
        unitCost: z.number().nonnegative().optional()
      })
    )
    .optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  return NextResponse.json({ receipts: await ReceivingService.list(id) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = createSchema.parse(await request.json());
    const receipt = await ReceivingService.create({
      projectId: id,
      supplierName: data.supplierName!,
      supplierInn: data.supplierInn,
      documentNumber: data.documentNumber!,
      documentDate: data.documentDate,
      source: data.source,
      expectedUnits: data.expectedUnits,
      notes: data.notes,
      items: data.items?.map((item) => ({
        productId: item.productId,
        name: item.name!,
        gtin: item.gtin!,
        expectedQuantity: item.expectedQuantity!,
        unitCost: item.unitCost
      }))
    });
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof ReceivingConflictError
          ? 409
          : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось создать приёмку'
      },
      { status }
    );
  }
}
