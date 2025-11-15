/**
 * @file: src/app/api/projects/[id]/segments/[segmentId]/members/route.ts
 * @description: API для получения и управления участниками сегмента
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

const addMemberSchema = z.object({
  userId: z.string().min(1),
});

// GET /api/projects/[id]/segments/[segmentId]/members - Получение участников сегмента
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

    // Получаем участников сегмента
    const members = await SegmentationService.getSegmentMembers(projectId, segmentId);

    return NextResponse.json(members);
  } catch (error) {
    logger.error('Ошибка получения участников сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'GET',
    });

    return NextResponse.json(
      { error: 'Ошибка получения участников сегмента' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/segments/[segmentId]/members - Добавление участника в сегмент
export async function POST(
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
    const validatedData = addMemberSchema.parse(body);

    // Добавляем участника
    await SegmentationService.addMemberToSegment(projectId, segmentId, validatedData.userId);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    logger.error('Ошибка добавления участника в сегмент', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'POST',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка добавления участника в сегмент' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/segments/[segmentId]/members?userId=xxx - Удаление участника из сегмента
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

    // Парсим query параметры
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Параметр userId обязателен' },
        { status: 400 }
      );
    }

    // Удаляем участника
    await SegmentationService.removeMemberFromSegment(projectId, segmentId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления участника из сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'DELETE',
    });

    return NextResponse.json(
      { error: 'Ошибка удаления участника из сегмента' },
      { status: 500 }
    );
  }
}

