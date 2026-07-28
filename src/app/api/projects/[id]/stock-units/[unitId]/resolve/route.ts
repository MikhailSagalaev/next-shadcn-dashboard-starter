import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  StockUnitResolutionConflictError,
  StockUnitResolutionService
} from '@/lib/services/stock-unit-resolution.service';

const schema = z.object({
  action: z.enum([
    'RELEASE_TO_STOCK',
    'RETURN_TO_SUPPLIER',
    'WRITE_OFF',
    'REMARK'
  ]),
  comment: z.string().min(3).max(2000),
  newCode: z.string().optional(),
  writeOffReason: z
    .enum([
      'DAMAGE',
      'LOSS',
      'DESTRUCTION',
      'EXPIRED',
      'OWN_USE',
      'PRODUCTION_USE',
      'OTHER'
    ])
    .optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, unitId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = schema.parse(await request.json());
    return NextResponse.json(
      await StockUnitResolutionService.resolve({
        projectId: id,
        unitId,
        actorId: admin.sub,
        action: data.action,
        comment: data.comment,
        newCode: data.newCode,
        writeOffReason: data.writeOffReason
      }),
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Проверьте действие, комментарий и Data Matrix' },
        { status: 400 }
      );
    }
    if (error instanceof StockUnitResolutionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка карантина' },
      { status: 500 }
    );
  }
}
