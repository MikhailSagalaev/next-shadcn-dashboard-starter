/**
 * @file: src/app/api/templates/route.ts
 * @description: API для работы с шаблонами ботов
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesService
 * @created: 2025-10-01
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  botTemplates,
  type BotTemplateCategory,
  type TemplateFilter
} from '@/lib/services/bot-templates/bot-templates.service';
const logger: any = { info: console.log, error: console.error };

// GET /api/templates - Получение списка шаблонов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Валидация category
    const categoryParam = searchParams.get('category');
    let category: BotTemplateCategory | undefined;
    if (categoryParam) {
      const validCategories: BotTemplateCategory[] = [
        'customer_support',
        'ecommerce',
        'lead_generation',
        'booking',
        'survey',
        'education',
        'entertainment',
        'utility',
        'marketing',
        'hr'
      ];
      if (validCategories.includes(categoryParam as BotTemplateCategory)) {
        category = categoryParam as BotTemplateCategory;
      }
    }

    // Валидация difficulty
    const difficultyParam = searchParams.get('difficulty');
    let difficulty: 'beginner' | 'intermediate' | 'advanced' | undefined;
    if (
      difficultyParam &&
      ['beginner', 'intermediate', 'advanced'].includes(difficultyParam)
    ) {
      difficulty = difficultyParam as 'beginner' | 'intermediate' | 'advanced';
    }

    const filters: TemplateFilter = {
      category,
      difficulty,
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
