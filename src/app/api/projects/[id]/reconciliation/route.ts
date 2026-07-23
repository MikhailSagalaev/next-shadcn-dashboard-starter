import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ReconciliationService } from '@/lib/services/reconciliation.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  const runs = await ReconciliationService.list(id);
  return NextResponse.json({ runs, latest: runs[0] ?? null });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const reconciliation = await ReconciliationService.run(id, admin.sub);
    return NextResponse.json({ reconciliation }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка сверки' },
      { status: 500 }
    );
  }
}
