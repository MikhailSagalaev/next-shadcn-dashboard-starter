import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ReceivingConflictError,
  ReceivingService
} from '@/lib/services/receiving.service';

const schema = z.object({ documentConfirmed: z.boolean().optional() });

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
    const data = schema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(
      await ReceivingService.accept({
        projectId: id,
        receiptId,
        actorId: admin.sub,
        ...data
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Приёмка не завершена'
      },
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
