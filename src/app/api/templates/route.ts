/**
 * @file: src/app/api/templates/route.ts
 * @description: API для работы с шаблонами ботов
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesService
 * @created: 2025-10-01
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { botTemplates } from '@/lib/services/bot-templates/bot-templates.service';
import { logger } from '@/lib/logger';

// GET /api/templates - Получение списка шаблонов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      category: searchParams.get('category') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    logger.info('GET /api/templates', { filters });

    const result = await botTemplates.getTemplates(filters);

    return NextResponse.json({
      success: true,
      templates: result.templates,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    logger.error('Failed to get templates', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось получить список шаблонов'
      },
      { status: 500 }
    );
  }
}
