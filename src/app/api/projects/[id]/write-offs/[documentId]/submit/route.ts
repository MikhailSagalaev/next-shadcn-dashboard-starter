import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import {
  ComplianceConflictError,
  ComplianceService
} from '@/lib/services/compliance.service';
import { ProjectService } from '@/lib/services/project.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, documentId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const document = await ComplianceService.submitWriteOff(id, documentId);
    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка отправки' },
      { status: error instanceof ComplianceConflictError ? 409 : 500 }
    );
  }
}
