/**
 * @file: src/app/api/debug/db-test/route.ts
 * @description: Тестовый роут для проверки подключения к БД и доступности моделей
 * @project: SaaS Bonus System
 * @created: 2025-10-01
 * @author: AI Assistant
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Testing database connection');

    // Базовая информация о сервере
    const serverInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'unknown'
    };

    // Проверяем переменные окружения (без чувствительных данных)
    const envInfo = {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0
    };

    // Простая проверка - можем ли мы импортировать db
    let dbImportStatus = 'unknown';
    let dbModelsStatus = 'unknown';

    try {
      const { db } = await import('@/lib/db');
      dbImportStatus = 'success';

      // Проверяем доступность моделей
      if (
        typeof db.botFlow !== 'undefined' &&
        typeof db.botSession !== 'undefined'
      ) {
        dbModelsStatus = 'models_available';
      } else if (typeof db.botFlow !== 'undefined') {
        dbModelsStatus = 'botflow_only';
      } else if (typeof db.botSession !== 'undefined') {
        dbModelsStatus = 'botsession_only';
      } else {
        dbModelsStatus = 'models_undefined';
      }

      logger.info('Database models check completed', {
        dbImportStatus,
        dbModelsStatus,
        botFlowType: typeof db.botFlow,
        botSessionType: typeof db.botSession
      });
    } catch (importError) {
      dbImportStatus = 'import_failed';
      logger.error('Failed to import database client', { error: importError });
    }

    return NextResponse.json({
      success: true,
      data: {
        serverInfo,
        envInfo,
        dbImportStatus,
        dbModelsStatus
      },
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
