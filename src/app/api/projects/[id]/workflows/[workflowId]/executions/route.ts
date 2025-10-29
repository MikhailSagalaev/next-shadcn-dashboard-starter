/**
 * @file: src/app/api/projects/[id]/workflows/[workflowId]/executions/route.ts
 * @description: API для получения списка выполнений workflow проекта
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { WorkflowExecutionService } from '@/lib/services/workflow/execution-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> }
) {
  try {
    const { id: projectId, workflowId } = await params;
    const admin = await getCurrentAdmin();

    if (!admin?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page')) || undefined;
    const limit = Number(searchParams.get('limit')) || undefined;
    const statusParam = searchParams.get('status') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const dateFromParam = searchParams.get('dateFrom') || undefined;
    const dateToParam = searchParams.get('dateTo') || undefined;
    const search = searchParams.get('search') || undefined;

    const validStatuses = new Set(['running', 'waiting', 'completed', 'failed', 'cancelled']);
    const status = statusParam && validStatuses.has(statusParam) ? (statusParam as any) : undefined;

    const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
    const dateTo = dateToParam ? new Date(dateToParam) : undefined;

    const result = await WorkflowExecutionService.listExecutions(projectId, workflowId, {
      page,
      limit,
      status,
      userId,
      dateFrom: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
      dateTo: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined,
      search: search || undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow executions' }, { status: 500 });
  }
}


