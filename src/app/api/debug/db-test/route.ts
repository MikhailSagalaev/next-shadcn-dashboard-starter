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
        logger.info('Checking if BotFlow model exists');
        if (typeof db.botFlow !== 'undefined') {
          const botFlowsCount = await db.botFlow.count();
          dbStatus.tables.botFlows = botFlowsCount;
          logger.info('BotFlow table exists', { count: botFlowsCount });
        } else {
          dbStatus.tables.botFlowsError = 'BotFlow model is undefined';
          logger.error('BotFlow model is undefined');
        }
      } catch (botFlowError) {
        dbStatus.tables.botFlowsError =
          botFlowError instanceof Error
            ? botFlowError.message
            : 'Unknown error';
        logger.error('BotFlow table check failed', { error: botFlowError });
      }

      // Проверяем BotSession таблицу
      try {
        logger.info('Checking if BotSession model exists');
        if (typeof db.botSession !== 'undefined') {
          const botSessionsCount = await db.botSession.count();
          dbStatus.tables.botSessions = botSessionsCount;
          logger.info('BotSession table exists', { count: botSessionsCount });
        } else {
          dbStatus.tables.botSessionsError = 'BotSession model is undefined';
          logger.error('BotSession model is undefined');
        }
      } catch (botSessionError) {
        dbStatus.tables.botSessionsError =
          botSessionError instanceof Error
            ? botSessionError.message
            : 'Unknown error';
        logger.error('BotSession table check failed', {
          error: botSessionError
        });
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
