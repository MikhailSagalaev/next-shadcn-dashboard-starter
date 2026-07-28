import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ComplianceGatewayConflictError,
  retryComplianceOutbox
} from '@/lib/services/compliance-gateway.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, entryId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    return NextResponse.json({
      entry: await retryComplianceOutbox({ projectId: id, entryId })
    });
  } catch (error) {
    if (error instanceof ComplianceGatewayConflictError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Не удалось повторить отправку' },
      { status: 500 }
    );
  }
}
