import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  RefundConflictError,
  RefundService
} from '@/lib/services/refund.service';

const schema = z.object({ code: z.string().min(16).max(500) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, orderId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = schema.parse(await request.json());
    return NextResponse.json({
      unit: await RefundService.identifyReturnedUnit({
        projectId: id,
        orderId,
        code: data.code
      })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Отсканируйте полный Data Matrix' },
        { status: 400 }
      );
    }
    if (error instanceof RefundConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось проверить упаковку' },
      { status: 500 }
    );
  }
}
