import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import {
  ComplianceConflictError,
  ComplianceService
} from '@/lib/services/compliance.service';
import { ProjectService } from '@/lib/services/project.service';

const schema = z.object({
  provider: z.enum(['MANUAL', 'CUSTOM_GATEWAY']),
  isActive: z.boolean(),
  gatewayUrl: z.string().url().optional(),
  credential: z.string().min(8).optional()
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
    integration: await ComplianceService.getIntegration(id)
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
    return NextResponse.json({
      integration: await ComplianceService.saveIntegration({
        projectId: id,
        provider: data.provider!,
        isActive: data.isActive!,
        gatewayUrl: data.gatewayUrl,
        credential: data.credential
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка настройки' },
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
