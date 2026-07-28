import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ReceivingConflictError,
  ReceivingService
} from '@/lib/services/receiving.service';

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
    await request.json().catch(() => ({}));
    return NextResponse.json(
      await ReceivingService.accept({
        projectId: id,
        receiptId,
        actorId: admin.sub
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Приёмка не завершена'
      },
      {
        status: error instanceof ReceivingConflictError ? 409 : 500
      }
    );
  }
}
