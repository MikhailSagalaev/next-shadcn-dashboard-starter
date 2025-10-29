/**
 * @file: src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/restart/route.ts
 * @description: API для перезапуска выполнения workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { WorkflowExecutionService } from '@/lib/services/workflow/execution-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string; executionId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, workflowId, executionId } = await params;
    const body = await request.json().catch(() => ({}));

    const { fromNodeId, resetVariables, skipCompleted } = body || {};

    return await WorkflowExecutionService.restartExecution(projectId, workflowId, executionId, {
      fromNodeId: typeof fromNodeId === 'string' ? fromNodeId : undefined,
      resetVariables: Boolean(resetVariables),
      skipCompleted: Boolean(skipCompleted)
    });
  } catch (error) {
    console.error('Error restarting workflow execution:', error);
    return NextResponse.json({ error: 'Failed to restart workflow execution' }, { status: 500 });
  }
}


