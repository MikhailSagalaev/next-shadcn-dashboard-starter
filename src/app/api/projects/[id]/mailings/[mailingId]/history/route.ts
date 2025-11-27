/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/history/route.ts
 * @description: API для получения истории событий рассылки
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

// GET /api/projects/[id]/mailings/[mailingId]/history - Получение истории рассылки
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const eventType = url.searchParams.get('eventType') || undefined;

    const history = await MailingService.getMailingHistory(mailingId, {
      limit,
      offset,
      eventType
    });

    return NextResponse.json({ history });
  } catch (error) {
    logger.error('Ошибка получения истории рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'GET_HISTORY'
    });

    return NextResponse.json(
      { error: 'Ошибка получения истории рассылки' },
      { status: 500 }
    );
  }
}
