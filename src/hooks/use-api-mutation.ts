/**
 * @file: src/hooks/use-api-mutation.ts
 * @description: Универсальный хук для API мутаций с автоматической обработкой ошибок и toast
 * @project: SaaS Bonus System
 * @dependencies: react, use-toast
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { useToast } from './use-toast';

export interface UseApiMutationOptions<TData = any, TResult = any> {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export interface UseApiMutationResult<TData = any, TResult = any> {
  mutate: (data: TData) => Promise<TResult | undefined>;
  loading: boolean;
  error: Error | null;
  data: TResult | null;
  reset: () => void;
}

export function useApiMutation<TData = any, TResult = any>({
  endpoint,
  method = 'POST',
  onSuccess,
  onError,
  successMessage = 'Успешно выполнено',
  errorMessage = 'Произошла ошибка',
  showSuccessToast = true,
  showErrorToast = true
}: UseApiMutationOptions<TData, TResult>): UseApiMutationResult<
  TData,
  TResult
> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TResult | null>(null);
  const { toast } = useToast();

  const mutate = async (requestData: TData): Promise<TResult | undefined> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || errorMessage);
      }

      const result: TResult = await response.json();
      setData(result);

      if (showSuccessToast) {
        toast({
          title: 'Успех',
          description: successMessage
        });
      }

      onSuccess?.(result);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(errorMessage);
      setError(errorObj);

      if (showErrorToast) {
        toast({
          title: 'Ошибка',
          description: errorObj.message,
          variant: 'destructive'
        });
      }

      onError?.(errorObj);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return { mutate, loading, error, data, reset };
}
