/**
 * @file: src/types/workflow-monitoring.ts
 * @description: Типы данных для мониторинга выполнения workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

export type WorkflowExecutionStatus = 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecutionSummary {
  id: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  userId?: string;
  telegramChatId?: string;
  currentNodeId?: string;
  waitType?: string;
  stepCount: number;
  error?: string;
}

export interface WorkflowExecutionListResponse {
  executions: WorkflowExecutionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WorkflowExecutionStep {
  id: string;
  step: number;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  message?: string;
  data?: any;
  variables?: Record<string, any>;
}

export interface WorkflowExecutionDetailsResponse {
  execution: WorkflowExecutionSummary & {
    workflowId: string;
    sessionId: string;
    waitPayload: any;
  };
  steps: WorkflowExecutionStep[];
  variables: Record<string, Record<string, any>>;
  waitPayload: any;
}

export interface WorkflowExecutionFilters {
  status?: WorkflowExecutionStatus;
  search?: string;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface WorkflowExecutionLogEntry {
  id: string;
  step: number;
  nodeId: string;
  nodeType: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  data?: any;
}

