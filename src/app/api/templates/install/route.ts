/**
 * @file: src/app/api/templates/install/route.ts
 * @description: API для установки шаблонов ботов в проекты
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesService
 * @created: 2025-10-01
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { botTemplates } from '@/lib/services/bot-templates/bot-templates.service';
import { logger } from '@/lib/logger';

// POST /api/templates/install - Установка шаблона в проект
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, projectId, userId, customName } = body;

    if (!templateId || !projectId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Не указаны обязательные параметры: templateId, projectId, userId'
        },
        { status: 400 }
      );
    }

    logger.info('POST /api/templates/install', {
      templateId,
      projectId,
      userId,
      customName
    });

    const result = await botTemplates.installTemplate({
      templateId,
      projectId,
      userId,
      customName
    });

    return NextResponse.json({
      success: true,
      flow: result.flow,
      message: 'Шаблон успешно установлен'
    });
  } catch (error) {
    logger.error('Failed to install template', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось установить шаблон'
      },
      { status: 500 }
    );
  }
}
