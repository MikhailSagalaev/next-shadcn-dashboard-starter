/**
 * @file: src/hooks/use-api-query.ts
 * @description: Универсальный хук для API запросов с автоматической загрузкой и обработкой ошибок
 * @project: SaaS Bonus System
 * @dependencies: react, use-toast
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

export interface UseApiQueryOptions<TData = any> {
  endpoint: string;
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  showErrorToast?: boolean;
  errorMessage?: string;
}

export interface UseApiQueryResult<TData = any> {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useApiQuery<TData = any>({
  endpoint,
  enabled = true,
  refetchInterval,
  onSuccess,
  onError,
  showErrorToast = true,
  errorMessage = 'Не удалось загрузить данные'
}: UseApiQueryOptions<TData>): UseApiQueryResult<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(endpoint);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || errorMessage);
      }

      const result: TData = await response.json();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(errorMessage);
      setError(errorObj);

      if (showErrorToast) {
        toast({
          title: 'Ошибка загрузки',
          description: errorObj.message,
          variant: 'destructive'
        });
      }

      onError?.(errorObj);
    } finally {
      setLoading(false);
    }
  }, [
    endpoint,
    enabled,
    errorMessage,
    onSuccess,
    onError,
    showErrorToast,
    toast
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
