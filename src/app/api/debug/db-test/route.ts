/**
 * @file: src/app/api/debug/db-test/route.ts
 * @description: Тестовый роут для диагностики проблем с базой данных
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
      environment: process.env.NODE_ENV || 'unknown',
      cwd: process.cwd(),
      memoryUsage: process.memoryUsage()
    };

    // Проверяем переменные окружения (без чувствительных данных)
    const envInfo = {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      databaseUrlPrefix:
        process.env.DATABASE_URL?.substring(0, 20) + '...' || 'not set'
    };

    // Простая проверка - можем ли мы импортировать db
    let dbImportStatus = 'unknown';
    let dbModelsStatus = 'unknown';
    let prismaVersion = 'unknown';

    try {
      logger.info('Attempting to import database client');
      const dbModule = await import('@/lib/db');

      if (dbModule && dbModule.db) {
        dbImportStatus = 'success';
        logger.info('Database client imported successfully');

        // Проверяем версию Prisma
        try {
          prismaVersion = await dbModule.db.$queryRaw`SELECT version()`;
          logger.info('Prisma version retrieved', { version: prismaVersion });
        } catch (versionError) {
          logger.warn('Could not get Prisma version', { error: versionError });
        }

        // Проверяем доступность моделей
        const db = dbModule.db;

        if (
          typeof db.botFlow !== 'undefined' &&
          typeof db.botSession !== 'undefined'
        ) {
          dbModelsStatus = 'models_available';
          logger.info('BotFlow and BotSession models are available');
        } else if (typeof db.botFlow !== 'undefined') {
          dbModelsStatus = 'botflow_only';
          logger.info('Only BotFlow model is available');
        } else if (typeof db.botSession !== 'undefined') {
          dbModelsStatus = 'botsession_only';
          logger.info('Only BotSession model is available');
        } else {
          dbModelsStatus = 'models_undefined';
          logger.error('BotFlow and BotSession models are undefined', {
            botFlowType: typeof db.botFlow,
            botSessionType: typeof db.botSession,
            availableModels: Object.keys(db).filter(
              (key) => key !== '$' && key !== '$$'
            )
          });
        }
      } else {
        dbImportStatus = 'import_failed_no_db';
        logger.error('Database module imported but no db object found');
      }
    } catch (importError) {
      dbImportStatus = 'import_failed';
      logger.error('Failed to import database client', { error: importError });
    }

    // Проверяем таблицу проектов (самая базовая)
    let projectsTableStatus = 'unknown';
    try {
      if (dbImportStatus === 'success') {
        const { db } = await import('@/lib/db');
        if (typeof db.project !== 'undefined') {
          projectsTableStatus = 'available';
          logger.info('Project model is available');
        } else {
          projectsTableStatus = 'project_model_undefined';
          logger.error('Project model is undefined');
        }
      }
    } catch (projectError) {
      projectsTableStatus = 'project_check_failed';
      logger.error('Project model check failed', { error: projectError });
    }

    return NextResponse.json({
      success: true,
      data: {
        serverInfo,
        envInfo,
        dbImportStatus,
        dbModelsStatus,
        prismaVersion,
        projectsTableStatus
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
