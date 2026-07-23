import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  RefundConflictError,
  RefundService
} from '@/lib/services/refund.service';

const schema = z.object({
  reason: z.string().min(3).max(250),
  unitIds: z.array(z.string()).min(1).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, orderId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = schema.parse(await request.json());
    const receipt = await RefundService.queue({
      projectId: id,
      orderId,
      reason: data.reason!,
      unitIds: data.unitIds
    });
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка возврата' },
      {
        status:
          error instanceof z.ZodError
            ? 400
            : error instanceof RefundConflictError
              ? 409
              : 500
      }
    );
  }
}
