/**
 * @file: src/app/api/projects/[id]/notification-templates/route.ts
 * @description: API для управления шаблонами расширенных уведомлений
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

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  message: z.string().min(1, 'Сообщение обязательно'),
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
  parseMode: z.enum(['HTML', 'Markdown']).default('HTML')
});

// GET /api/projects/[id]/notification-templates - Получить все шаблоны
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
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const templates = await db.notificationTemplate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(templates);
  } catch (error) {
    logger.error('Ошибка получения шаблонов уведомлений', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'notification-templates-api'
    });
    return NextResponse.json(
      { error: 'Ошибка получения шаблонов' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/notification-templates - Создать шаблон
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
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const template = await db.notificationTemplate.create({
      data: {
        projectId,
        name: validated.name,
        message: validated.message,
        imageUrl: validated.imageUrl || null,
        buttons: validated.buttons || null,
        parseMode: validated.parseMode
      }
    });

    logger.info('Шаблон уведомления создан', {
      templateId: template.id,
      projectId,
      component: 'notification-templates-api'
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Ошибка создания шаблона уведомления', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'notification-templates-api'
    });
    return NextResponse.json(
      { error: 'Ошибка создания шаблона' },
      { status: 500 }
    );
  }
}
