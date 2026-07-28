import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  ComplianceGatewayConflictError,
  ComplianceGatewayService
} from '@/lib/services/compliance-gateway.service';

const schema = z.object({
  externalId: z.string().min(3).max(200),
  confirmed: z.literal(true)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, documentId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const data = schema.parse(await request.json());
    return NextResponse.json({
      document: await ComplianceGatewayService.confirmManualDocument({
        projectId: id,
        documentId,
        externalId: data.externalId,
        actorId: admin.sub
      })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Подтвердите действие и укажите внешний номер документа' },
        { status: 400 }
      );
    }
    if (error instanceof ComplianceGatewayConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось подтвердить документ' },
      { status: 500 }
    );
  }
}
