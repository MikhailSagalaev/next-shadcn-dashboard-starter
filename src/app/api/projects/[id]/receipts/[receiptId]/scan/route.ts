import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ReceivingConflictError,
  ReceivingService
} from '@/lib/services/receiving.service';

const schema = z.object({
  code: z.string().min(16).max(512),
  productId: z.string().optional()
});

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
    const data = schema.parse(await request.json());
    const unit = await ReceivingService.scan({
      projectId: id,
      receiptId,
      actorId: admin.sub,
      code: data.code!,
      productId: data.productId
    });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Код не принят' },
      {
        status:
          error instanceof z.ZodError
            ? 400
            : error instanceof ReceivingConflictError
              ? 409
              : 500
      }
    );
  }
}
