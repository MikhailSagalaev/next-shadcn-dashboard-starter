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

    // Проверяем подключение к БД
    const dbStatus = {
      connected: false,
      tables: {}
    };

    try {
      // Тестируем подключение к БД
      await db.$connect();
      dbStatus.connected = true;

      // Проверяем существующие таблицы
      const projectsCount = await db.project.count();
      const usersCount = await db.user.count();

      dbStatus.tables = {
        projects: projectsCount,
        users: usersCount
      };

      // Проверяем BotFlow таблицу
      try {
        const botFlowsCount = await db.botFlow.count();
        dbStatus.tables.botFlows = botFlowsCount;
      } catch (botFlowError) {
        dbStatus.tables.botFlowsError =
          botFlowError instanceof Error
            ? botFlowError.message
            : 'Unknown error';
      }

      // Проверяем BotSession таблицу
      try {
        const botSessionsCount = await db.botSession.count();
        dbStatus.tables.botSessions = botSessionsCount;
      } catch (botSessionError) {
        dbStatus.tables.botSessionsError =
          botSessionError instanceof Error
            ? botSessionError.message
            : 'Unknown error';
      }
    } catch (connectionError) {
      dbStatus.connectionError =
        connectionError instanceof Error
          ? connectionError.message
          : 'Unknown error';
    }

    return NextResponse.json({
      success: true,
      data: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Database connection failed',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
