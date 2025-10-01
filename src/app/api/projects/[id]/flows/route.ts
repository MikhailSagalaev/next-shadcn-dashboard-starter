/**
 * @file: src/app/api/projects/[id]/flows/route.ts
 * @description: API для управления потоками бота в конструкторе
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotFlowService
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { BotFlowService } from '@/lib/services/bot-flow.service';
import { logger } from '@/lib/logger';
import type {
  CreateFlowRequest,
  UpdateFlowRequest
} from '@/types/bot-constructor';

// GET /api/projects/[id]/flows - Получение всех потоков проекта
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    logger.info('GET /api/projects/[id]/flows', { projectId });

    const flows = await BotFlowService.getFlowsByProject(projectId);

    return NextResponse.json({
      success: true,
      flows
    });
  } catch (error) {
    const { id: projectId } = await context.params;
    logger.error('Failed to get flows', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось получить список потоков'
      },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/flows - Создание нового потока
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const body: CreateFlowRequest = await request.json();

    logger.info('POST /api/projects/[id]/flows', {
      projectId,
      flowName: body.name
    });

    // Валидируем входные данные
    if (!body.name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Название потока обязательно'
        },
        { status: 400 }
      );
    }

    const flow = await BotFlowService.createFlow(projectId, body);

    return NextResponse.json({
      success: true,
      flow
    });
  } catch (error) {
    const { id: projectId } = await context.params;
    logger.error('Failed to create flow', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось создать поток'
      },
      { status: 500 }
    );
  }
}
