import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ComplianceGatewayConflictError,
  ComplianceGatewayService
} from '@/lib/services/compliance-gateway.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    return NextResponse.json(
      await ComplianceGatewayService.syncIncomingUpd(id)
    );
  } catch (error) {
    if (error instanceof ComplianceGatewayConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Ошибка синхронизации'
      },
      { status: 502 }
    );
  }
}
