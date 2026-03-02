/**
 * @file: route.ts
 * @description: API endpoints for МойСклад Loyalty API integration management
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { hashAuthToken } from '@/lib/moysklad-loyalty/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const IntegrationSchema = z.object({
  bonusPercentage: z.number().min(0).max(100),
  maxBonusSpend: z.number().min(0).max(100),
  isActive: z.boolean(),
});

// POST - Create integration
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

    if (existing) {
      return NextResponse.json(
        { error: 'Integration already exists' },
        { status: 409 }
      );
    }

    // Парсим и валидируем body
    const body = await request.json();
    const validation = IntegrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { bonusPercentage, maxBonusSpend, isActive } = validation.data;

    // Генерируем уникальный auth token
    const rawToken = `gupil_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const hashedToken = await hashAuthToken(rawToken);

    // Генерируем base URL
    const baseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://gupil.ru'}/api/moysklad-loyalty/${projectId}`;

    // Создаем интеграцию
    const integration = await db.moySkladIntegration.create({
      data: {
        projectId,
        authToken: hashedToken,
        baseUrl,
        bonusPercentage,
        maxBonusSpend,
        isActive,
      }
    });

    logger.info('МойСклад integration created', {
      projectId,
      integrationId: integration.id,
      isActive,
    }, 'moysklad-integration');

    return NextResponse.json({
      success: true,
      authToken: rawToken, // Возвращаем незахешированный токен ОДИН РАЗ
      baseUrl,
      integration: {
        id: integration.id,
        bonusPercentage: integration.bonusPercentage,
        maxBonusSpend: integration.maxBonusSpend,
        isActive: integration.isActive,
      }
    }, { status: 201 });

  } catch (error) {
    logger.error('Error creating МойСклад integration', { error }, 'moysklad-integration');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update integration
export async function PUT(
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

    // Парсим и валидируем body
    const body = await request.json();
    const validation = IntegrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { bonusPercentage, maxBonusSpend, isActive } = validation.data;

    // Обновляем интеграцию
    const integration = await db.moySkladIntegration.update({
      where: { projectId },
      data: {
        bonusPercentage,
        maxBonusSpend,
        isActive,
      }
    });

    logger.info('МойСклад integration updated', {
      projectId,
      integrationId: integration.id,
      isActive,
    }, 'moysklad-integration');

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        bonusPercentage: integration.bonusPercentage,
        maxBonusSpend: integration.maxBonusSpend,
        isActive: integration.isActive,
      }
    });

  } catch (error) {
    logger.error('Error updating МойСклад integration', { error }, 'moysklad-integration');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
