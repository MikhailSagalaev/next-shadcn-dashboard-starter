/**
 * @file: src/app/api/templates/[templateId]/route.ts
 * @description: API для управления конкретным шаблоном
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesService
 * @created: 2025-10-21
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { botTemplates } from '@/lib/services/bot-templates/bot-templates.service';
import { getCurrentAdmin } from '@/lib/auth';

const logger: any = { info: console.log, error: console.error };

// GET /api/templates/[templateId] - Получить шаблон по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;

    const template = await botTemplates.getTemplateById(templateId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Failed to get template', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось получить шаблон'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[templateId] - Удалить шаблон (только для администраторов)
// TODO: Implement deleteTemplate method in BotTemplatesService
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    // Проверяем аутентификацию
    const admin = await getCurrentAdmin();
    if (!admin?.sub) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId } = await params;

    logger.info('DELETE /api/templates/[templateId]', {
      templateId,
      adminId: admin.sub
    });

    // Проверяем существование шаблона
    const template = await botTemplates.getTemplateById(templateId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    // TODO: Implement deletion logic
    return NextResponse.json(
      { success: false, error: 'Удаление шаблонов пока не реализовано' },
      { status: 501 }
    );
  } catch (error) {
    logger.error('Failed to delete template', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось удалить шаблон'
      },
      { status: 500 }
    );
  }
}
