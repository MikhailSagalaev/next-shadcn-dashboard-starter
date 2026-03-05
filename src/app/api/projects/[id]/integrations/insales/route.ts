/**
 * @file: route.ts
 * @description: Admin API для управления InSales интеграцией
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { encryptApiToken } from '@/lib/moysklad/encryption';
import crypto from 'crypto';
import type {
  CreateInSalesIntegrationRequest,
  UpdateInSalesIntegrationRequest
} from '@/lib/insales/types';

// GET - Получить настройки интеграции
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Получаем интеграцию
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Не возвращаем зашифрованный пароль
    const { apiPassword, ...safeIntegration } = integration;

    return NextResponse.json({
      success: true,
      integration: {
        ...safeIntegration,
        hasApiPassword: !!apiPassword
      }
    });
  } catch (error) {
    logger.error(
      'Error getting InSales integration',
      { error },
      'insales-admin-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Создать интеграцию
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Проверяем, не существует ли уже интеграция
    const existingIntegration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (existingIntegration) {
      return NextResponse.json(
        { error: 'Integration already exists' },
        { status: 400 }
      );
    }

    // Парсим body
    const body: CreateInSalesIntegrationRequest = await request.json();

    // Валидация
    if (!body.apiKey || !body.apiPassword || !body.shopDomain) {
      return NextResponse.json(
        { error: 'API Key, API Password and Shop Domain are required' },
        { status: 400 }
      );
    }

    // Генерируем webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Шифруем API Password
    const encryptedPassword = encryptApiToken(body.apiPassword);

    // Создаем интеграцию
    const integration = await db.inSalesIntegration.create({
      data: {
        projectId,
        apiKey: body.apiKey,
        apiPassword: encryptedPassword,
        shopDomain: body.shopDomain,
        webhookSecret,
        bonusPercent: body.bonusPercent || 10,
        maxBonusSpend: body.maxBonusSpend || 50,
        widgetEnabled: true,
        showProductBadges: true,
        isActive: false // Активируется вручную
      }
    });

    logger.info(
      'InSales integration created',
      {
        projectId,
        shopDomain: body.shopDomain
      },
      'insales-admin-api'
    );

    // Не возвращаем зашифрованный пароль
    const { apiPassword: _, ...safeIntegration } = integration;

    return NextResponse.json({
      success: true,
      integration: safeIntegration,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/insales/webhook/${projectId}`
    });
  } catch (error) {
    logger.error(
      'Error creating InSales integration',
      { error },
      'insales-admin-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Обновить интеграцию
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Проверяем существование интеграции
    const existingIntegration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!existingIntegration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Парсим body
    const body: UpdateInSalesIntegrationRequest = await request.json();

    // Подготавливаем данные для обновления
    const updateData: any = {};

    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey;
    if (body.shopDomain !== undefined) updateData.shopDomain = body.shopDomain;
    if (body.bonusPercent !== undefined)
      updateData.bonusPercent = body.bonusPercent;
    if (body.maxBonusSpend !== undefined)
      updateData.maxBonusSpend = body.maxBonusSpend;
    if (body.widgetEnabled !== undefined)
      updateData.widgetEnabled = body.widgetEnabled;
    if (body.showProductBadges !== undefined)
      updateData.showProductBadges = body.showProductBadges;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Если обновляется пароль, шифруем его
    if (body.apiPassword) {
      updateData.apiPassword = encryptApiToken(body.apiPassword);
    }

    // Обновляем интеграцию
    const integration = await db.inSalesIntegration.update({
      where: { projectId },
      data: updateData
    });

    logger.info(
      'InSales integration updated',
      {
        projectId,
        updatedFields: Object.keys(updateData)
      },
      'insales-admin-api'
    );

    // Не возвращаем зашифрованный пароль
    const { apiPassword: _, ...safeIntegration } = integration;

    return NextResponse.json({
      success: true,
      integration: safeIntegration
    });
  } catch (error) {
    logger.error(
      'Error updating InSales integration',
      { error },
      'insales-admin-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Удалить интеграцию
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем владельца проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Удаляем интеграцию
    await db.inSalesIntegration.delete({
      where: { projectId }
    });

    logger.info(
      'InSales integration deleted',
      { projectId },
      'insales-admin-api'
    );

    return NextResponse.json({
      success: true,
      message: 'Integration deleted'
    });
  } catch (error) {
    logger.error(
      'Error deleting InSales integration',
      { error },
      'insales-admin-api'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
