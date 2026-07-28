import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  OrderDisposalConflictError,
  OrderDisposalService
} from '@/lib/services/order-disposal.service';
import { ComplianceGatewayConflictError } from '@/lib/services/compliance-gateway.service';
import { MarkingConflictError } from '@/lib/services/marking.service';

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
    const result = await OrderDisposalService.completeSale({
      projectId,
      orderId,
      actorId: admin.sub
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (
      error instanceof OrderDisposalConflictError ||
      error instanceof ComplianceGatewayConflictError ||
      error instanceof MarkingConflictError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось запустить оформление продажи' },
      { status: 500 }
    );
  }
}
