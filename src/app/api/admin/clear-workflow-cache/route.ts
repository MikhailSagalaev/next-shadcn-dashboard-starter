/**
 * API endpoint для очистки кэша workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowCache } from '@/lib/services/workflow-cache';

export async function POST(request: NextRequest) {
  try {
    // Очищаем весь кэш workflow
    workflowCache.clearAll();
    
    console.log('✅ Workflow cache cleared');

    return NextResponse.json({
      success: true,
      message: 'Workflow cache cleared successfully'
    });
  } catch (error) {
    console.error('Failed to clear workflow cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

