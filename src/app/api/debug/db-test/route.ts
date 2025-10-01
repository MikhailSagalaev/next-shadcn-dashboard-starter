/**
 * @file: src/app/api/debug/db-test/route.ts
 * @description: Тестовый роут для проверки подключения к БД
 * @project: SaaS Bonus System
 * @created: 2025-10-01
 * @author: AI Assistant
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Testing database connection');

    // Тестируем подключение к БД
    const projectsCount = await db.project.count();
    const botFlowsCount = await db.botFlow.count();
    const usersCount = await db.user.count();

    // Тестируем конкретный проект
    const testProjectId = 'cmfa8oqx000019e372pk9547l';
    const project = await db.project.findUnique({
      where: { id: testProjectId },
      select: { id: true, name: true, createdAt: true }
    });

    const botFlows = await db.botFlow.findMany({
      where: { projectId: testProjectId },
      select: { id: true, name: true, createdAt: true }
    });

    return NextResponse.json({
      success: true,
      data: {
        projectsCount,
        botFlowsCount,
        usersCount,
        testProject: project,
        testProjectBotFlows: botFlows
      }
    });
  } catch (error) {
    logger.error('Database test failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Database connection failed'
      },
      { status: 500 }
    );
  }
}
