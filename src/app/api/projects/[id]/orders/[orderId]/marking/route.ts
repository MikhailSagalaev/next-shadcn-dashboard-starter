import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  MarkingConflictError,
  MarkingService
} from '@/lib/services/marking.service';

const scanSchema = z.object({
  orderItemId: z.string().min(1),
  code: z.string().min(16).max(512)
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, orderId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const data = scanSchema.parse(await request.json());
    const unit = await MarkingService.assignCode({
      projectId,
      orderId,
      orderItemId: data.orderItemId,
      code: data.code,
      scannedBy: admin.sub
    });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректный код' }, { status: 400 });
    }
    if (error instanceof MarkingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось сохранить код маркировки' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, orderId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const unitId = new URL(request.url).searchParams.get('unitId');
    if (!unitId)
      return NextResponse.json({ error: 'unitId обязателен' }, { status: 400 });
    await MarkingService.removeCode({ projectId, orderId, unitId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MarkingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось удалить код маркировки' },
      { status: 500 }
    );
  }
}
