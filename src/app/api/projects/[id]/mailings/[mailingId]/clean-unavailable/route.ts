/**
 * @file: src/app/api/projects/[id]/mailings/[mailingId]/clean-unavailable/route.ts
 * @description: API для очистки недействительных контактов Telegram (403/400) по результатам рассылки
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { MailingService } from '@/lib/services/mailing.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';

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

    const result = await MailingService.cleanUnavailableRecipients(
      projectId,
      mailingId
    );

    return NextResponse.json({
      success: true,
      cleanedCount: result.cleanedCount
    });
  } catch (error) {
    logger.error('Ошибка очистки недействительных контактов Telegram', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'mailings-api',
      action: 'CLEAN_UNAVAILABLE'
    });

    return NextResponse.json(
      { error: 'Ошибка очистки недействительных контактов' },
      { status: 500 }
    );
  }
}
