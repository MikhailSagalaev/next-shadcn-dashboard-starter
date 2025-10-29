/**
 * @file: src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/route.ts
 * @description: API для получения детальной информации о выполнении workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { WorkflowExecutionService } from '@/lib/services/workflow/execution-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string; executionId: string }> }
) {
  try {
    const { id: projectId, workflowId, executionId } = await params;
    const admin = await getCurrentAdmin();

    if (!admin?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const execution = await WorkflowExecutionService.getExecution(projectId, workflowId, executionId);

    if (!execution) {
      return NextResponse.json({ error: 'Workflow execution not found' }, { status: 404 });
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error fetching workflow execution details:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow execution details' }, { status: 500 });
  }
}


