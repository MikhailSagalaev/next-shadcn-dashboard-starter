/**
 * API endpoint для очистки кэша workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowCache } from '@/lib/services/workflow-cache';
import { requireAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const admin = await requireAdmin(['SUPERADMIN', 'ADMIN']);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Очищаем весь кэш workflow
    workflowCache.clearAll();
    
    logger.info('Workflow cache cleared', { adminId: admin.sub });

    return NextResponse.json({
      success: true,
      message: 'Workflow cache cleared successfully'
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
