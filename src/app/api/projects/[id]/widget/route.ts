/**
 * @file: src/app/api/projects/[id]/widget/route.ts
 * @description: Публичный API для получения настроек виджета
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-01-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// CORS заголовки для публичного доступа
function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300' // Кэш на 5 минут
  };
}

// OPTIONS handler для CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: createCorsHeaders()
  });
}

// GET /api/projects/[id]/widget - Публичный endpoint для виджета
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    logger.info('GET /api/projects/[id]/widget запрос', {
      projectId,
      origin: request.headers.get('origin')
    });

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        operationMode: true,
        welcomeBonus: true,
        welcomeRewardType: true,
        firstPurchaseDiscountPercent: true,
        botUsername: true
      }
    });

    if (!project) {
      logger.warn('Проект не найден', { projectId });
      return NextResponse.json(
        {
          success: false,
          error: 'Проект не найден'
        },
        { status: 404, headers: createCorsHeaders() }
      );
    }

    // Получаем настройки виджета
    const widgetSettings = await db.widgetSettings.findUnique({
      where: { projectId }
    });

    // Если настроек нет, создаём дефолтные
    if (!widgetSettings) {
      logger.info('Настройки виджета не найдены, создаём дефолтные', {
        projectId
      });

      const defaultSettings = await db.widgetSettings.create({
        data: {
          projectId,
          productBadgeBonusPercent: project.welcomeBonus || 10
        }
      });

      return NextResponse.json(
        {
          success: true,
          ...defaultSettings,
          operationMode: project.operationMode,
          botUsername: project.botUsername,
          welcomeBonusAmount: Number(project.welcomeBonus),
          welcomeRewardType: project.welcomeRewardType,
          firstPurchaseDiscountPercent: project.firstPurchaseDiscountPercent
        },
        { headers: createCorsHeaders() }
      );
    }

    // Возвращаем настройки виджета
    const response = {
      success: true,
      ...widgetSettings,
      // Добавляем данные из проекта
      operationMode: project.operationMode,
      botUsername: project.botUsername,
      welcomeBonusAmount: Number(project.welcomeBonus),
      welcomeRewardType: project.welcomeRewardType,
      firstPurchaseDiscountPercent: project.firstPurchaseDiscountPercent
    };

    logger.info('Настройки виджета успешно загружены', {
      projectId,
      hasSettings: true
    });

    return NextResponse.json(response, { headers: createCorsHeaders() });
  } catch (error) {
    logger.error(
      'Ошибка получения настроек виджета',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-api'
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера'
      },
      { status: 500, headers: createCorsHeaders() }
    );
  }
}

// PUT /api/projects/[id]/widget - Обновление настроек виджета (требует аутентификации)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();

    logger.info('PUT /api/projects/[id]/widget запрос', {
      projectId,
      bodyKeys: Object.keys(body)
    });

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Обновляем или создаём настройки виджета
    const widgetSettings = await db.widgetSettings.upsert({
      where: { projectId },
      create: {
        projectId,
        ...body
      },
      update: body
    });

    logger.info('Настройки виджета обновлены', { projectId });

    return NextResponse.json({
      success: true,
      ...widgetSettings
    });
  } catch (error) {
    logger.error(
      'Ошибка обновления настроек виджета',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-api'
    );
    return NextResponse.json(
      { error: 'Ошибка обновления настроек виджета' },
      { status: 500 }
    );
  }
}
