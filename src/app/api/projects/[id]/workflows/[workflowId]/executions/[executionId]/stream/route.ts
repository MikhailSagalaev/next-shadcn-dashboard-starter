/**
 * @file: src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/stream/route.ts
 * @description: SSE поток обновлений выполнения workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { WorkflowExecutionService } from '@/lib/services/workflow/execution-service';

const STREAM_INTERVAL_MS = 2000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string; executionId: string }> }
) {
  const admin = await getCurrentAdmin();

  if (!admin?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, workflowId, executionId } = await params;

  const execution = await WorkflowExecutionService.getExecution(projectId, workflowId, executionId);
  if (!execution) {
    return NextResponse.json({ error: 'Workflow execution not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get('since');
  let lastTimestamp = sinceParam ? new Date(sinceParam) : undefined;
  if (lastTimestamp && Number.isNaN(lastTimestamp.getTime())) {
    lastTimestamp = undefined;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      sendEvent('execution', execution.execution);

      let active = true;

      const interval = setInterval(async () => {
        if (!active) {
          return;
        }

        try {
          const [status, logs] = await Promise.all([
            WorkflowExecutionService.getExecutionStatus(executionId),
            WorkflowExecutionService.getExecutionLogs(executionId, lastTimestamp)
          ]);

          if (status) {
            sendEvent('status', {
              id: status.id,
              status: status.status,
              currentNodeId: status.currentNodeId,
              waitType: status.waitType,
              waitPayload: status.waitPayload,
              stepCount: status.stepCount,
              error: status.error,
              finishedAt: status.finishedAt?.toISOString()
            });

            if (status.status === 'completed' || status.status === 'failed' || status.finishedAt) {
              active = false;
              clearInterval(interval);
              controller.close();
              return;
            }
          }

          if (logs.length > 0) {
            const formattedLogs = logs.map((log) => ({
              id: log.id.toString(),
              step: log.step,
              nodeId: log.nodeId,
              nodeType: log.nodeType,
              level: log.level,
              message: log.message,
              timestamp: log.timestamp.toISOString(),
              data: log.data ?? null
            }));

            sendEvent('logs', formattedLogs);
            lastTimestamp = logs[logs.length - 1].timestamp;
          }
        } catch (error) {
          console.error('Failed to stream workflow execution logs:', error);
          sendEvent('error', { message: 'Failed to fetch execution updates' });
        }
      }, STREAM_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        active = false;
        clearInterval(interval);
        controller.close();
      });
    },

    cancel() {
      // no-op
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}


