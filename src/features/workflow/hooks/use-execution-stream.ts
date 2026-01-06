/**
 * @file: src/features/workflow/hooks/use-execution-stream.ts
 * @description: Hook для подключения к SSE потоку выполнения workflow
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ExecutionStatus {
  id: string;
  status: 'running' | 'waiting' | 'completed' | 'failed';
  currentNodeId?: string;
  waitType?: string;
  waitPayload?: any;
  stepCount?: number;
  error?: string;
  finishedAt?: string;
}

interface ExecutionLog {
  id: string;
  step: number;
  nodeId: string;
  nodeType: string;
  level: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface UseExecutionStreamOptions {
  projectId: string;
  workflowId: string;
  executionId: string;
  enabled?: boolean;
  onStatusChange?: (status: ExecutionStatus) => void;
  onNewLogs?: (logs: ExecutionLog[]) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

interface UseExecutionStreamResult {
  status: ExecutionStatus | null;
  logs: ExecutionLog[];
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export function useExecutionStream({
  projectId,
  workflowId,
  executionId,
  enabled = true,
  onStatusChange,
  onNewLogs,
  onError,
  onComplete
}: UseExecutionStreamOptions): UseExecutionStreamResult {
  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !executionId) return;

    disconnect();
    setIsLoading(true);
    setError(null);

    const url = `/api/projects/${projectId}/workflows/${workflowId}/executions/${executionId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsLoading(false);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.addEventListener('execution', (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data);
        onStatusChange?.(data);
      } catch (e) {
        console.error('Failed to parse execution event:', e);
      }
    });

    eventSource.addEventListener('status', (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data);
        onStatusChange?.(data);

        // Если выполнение завершено, закрываем соединение
        if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.finishedAt
        ) {
          onComplete?.();
          disconnect();
        }
      } catch (e) {
        console.error('Failed to parse status event:', e);
      }
    });

    eventSource.addEventListener('logs', (event) => {
      try {
        const newLogs: ExecutionLog[] = JSON.parse(event.data);
        setLogs((prev) => {
          // Добавляем только новые логи
          const existingIds = new Set(prev.map((l) => l.id));
          const uniqueNewLogs = newLogs.filter((l) => !existingIds.has(l.id));
          return [...prev, ...uniqueNewLogs];
        });
        onNewLogs?.(newLogs);
      } catch (e) {
        console.error('Failed to parse logs event:', e);
      }
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        const err = new Error(data.message || 'Stream error');
        setError(err);
        onError?.(err);
      } catch {
        // Это может быть ошибка соединения, а не событие error
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      setIsLoading(false);

      // Пытаемся переподключиться с exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay =
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(
          `SSE connection lost, reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        const err = new Error('Failed to connect after maximum retry attempts');
        setError(err);
        onError?.(err);
      }
    };
  }, [
    enabled,
    executionId,
    projectId,
    workflowId,
    disconnect,
    onStatusChange,
    onNewLogs,
    onError,
    onComplete
  ]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    logs,
    isConnected,
    isLoading,
    error,
    reconnect,
    disconnect
  };
}
