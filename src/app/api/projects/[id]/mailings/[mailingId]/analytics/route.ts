/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/analytics/route.ts
 * @description: API для получения аналитики рассылки
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

// GET /api/projects/[id]/mailings/[mailingId]/analytics - Получение аналитики рассылки
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

    const stats = await MailingService.getMailingStats(mailingId);

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('Ошибка получения аналитики рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'GET_ANALYTICS'
    });

    return NextResponse.json(
      { error: 'Ошибка получения аналитики рассылки' },
      { status: 500 }
    );
  }
}
