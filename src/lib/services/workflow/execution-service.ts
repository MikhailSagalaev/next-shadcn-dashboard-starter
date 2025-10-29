/**
 * @file: src/lib/services/workflow/execution-service.ts
 * @description: Сервис для работы с выполнениями workflow (история, детали, перезапуски)
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import { ExecutionContextManager } from '@/lib/services/workflow/execution-context-manager';
import type {
  WorkflowConnection,
  WorkflowNode,
  WorkflowVersion
} from '@/types/workflow';
import type {
  WorkflowExecution as PrismaWorkflowExecution,
  WorkflowLog as PrismaWorkflowLog,
  WorkflowVariable as PrismaWorkflowVariable,
  WorkflowVersion as PrismaWorkflowVersion
} from '@prisma/client';

export interface ExecutionListParams {
  page?: number;
  limit?: number;
  status?: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface RestartExecutionOptions {
  fromNodeId?: string;
  resetVariables?: boolean;
  skipCompleted?: boolean;
}

type ExecutionStatus = 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export class WorkflowExecutionService {
  /**
   * Возвращает список выполнений workflow с пагинацией и фильтрами
   */
  static async listExecutions(
    projectId: string,
    workflowId: string,
    params: ExecutionListParams
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;

    const whereClause: any = {
      projectId,
      workflowId
    };

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.userId) {
      whereClause.userId = params.userId;
    }

    if (params.dateFrom || params.dateTo) {
      whereClause.startedAt = {};
      if (params.dateFrom) {
        whereClause.startedAt.gte = params.dateFrom;
      }
      if (params.dateTo) {
        whereClause.startedAt.lte = params.dateTo;
      }
    }

    if (params.search) {
      const searchValue = params.search.trim();
      whereClause.OR = [
        { sessionId: { contains: searchValue, mode: 'insensitive' as const } },
        { telegramChatId: { contains: searchValue, mode: 'insensitive' as const } }
      ];
    }

    const [executions, total] = await Promise.all([
      db.workflowExecution.findMany({
        where: whereClause,
        orderBy: {
          startedAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.workflowExecution.count({ where: whereClause })
    ]);

    const formatted = executions.map((execution) => WorkflowExecutionService.formatExecutionSummary(execution));

    return {
      executions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  /**
   * Возвращает детальную информацию о выполнении workflow
   */
  static async getExecution(
    projectId: string,
    workflowId: string,
    executionId: string
  ) {
    const execution = await db.workflowExecution.findFirst({
      where: {
        id: executionId,
        projectId,
        workflowId
      }
    });

    if (!execution) {
      return null;
    }

    const [logs, variables] = await Promise.all([
      db.workflowLog.findMany({
        where: { executionId },
        orderBy: [{ step: 'asc' }, { timestamp: 'asc' }]
      }),
      db.workflowVariable.findMany({
        where: {
          projectId,
          sessionId: execution.sessionId
        }
      })
    ]);

    const steps = WorkflowExecutionService.transformLogsToSteps(logs);
    const variablesByScope = WorkflowExecutionService.groupVariablesByScope(variables);

    return {
      execution: WorkflowExecutionService.formatExecutionDetails(execution),
      steps,
      variables: variablesByScope,
      waitPayload: execution.waitPayload ?? null
    };
  }

  /**
   * Возвращает список логов после указанного момента времени (для SSE)
   */
  static async getExecutionLogs(
    executionId: string,
    since?: Date
  ) {
    return db.workflowLog.findMany({
      where: {
        executionId,
        ...(since ? { timestamp: { gt: since } } : {})
      },
      orderBy: [{ timestamp: 'asc' }]
    });
  }

  /**
   * Возвращает текущее состояние выполнения
   */
  static async getExecutionStatus(executionId: string) {
    return db.workflowExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        status: true,
        currentNodeId: true,
        waitType: true,
        waitPayload: true,
        stepCount: true,
        error: true,
        finishedAt: true
      }
    });
  }

  /**
   * Перезапуск выполнения workflow
   */
  static async restartExecution(
    projectId: string,
    workflowId: string,
    executionId: string,
    options: RestartExecutionOptions
  ) {
    const execution = await db.workflowExecution.findFirst({
      where: {
        id: executionId,
        projectId,
        workflowId
      }
    });

    if (!execution) {
      return NextResponse.json({ error: 'Workflow execution not found' }, { status: 404 });
    }

    const versionRecord = await db.workflowVersion.findFirst({
      where: {
        workflowId,
        version: execution.version
      },
      include: {
        workflow: true
      }
    });

    if (!versionRecord) {
      return NextResponse.json({ error: 'Workflow version not found' }, { status: 404 });
    }

    const formattedVersion = WorkflowExecutionService.buildWorkflowVersion(versionRecord);

    if (!formattedVersion.entryNodeId && !options.fromNodeId) {
      return NextResponse.json({ error: 'Entry node is not defined for workflow version' }, { status: 400 });
    }

    const startNodeId = options.fromNodeId || formattedVersion.entryNodeId!;

    await db.$transaction(async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'running',
          error: null,
          finishedAt: null,
          startedAt: new Date(),
          stepCount: 0,
          currentNodeId: startNodeId,
          waitType: null,
          waitPayload: null
        }
      });

      if (options.resetVariables) {
        await tx.workflowVariable.deleteMany({
          where: {
            projectId,
            sessionId: execution.sessionId
          }
        });
      }
    });

    const context = await ExecutionContextManager.resumeContext(executionId);
    const processor = new SimpleWorkflowProcessor(formattedVersion, projectId);

    // Перезапуск выполняем асинхронно, чтобы не держать запрос
    processor.resumeWorkflow(context, startNodeId).catch(async (error) => {
      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    });

    return NextResponse.json({ success: true });
  }

  private static formatExecutionSummary(execution: PrismaWorkflowExecution) {
    const finishedAt = execution.finishedAt ?? undefined;
    const duration = finishedAt ? finishedAt.getTime() - execution.startedAt.getTime() : undefined;

    return {
      id: execution.id,
      status: execution.status as ExecutionStatus,
      startedAt: execution.startedAt.toISOString(),
      finishedAt: finishedAt?.toISOString(),
      duration,
      userId: execution.userId ?? undefined,
      telegramChatId: execution.telegramChatId ?? undefined,
      currentNodeId: execution.currentNodeId ?? undefined,
      waitType: execution.waitType ?? undefined,
      stepCount: execution.stepCount ?? 0,
      error: execution.error ?? undefined
    };
  }

  private static formatExecutionDetails(execution: PrismaWorkflowExecution) {
    return {
      ...WorkflowExecutionService.formatExecutionSummary(execution),
      workflowId: execution.workflowId,
      sessionId: execution.sessionId,
      waitPayload: execution.waitPayload ?? null
    };
  }

  private static groupVariablesByScope(variables: PrismaWorkflowVariable[]) {
    const result: Record<string, Record<string, any>> = {
      global: {},
      project: {},
      user: {},
      session: {}
    };

    for (const variable of variables) {
      const scope = variable.scope || 'session';
      if (!result[scope]) {
        result[scope] = {};
      }
      result[scope][variable.key] = variable.value;
    }

    return result;
  }

  private static transformLogsToSteps(logs: PrismaWorkflowLog[]) {
    interface StepAggregation {
      id: string;
      step: number;
      nodeId: string;
      nodeType: string;
      nodeLabel?: string;
      startedAt: Date;
      completedAt?: Date;
      status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
      lastMessage?: string;
      data?: any;
      variables?: Record<string, any>;
    }

    const map = new Map<string, StepAggregation>();

    for (const log of logs) {
      const key = `${log.step}-${log.nodeId}`;
      const existing = map.get(key) ?? {
        id: log.id.toString(),
        step: log.step,
        nodeId: log.nodeId,
        nodeType: log.nodeType,
        startedAt: log.timestamp,
        status: 'running' as const
      };

      existing.lastMessage = log.message;

      const logData = (typeof log.data === 'object' && log.data !== null
        ? (log.data as Record<string, any>)
        : null);

      if (logData) {
        existing.data = logData;
        if (logData.nodeLabel && !existing.nodeLabel) {
          existing.nodeLabel = logData.nodeLabel;
        }
        if (logData.variables) {
          existing.variables = { ...(existing.variables || {}), ...logData.variables };
        }
      }

      if (!existing.nodeType && log.nodeType) {
        existing.nodeType = log.nodeType;
      }

      if (log.level === 'error') {
        existing.status = 'error';
        existing.completedAt = log.timestamp;
      } else if (log.message?.toLowerCase().includes('completed') || log.level === 'info') {
        existing.status = existing.status === 'error' ? 'error' : 'completed';
        existing.completedAt = log.timestamp;
      }

      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => a.step - b.step)
      .map((step) => ({
        id: step.id,
        step: step.step,
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        nodeLabel: step.nodeLabel,
        status: step.status,
        startedAt: step.startedAt.toISOString(),
        completedAt: step.completedAt?.toISOString(),
        duration: step.completedAt ? step.completedAt.getTime() - step.startedAt.getTime() : undefined,
        message: step.lastMessage,
        data: step.data ?? null,
        variables: step.variables ?? undefined
      }));
  }

  private static buildWorkflowVersion(versionRecord: PrismaWorkflowVersion & { workflow?: { connections?: any } }): WorkflowVersion {
    const nodesSourceRaw = versionRecord.nodes as unknown;
    const nodesSource = typeof nodesSourceRaw === 'string'
      ? JSON.parse(nodesSourceRaw)
      : nodesSourceRaw;
    const nodes: Record<string, WorkflowNode> = Array.isArray(nodesSource)
      ? nodesSource.reduce((acc: Record<string, WorkflowNode>, node: WorkflowNode) => {
          acc[node.id] = node;
          return acc;
        }, {})
      : (nodesSource as Record<string, WorkflowNode>);

    const connectionsSourceRaw = versionRecord.workflow?.connections ?? (versionRecord as any).connections;
    const parsedConnections = typeof connectionsSourceRaw === 'string'
      ? JSON.parse(connectionsSourceRaw)
      : connectionsSourceRaw;
    const connections: WorkflowConnection[] = Array.isArray(parsedConnections)
      ? parsedConnections
      : [];

    return {
      id: versionRecord.id,
      workflowId: versionRecord.workflowId,
      version: versionRecord.version,
      nodes,
      entryNodeId: versionRecord.entryNodeId,
      connections,
      variables: versionRecord.variables as any,
      settings: versionRecord.settings as any,
      isActive: versionRecord.isActive,
      createdAt: versionRecord.createdAt
    } as WorkflowVersion;
  }
}


