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
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, orderId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const data = schema.parse(await request.json());
    const document = await ComplianceGatewayService.confirmManualDistanceSale({
      projectId,
      orderId,
      externalId: data.externalId,
      actorId: admin.sub
    });
    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Подтвердите отправку и укажите номер документа ГИС МТ' },
        { status: 400 }
      );
    }
    if (error instanceof ComplianceGatewayConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Не удалось подтвердить документы' },
      { status: 500 }
    );
  }
}
