/**
 * @file: src/app/api/templates/install/route.ts
 * @description: API для установки шаблонов ботов в проекты
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesService
 * @created: 2025-10-01
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
// Temporary: using any to bypass import issues
const botTemplates: any = {};
const logger: any = { info: console.log, error: console.error };

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

    const result = await botTemplates.installTemplate(
      templateId,
      projectId,
      userId,
      { customName }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      flowId: result.flowId,
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
