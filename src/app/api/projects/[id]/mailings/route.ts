/**
 * @file: src/app/api/projects/[id]/mailings/route.ts
 * @description: API для управления рассылками проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma, MailingService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { MailingService } from '@/lib/services/mailing.service';
import type { CreateMailingInput } from '@/lib/services/mailing.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { db } from '@/lib/db';
import { z } from 'zod';
import { MailingStatus, MailingType } from '@prisma/client';

const createMailingSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(MailingType),
  segmentId: z.string().optional(),
  templateId: z.string().optional(),
  scheduledAt: z.string().optional(),
  messageText: z.string().optional(),
  messageHtml: z.string().optional(),
  statistics: z.record(z.any()).optional()
});

const getMailingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(20).optional(),
  type: z.nativeEnum(MailingType).optional(),
  status: z.nativeEnum(MailingStatus).optional(),
  search: z.string().optional()
});

// GET /api/projects/[id]/mailings - Получение списка рассылок
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

    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '20',
      type: url.searchParams.get('type') || undefined,
      status: url.searchParams.get('status') || undefined,
      search: url.searchParams.get('search') || undefined
    };

    const validated = getMailingsQuerySchema.parse(queryParams);

    // Используем существующий метод или создаем новый
    const mailings = await db.mailing.findMany({
      where: {
        projectId,
        ...(validated.type ? { type: validated.type } : {}),
        ...(validated.status ? { status: validated.status } : {}),
        ...(validated.search
          ? {
              name: { contains: validated.search, mode: 'insensitive' }
            }
          : {})
      },
      include: {
        segment: true,
        template: true,
        _count: {
          select: {
            recipients: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (validated.page - 1) * validated.pageSize,
      take: validated.pageSize
    });

    const total = await db.mailing.count({
      where: {
        projectId,
        ...(validated.type ? { type: validated.type } : {}),
        ...(validated.status ? { status: validated.status } : {}),
        ...(validated.search
          ? {
              name: { contains: validated.search, mode: 'insensitive' }
            }
          : {})
      }
    });

    return NextResponse.json({
      mailings,
      pagination: {
        page: validated.page,
        pageSize: validated.pageSize,
        total,
        totalPages: Math.ceil(total / validated.pageSize)
      }
    });
  } catch (error) {
    logger.error('Ошибка получения списка рассылок', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'GET'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные параметры запроса', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка получения рассылок' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/mailings - Создание новой рассылки
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
    const validatedData: z.infer<typeof createMailingSchema> =
      createMailingSchema.parse(body);

    const mailingPayload: CreateMailingInput = {
      projectId,
      name: validatedData.name,
      type: validatedData.type,
      segmentId: validatedData.segmentId,
      templateId: validatedData.templateId,
      scheduledAt: validatedData.scheduledAt
        ? new Date(validatedData.scheduledAt)
        : undefined,
      messageText: validatedData.messageText,
      messageHtml: validatedData.messageHtml,
      statistics: validatedData.statistics
    };

    const mailing = await MailingService.createMailing(mailingPayload);

    return NextResponse.json(mailing, { status: 201 });
  } catch (error) {
    logger.error('Ошибка создания рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'POST'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные рассылки', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка создания рассылки' },
      { status: 500 }
    );
  }
}
