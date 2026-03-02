/**
 * @file: route.ts
 * @description: Regenerate auth token for МойСклад Loyalty API integration
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { hashAuthToken } from '@/lib/moysklad-loyalty/auth';
import { logger } from '@/lib/logger';

// POST - Regenerate auth token
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    // Проверяем владельца проекта
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        ownerId: admin.sub
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Проверяем существование интеграции
    const existing = await db.moySkladIntegration.findUnique({
      where: { projectId }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Генерируем новый auth token
    const rawToken = `gupil_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const hashedToken = await hashAuthToken(rawToken);

    // Обновляем токен в БД
    await db.moySkladIntegration.update({
      where: { projectId },
      data: {
        authToken: hashedToken,
      }
    });

    logger.info('МойСклад auth token regenerated', {
      projectId,
      integrationId: existing.id,
    }, 'moysklad-integration');

    return NextResponse.json({
      success: true,
      authToken: rawToken, // Возвращаем незахешированный токен ОДИН РАЗ
      message: 'Токен успешно обновлен. Обновите его в настройках МойСклад.'
    });

  } catch (error) {
    logger.error('Error regenerating МойСклад auth token', { error }, 'moysklad-integration');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
