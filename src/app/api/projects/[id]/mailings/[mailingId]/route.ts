/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/route.ts
 * @description: API для получения, обновления и удаления конкретной рассылки
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
import { z } from 'zod';

const updateMailingSchema = z.object({
  name: z.string().min(1).optional(),
  segmentId: z.string().optional(),
  templateId: z.string().optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
});

// GET /api/projects/[id]/mailings/[mailingId] - Получение рассылки
export async function GET(
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

    const mailing = await MailingService.getMailing(projectId, mailingId);

    if (!mailing) {
      return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
    }

    return NextResponse.json(mailing);
  } catch (error) {
    logger.error('Ошибка получения рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'GET',
    });

    return NextResponse.json(
      { error: 'Ошибка получения рассылки' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/mailings/[mailingId] - Обновление рассылки
export async function PUT(
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
    const validatedData = updateMailingSchema.parse(body);

    const mailing = await MailingService.updateMailing(projectId, mailingId, {
      ...validatedData,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
    });

    return NextResponse.json(mailing);
  } catch (error) {
    logger.error('Ошибка обновления рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'PUT',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные рассылки', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка обновления рассылки' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/mailings/[mailingId] - Удаление рассылки
export async function DELETE(
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

    await MailingService.deleteMailing(projectId, mailingId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'DELETE',
    });

    return NextResponse.json(
      { error: 'Ошибка удаления рассылки' },
      { status: 500 }
    );
  }
}

