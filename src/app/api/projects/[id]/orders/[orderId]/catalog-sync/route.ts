import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  MarkingConflictError,
  MarkingService
} from '@/lib/services/marking.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, orderId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const result = await MarkingService.syncOrderFromCatalog({
      projectId,
      orderId
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MarkingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось обновить реквизиты заказа из каталога' },
      { status: 500 }
    );
  }
}
