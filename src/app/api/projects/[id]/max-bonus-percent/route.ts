/**
 * @file: src/app/api/projects/[id]/max-bonus-percent/route.ts
 * @description: Публичный API для получения максимального процента начисления бонусов (используется виджетом)
 * @project: SaaS Bonus System
 * @dependencies: Prisma, BonusLevelService
 * @created: 2026-01-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BonusLevelService } from '@/lib/services/bonus-level.service';

// Публичный endpoint - не требует аутентификации
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    // Получаем проект
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        bonusPercentage: true
      }
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Проект не найден'
        },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
    }

    // Получаем активные уровни бонусов
    const bonusLevels = await BonusLevelService.getBonusLevels(projectId);

    let maxPercent = Number(project.bonusPercentage);

    // Если есть активные уровни, берём максимальный процент из них
    if (bonusLevels && bonusLevels.length > 0) {
      const maxLevelPercent = Math.max(
        ...bonusLevels.map((level) => Number(level.bonusPercent))
      );
      maxPercent = Math.max(maxPercent, maxLevelPercent);
    }

    return NextResponse.json(
      {
        success: true,
        maxBonusPercent: maxPercent
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=300' // Кэш на 5 минут
        }
      }
    );
  } catch (error) {
    console.error('Error getting max bonus percent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  }
}

// Обработка preflight запросов для CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
