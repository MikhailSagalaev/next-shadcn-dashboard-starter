/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/repeat/route.ts
 * @description: API для повторения (клонирования) рассылки
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma
 * @created: 2025-11-26
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { db } from '@/lib/db';
import { z } from 'zod';

const repeatSchema = z.object({
  name: z.string().min(1).optional(),
  scheduledAt: z.string().optional(),
  sendImmediately: z.boolean().default(false)
});

// POST /api/projects/[id]/mailings/[mailingId]/repeat - Повторить рассылку
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; mailingId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, mailingId } = await context.params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const validated = repeatSchema.parse(body);

    // Получаем оригинальную рассылку
    const originalMailing = await db.mailing.findFirst({
      where: { id: mailingId, projectId },
      include: {
        segment: true,
        template: true
      }
    });

    if (!originalMailing) {
      return NextResponse.json(
        { error: 'Рассылка не найдена' },
        { status: 404 }
      );
    }

    // Создаем клон рассылки
    const cloneName = validated.name || `${originalMailing.name} (копия)`;

    const newMailing = await db.mailing.create({
      data: {
        projectId,
        name: cloneName,
        type: originalMailing.type,
        segmentId: originalMailing.segmentId,
        templateId: originalMailing.templateId,
        messageText: originalMailing.messageText,
        messageHtml: originalMailing.messageHtml,
        status: validated.sendImmediately ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: validated.scheduledAt
          ? new Date(validated.scheduledAt)
          : validated.sendImmediately
            ? new Date()
            : null,
        clonedFromId: mailingId,
        statistics: {}
      },
      include: {
        segment: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } }
      }
    });

    logger.info('Рассылка успешно повторена', {
      originalMailingId: mailingId,
      newMailingId: newMailing.id,
      projectId,
      component: 'mailing-repeat-api'
    });

    return NextResponse.json(
      {
        success: true,
        mailing: newMailing,
        message: validated.sendImmediately
          ? 'Рассылка запланирована к отправке'
          : 'Копия рассылки создана как черновик'
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Ошибка повторения рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailing-repeat-api'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка повторения рассылки' },
      { status: 500 }
    );
  }
}
