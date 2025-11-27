/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/repeat/route.ts
 * @description: API для повторной отправки рассылки
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma, MailingService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { MailingService } from '@/lib/services/mailing.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { db } from '@/lib/db';
import { z } from 'zod';

const repeatMailingSchema = z.object({
  segmentId: z.string().optional(),
  name: z.string().optional()
});

// POST /api/projects/[id]/mailings/[mailingId]/repeat - Повторная отправка рассылки
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
    const validatedData = repeatMailingSchema.parse(body);

    // Получаем оригинальную рассылку
    const originalMailing = await db.mailing.findFirst({
      where: {
        id: mailingId,
        projectId
      },
      include: {
        template: true
      }
    });

    if (!originalMailing) {
      return NextResponse.json(
        { error: 'Рассылка не найдена' },
        { status: 404 }
      );
    }

    // Создаем новую рассылку на основе оригинальной
    const newMailing = await db.mailing.create({
      data: {
        projectId,
        name: validatedData.name || `${originalMailing.name} (повтор)`,
        type: originalMailing.type,
        segmentId: validatedData.segmentId || originalMailing.segmentId,
        templateId: originalMailing.templateId,
        status: 'DRAFT',
        messageText: originalMailing.messageText,
        messageHtml: originalMailing.messageHtml,
        statistics: originalMailing.statistics,
        clonedFromId: originalMailing.id
      }
    });

    // Создаем запись в истории (используем SENT как тип события для клонирования)
    // Примечание: recipientId обязателен, но для события клонирования можно использовать первый получатель или пропустить
    // Пока пропускаем создание истории для клонирования, так как нет получателя

    logger.info('Рассылка клонирована для повторной отправки', {
      originalMailingId: mailingId,
      newMailingId: newMailing.id,
      projectId,
      component: 'mailings-api'
    });

    return NextResponse.json(newMailing, { status: 201 });
  } catch (error) {
    logger.error('Ошибка повторной отправки рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'REPEAT'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка повторной отправки рассылки' },
      { status: 500 }
    );
  }
}
