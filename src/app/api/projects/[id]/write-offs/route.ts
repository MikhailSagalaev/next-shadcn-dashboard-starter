import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import {
  ComplianceConflictError,
  ComplianceService
} from '@/lib/services/compliance.service';
import { ProjectService } from '@/lib/services/project.service';

const schema = z.object({
  reason: z.string().min(1),
  comment: z.string().max(2000).nullable().optional(),
  codes: z.array(z.string().min(16).max(512)).min(1).max(1000)
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  return NextResponse.json({
    documents: await ComplianceService.listWriteOffs(id)
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = schema.parse(await request.json());
    const document = await ComplianceService.createWriteOff({
      projectId: id,
      actorId: admin.sub,
      reason: data.reason!,
      comment: data.comment,
      codes: data.codes!
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка списания' },
      {
        status:
          error instanceof z.ZodError
            ? 400
            : error instanceof ComplianceConflictError
              ? 409
              : 500
      }
    );
  }
}
