/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/analytics/route.ts
 * @description: API для детальной аналитики конкретной рассылки
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

// GET /api/projects/[id]/mailings/[mailingId]/analytics
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

    // Получаем рассылку с детальными данными
    const mailing = await db.mailing.findFirst({
      where: { id: mailingId, projectId },
      include: {
        segment: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, subject: true } },
        recipients: {
          select: {
            id: true,
            userId: true,
            email: true,
            phone: true,
            telegramId: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            openedAt: true,
            clickedAt: true,
            openCount: true,
            clickCount: true,
            error: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true
              }
            }
          },
          orderBy: { sentAt: 'desc' }
        },
        linkClicks: {
          select: {
            id: true,
            url: true,
            clickedAt: true,
            recipientId: true
          },
          orderBy: { clickedAt: 'desc' },
          take: 100
        }
      }
    });

    if (!mailing) {
      return NextResponse.json(
        { error: 'Рассылка не найдена' },
        { status: 404 }
      );
    }

    // Вычисляем детальную статистику
    const recipients = mailing.recipients;
    const totalRecipients = recipients.length;

    const statusBreakdown = {
      pending: recipients.filter((r) => r.status === 'PENDING').length,
      sent: recipients.filter((r) => r.status === 'SENT').length,
      delivered: recipients.filter((r) => r.status === 'DELIVERED').length,
      failed: recipients.filter((r) => r.status === 'FAILED').length,
      bounced: recipients.filter((r) => r.status === 'BOUNCED').length
    };

    const openedCount = recipients.filter((r) => r.openedAt !== null).length;
    const clickedCount = recipients.filter((r) => r.clickedAt !== null).length;
    const totalOpens = recipients.reduce((sum, r) => sum + r.openCount, 0);
    const totalClicks = recipients.reduce((sum, r) => sum + r.clickCount, 0);

    // Группируем клики по URL
    const clicksByUrl: Record<string, number> = {};
    mailing.linkClicks.forEach((click) => {
      clicksByUrl[click.url] = (clicksByUrl[click.url] || 0) + 1;
    });

    const topLinks = Object.entries(clicksByUrl)
      .map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Временная динамика открытий (по часам)
    const opensByHour: Record<string, number> = {};
    recipients.forEach((r) => {
      if (r.openedAt) {
        const hour = new Date(r.openedAt).toISOString().slice(0, 13);
        opensByHour[hour] = (opensByHour[hour] || 0) + 1;
      }
    });

    const openTimeline = Object.entries(opensByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // Временная динамика кликов
    const clicksByHour: Record<string, number> = {};
    mailing.linkClicks.forEach((click) => {
      const hour = new Date(click.clickedAt).toISOString().slice(0, 13);
      clicksByHour[hour] = (clicksByHour[hour] || 0) + 1;
    });

    const clickTimeline = Object.entries(clicksByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return NextResponse.json({
      mailing: {
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
        messageText: mailing.messageText,
        messageHtml: mailing.messageHtml
      },
      analytics: {
        summary: {
          totalRecipients,
          opened: openedCount,
          clicked: clickedCount,
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
            openedCount > 0 ? Math.round((clickedCount / openedCount) * 100) : 0
        },
        statusBreakdown,
        topLinks,
        openTimeline,
        clickTimeline
      },
      recipients: recipients.map((r) => ({
        id: r.id,
        user: r.user,
        email: r.email,
        phone: r.phone,
        telegramId: r.telegramId,
        status: r.status,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        openedAt: r.openedAt,
        clickedAt: r.clickedAt,
        openCount: r.openCount,
        clickCount: r.clickCount,
        error: r.error
      }))
    });
  } catch (error) {
    logger.error('Ошибка получения аналитики рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailing-analytics-api'
    });

    return NextResponse.json(
      { error: 'Ошибка получения аналитики рассылки' },
      { status: 500 }
    );
  }
}
