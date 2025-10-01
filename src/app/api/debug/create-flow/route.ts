/**
 * @file: src/app/api/debug/create-flow/route.ts
 * @description: Debug API для тестирования создания потоков
 * @project: SaaS Bonus System
 * @created: 2025-10-01
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { BotFlowService } from '@/lib/services/bot-flow.service';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, name, description } = body;

    logger.info('DEBUG: Create flow request', {
      projectId,
      name,
      description,
      body
    });

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    logger.info('DEBUG: Project check', {
      projectId,
      projectExists: !!project,
      projectName: project?.name
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
          debug: { projectId }
        },
        { status: 404 }
      );
    }

    // Проверяем подключение к БД
    const testQuery = await db.botFlow.count();
    logger.info('DEBUG: DB connection test', { botFlowCount: testQuery });

    // Создаем поток
    const result = await BotFlowService.createFlow(projectId, {
      name,
      description: description || 'Test flow'
    });

    logger.info('DEBUG: Flow created successfully', {
      flowId: result.id,
      flowName: result.name
    });

    return NextResponse.json({
      success: true,
      flow: result,
      debug: {
        projectId,
        projectName: project.name,
        botFlowCount: testQuery
      }
    });
  } catch (error) {
    logger.error('DEBUG: Create flow failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          errorType: error?.constructor?.name,
          hasStack: error instanceof Error && !!error.stack
        }
      },
      { status: 500 }
    );
  }
}
