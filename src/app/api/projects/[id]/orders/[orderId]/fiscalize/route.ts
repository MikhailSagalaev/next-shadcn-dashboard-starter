import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  MarkingConflictError,
  MarkingService
} from '@/lib/services/marking.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, orderId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const receipt = await MarkingService.queueSettlement({
      projectId,
      orderId
    });
    return NextResponse.json({ receipt }, { status: 202 });
  } catch (error) {
    if (error instanceof MarkingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось поставить чек в очередь' },
      { status: 500 }
    );
  }
}
