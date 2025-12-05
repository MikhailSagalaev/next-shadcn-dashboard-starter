/**
 * API endpoint для очистки кэша workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowCache } from '@/lib/services/workflow-cache';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';
import { requireAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const admin = await requireAdmin(['SUPERADMIN', 'ADMIN']);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем projectId из query параметров (опционально)
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Очищаем кэш workflow
    workflowCache.clearAll();

    // Очищаем кэш WorkflowRuntimeService
    if (projectId) {
      await WorkflowRuntimeService.invalidateCache(projectId);
      logger.info('Workflow cache cleared for project', {
        adminId: admin.sub,
        projectId
      });
    } else {
      await WorkflowRuntimeService.clearAllCache();
      logger.info('All workflow caches cleared', { adminId: admin.sub });
    }

    return NextResponse.json({
      success: true,
      message: projectId
        ? `Workflow cache cleared for project ${projectId}`
        : 'All workflow caches cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear workflow cache', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
