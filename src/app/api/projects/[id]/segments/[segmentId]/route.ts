/**
 * @file: src/app/api/projects/[id]/segments/[segmentId]/route.ts
 * @description: API для получения, обновления и удаления конкретного сегмента
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma, SegmentationService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { SegmentationService } from '@/lib/services/segmentation.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { z } from 'zod';

const updateSegmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rules: z.any().optional(),
  type: z.enum(['MANUAL', 'AUTO', 'DYNAMIC']).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/projects/[id]/segments/[segmentId] - Получение сегмента
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, segmentId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Получаем сегмент
    const segment = await SegmentationService.getSegment(projectId, segmentId);

    if (!segment) {
      return NextResponse.json({ error: 'Сегмент не найден' }, { status: 404 });
    }

    return NextResponse.json(segment);
  } catch (error) {
    logger.error('Ошибка получения сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'GET',
    });

    return NextResponse.json(
      { error: 'Ошибка получения сегмента' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/segments/[segmentId] - Обновление сегмента
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, segmentId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим тело запроса
    const body = await request.json();

    // Валидация данных
    const validatedData = updateSegmentSchema.parse(body);

    // Обновляем сегмент
    const segment = await SegmentationService.updateSegment(
      projectId,
      segmentId,
      validatedData
    );

    return NextResponse.json(segment);
  } catch (error) {
    logger.error('Ошибка обновления сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'PUT',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные сегмента', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка обновления сегмента' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/segments/[segmentId] - Удаление сегмента
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, segmentId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Удаляем сегмент
    await SegmentationService.deleteSegment(projectId, segmentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'DELETE',
    });

    return NextResponse.json(
      { error: 'Ошибка удаления сегмента' },
      { status: 500 }
    );
  }
}

