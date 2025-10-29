/**
 * @file: src/features/workflow/hooks/use-workflow-executions.ts
 * @description: Хук для загрузки списка выполнений workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

'use client';

import { useState, useCallback } from 'react';
import type {
  WorkflowExecutionListResponse,
  WorkflowExecutionSummary,
  WorkflowExecutionFilters
} from '@/types/workflow-monitoring';

interface UseWorkflowExecutionsResult {
  executions: WorkflowExecutionSummary[];
  pagination: WorkflowExecutionListResponse['pagination'] | null;
  loading: boolean;
  error: string | null;
  fetchExecutions: (filters?: WorkflowExecutionFilters) => Promise<void>;
}

export function useWorkflowExecutions(
  projectId: string,
  workflowId?: string
): UseWorkflowExecutionsResult {
  const [executions, setExecutions] = useState<WorkflowExecutionSummary[]>([]);
  const [pagination, setPagination] = useState<WorkflowExecutionListResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(
    async (override?: WorkflowExecutionFilters) => {
      if (!workflowId) {
        setExecutions([]);
        setPagination(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (override?.page) params.set('page', String(override.page));
        if (override?.status) params.set('status', override.status);
        if (override?.search) params.set('search', override.search.trim());
        if (override?.dateFrom) params.set('dateFrom', override.dateFrom);
        if (override?.dateTo) params.set('dateTo', override.dateTo);

        const response = await fetch(
          `/api/projects/${projectId}/workflows/${workflowId}/executions?${params.toString()}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Не удалось загрузить выполнения workflow');
        }

        const data: WorkflowExecutionListResponse = await response.json();
        setExecutions(data.executions);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Failed to fetch workflow executions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setExecutions([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [projectId, workflowId]
  );

  return {
    executions,
    pagination,
    loading,
    error,
    fetchExecutions
  };
}

