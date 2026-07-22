import { NextRequest, NextResponse } from 'next/server';
import { ProductMarkingStatus } from '@prisma/client';
import { z } from 'zod';
import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectService } from '@/lib/services/project.service';

const bulkUpdateSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    markingStatus: z.nativeEnum(ProductMarkingStatus).optional(),
    vatCode: z.number().int().min(1).max(12).nullable().optional()
  })
  .refine(
    (value) => value.markingStatus !== undefined || value.vatCode !== undefined,
    'Выберите хотя бы одно изменение'
  );

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const data = bulkUpdateSchema.parse(await request.json());
    const result = await db.product.updateMany({
      where: { projectId, id: { in: data.ids } },
      data: {
        ...(data.markingStatus === undefined
          ? {}
          : {
              markingStatus: data.markingStatus,
              paymentSubject:
                data.markingStatus === 'MARKED_REQUIRED'
                  ? 'marked'
                  : 'commodity'
            }),
        ...(data.vatCode === undefined ? {} : { vatCode: data.vatCode })
      }
    });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Проверьте параметры массового изменения' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Не удалось обновить выбранные товары' },
      { status: 500 }
    );
  }
}
