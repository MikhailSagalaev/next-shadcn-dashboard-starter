import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ReceivingConflictError,
  ReceivingService
} from '@/lib/services/receiving.service';

const resolutionSchema = z.object({
  discrepancyId: z.string().min(1),
  resolution: z.enum([
    'ACCEPTED',
    'RETURN_TO_SUPPLIER',
    'CORRECTED_DOCUMENT',
    'WRITE_OFF',
    'IGNORED'
  ]),
  comment: z.string().max(2000).optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, receiptId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    return NextResponse.json({
      receipt: await ReceivingService.get(id, receiptId)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Приёмка не найдена' },
      { status: error instanceof ReceivingConflictError ? 404 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, receiptId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = resolutionSchema.parse(await request.json());
    const discrepancy = await ReceivingService.resolveDiscrepancy({
      projectId: id,
      receiptId,
      actorId: admin.sub,
      discrepancyId: data.discrepancyId!,
      resolution: data.resolution!,
      comment: data.comment
    });
    return NextResponse.json({ discrepancy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка сохранения' },
      { status: error instanceof z.ZodError ? 400 : 409 }
    );
  }
}
