/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/start/route.ts
 * @description: API для запуска рассылки
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

// POST /api/projects/[id]/mailings/[mailingId]/start - Запуск рассылки
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

    await MailingService.startMailing(projectId, mailingId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Ошибка запуска рассылки', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'START'
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Ошибка запуска рассылки'
      },
      { status: 500 }
    );
  }
}
