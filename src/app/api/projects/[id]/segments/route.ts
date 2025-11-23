/**
 * @file: src/app/api/projects/[id]/segments/route.ts
 * @description: API для управления сегментами проекта
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

const createSegmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rules: z.any(), // SegmentRule | SegmentRule[]
  type: z.enum(['MANUAL', 'AUTO', 'DYNAMIC']).optional(),
  isActive: z.boolean().optional()
});

const getSegmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(20).optional(),
  type: z.enum(['MANUAL', 'AUTO', 'DYNAMIC']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional()
});

// GET /api/projects/[id]/segments - Получение списка сегментов
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим query параметры
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '20',
      type: url.searchParams.get('type') || undefined,
      isActive: url.searchParams.get('isActive') || undefined,
      search: url.searchParams.get('search') || undefined
    };

    // Валидация
    const validated = getSegmentsQuerySchema.parse(queryParams);

    // Получаем сегменты
    const segments = await SegmentationService.getProjectSegments(projectId, {
      page: validated.page,
      pageSize: validated.pageSize,
      type: validated.type as any,
      isActive: validated.isActive,
      search: validated.search
    });

    return NextResponse.json(segments);
  } catch (error) {
    logger.error('Ошибка получения списка сегментов', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'GET'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные параметры запроса', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка получения сегментов' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/segments - Создание нового сегмента
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим тело запроса
    const body = await request.json();

    // Валидация данных
    const validatedData = createSegmentSchema.parse(body);

    // Создаем сегмент
    const segment = await SegmentationService.createSegment({
      projectId,
      name: validatedData.name,
      description: validatedData.description,
      rules: validatedData.rules,
      type: validatedData.type,
      isActive: validatedData.isActive
    });

    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    logger.error('Ошибка создания сегмента', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'segments-api',
      action: 'POST'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные сегмента', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка создания сегмента' },
      { status: 500 }
    );
  }
}
