/**
 * @file: src/app/api/projects/[id]/mailings/history/route.ts
 * @description: API для истории рассылок с детальной аналитикой
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
import { MailingStatus, MailingType } from '@prisma/client';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.nativeEnum(MailingType).optional(),
  status: z.nativeEnum(MailingStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional()
});

// GET /api/projects/[id]/mailings/history - История рассылок с аналитикой
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
      dateFrom: url.searchParams.get('dateFrom') || undefined,
      dateTo: url.searchParams.get('dateTo') || undefined,
      search: url.searchParams.get('search') || undefined
    };

    const validated = querySchema.parse(queryParams);

    // Формируем условия фильтрации
    const where: any = {
      projectId,
      status: { in: ['SENT', 'COMPLETED', 'FAILED'] as MailingStatus[] }
    };

    if (validated.type) {
      where.type = validated.type;
    }

    if (validated.status) {
      where.status = validated.status;
    }

    if (validated.dateFrom) {
      where.sentAt = { ...where.sentAt, gte: new Date(validated.dateFrom) };
    }

    if (validated.dateTo) {
      where.sentAt = { ...where.sentAt, lte: new Date(validated.dateTo) };
    }

    if (validated.search) {
      where.name = { contains: validated.search, mode: 'insensitive' };
    }

    // Получаем рассылки с агрегированной аналитикой
    const mailings = await db.mailing.findMany({
      where,
      include: {
        segment: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        recipients: {
          select: {
            status: true,
            openedAt: true,
            clickedAt: true,
            openCount: true,
            clickCount: true
          }
        },
        _count: {
          select: {
            recipients: true,
            linkClicks: true
          }
        }
      },
      orderBy: { sentAt: 'desc' },
      skip: (validated.page - 1) * validated.pageSize,
      take: validated.pageSize
    });

    // Вычисляем аналитику для каждой рассылки
    const mailingsWithAnalytics = mailings.map((mailing) => {
      const recipients = mailing.recipients;
      const totalRecipients = recipients.length;
      const sentCount = recipients.filter(
        (r) => r.status === 'SENT' || r.status === 'DELIVERED'
      ).length;
      const deliveredCount = recipients.filter(
        (r) => r.status === 'DELIVERED'
      ).length;
      const openedCount = recipients.filter((r) => r.openedAt !== null).length;
      const clickedCount = recipients.filter(
        (r) => r.clickedAt !== null
      ).length;
      const failedCount = recipients.filter(
        (r) => r.status === 'FAILED'
      ).length;
      const bouncedCount = recipients.filter(
        (r) => r.status === 'BOUNCED'
      ).length;

      const totalOpens = recipients.reduce((sum, r) => sum + r.openCount, 0);
      const totalClicks = recipients.reduce((sum, r) => sum + r.clickCount, 0);

      return {
        id: mailing.id,
        name: mailing.name,
        type: mailing.type,
        status: mailing.status,
        segment: mailing.segment,
        template: mailing.template,
        scheduledAt: mailing.scheduledAt,
        sentAt: mailing.sentAt,
        completedAt: mailing.completedAt,
        createdAt: mailing.createdAt,
        analytics: {
          totalRecipients,
          sent: sentCount,
          delivered: deliveredCount,
          opened: openedCount,
          clicked: clickedCount,
          failed: failedCount,
          bounced: bouncedCount,
          totalOpens,
          totalClicks,
          openRate:
            totalRecipients > 0
              ? Math.round((openedCount / totalRecipients) * 100)
              : 0,
          clickRate:
            totalRecipients > 0
              ? Math.round((clickedCount / totalRecipients) * 100)
              : 0,
          clickToOpenRate:
            openedCount > 0
              ? Math.round((clickedCount / openedCount) * 100)
              : 0,
          deliveryRate:
            totalRecipients > 0
              ? Math.round((deliveredCount / totalRecipients) * 100)
              : 0
        }
      };
    });

    const total = await db.mailing.count({ where });

    // Общая статистика по всем рассылкам проекта
    const overallStats = await db.mailingRecipient.aggregate({
      where: {
        mailing: { projectId }
      },
      _count: { id: true },
      _sum: {
        openCount: true,
        clickCount: true
      }
    });

    const totalMailings = await db.mailing.count({
      where: { projectId, status: { in: ['SENT', 'COMPLETED'] } }
    });

    return NextResponse.json({
      mailings: mailingsWithAnalytics,
      pagination: {
        page: validated.page,
        pageSize: validated.pageSize,
        total,
        totalPages: Math.ceil(total / validated.pageSize)
      },
      overallStats: {
        totalMailings,
        totalRecipients: overallStats._count.id,
        totalOpens: overallStats._sum.openCount || 0,
        totalClicks: overallStats._sum.clickCount || 0
      }
    });
  } catch (error) {
    logger.error('Ошибка получения истории рассылок', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-history-api'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные параметры запроса', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка получения истории рассылок' },
      { status: 500 }
    );
  }
}
