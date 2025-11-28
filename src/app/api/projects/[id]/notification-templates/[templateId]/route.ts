/**
 * @file: src/app/api/projects/[id]/notification-templates/[templateId]/route.ts
 * @description: API для управления конкретным шаблоном уведомлений
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  buttons: z
    .array(
      z.object({
        text: z.string(),
        url: z.string().url().optional(),
        callback_data: z.string().optional()
      })
    )
    .optional(),
  parseMode: z.enum(['HTML', 'Markdown']).optional()
});

// GET /api/projects/[id]/notification-templates/[templateId] - Получить шаблон
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, templateId } = await context.params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const template = await db.notificationTemplate.findFirst({
      where: { id: templateId, projectId }
    });

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    logger.error('Ошибка получения шаблона уведомления', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'notification-templates-api'
    });
    return NextResponse.json(
      { error: 'Ошибка получения шаблона' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/notification-templates/[templateId] - Обновить шаблон
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, templateId } = await context.params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    const template = await db.notificationTemplate.update({
      where: { id: templateId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.message && { message: validated.message }),
        ...(validated.imageUrl !== undefined && {
          imageUrl: validated.imageUrl || null
        }),
        ...(validated.buttons !== undefined && { buttons: validated.buttons }),
        ...(validated.parseMode && { parseMode: validated.parseMode })
      }
    });

    logger.info('Шаблон уведомления обновлен', {
      templateId,
      projectId,
      component: 'notification-templates-api'
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Ошибка обновления шаблона уведомления', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'notification-templates-api'
    });
    return NextResponse.json(
      { error: 'Ошибка обновления шаблона' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/notification-templates/[templateId] - Удалить шаблон
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, templateId } = await context.params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    await db.notificationTemplate.delete({
      where: { id: templateId }
    });

    logger.info('Шаблон уведомления удален', {
      templateId,
      projectId,
      component: 'notification-templates-api'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления шаблона уведомления', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'notification-templates-api'
    });
    return NextResponse.json(
      { error: 'Ошибка удаления шаблона' },
      { status: 500 }
    );
  }
}
