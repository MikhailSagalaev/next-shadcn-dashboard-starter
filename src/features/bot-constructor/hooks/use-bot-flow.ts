/**
 * @file: src/features/bot-constructor/hooks/use-bot-flow.ts
 * @description: Хук для управления потоками бота в конструкторе
 * @project: SaaS Bonus System
 * @dependencies: React, BotFlowService, API calls
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  BotFlow,
  CreateFlowRequest,
  UpdateFlowRequest
} from '@/types/bot-constructor';

export function useBotFlow(projectId: string) {
  const { toast } = useToast();

  // State
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<BotFlow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Load all flows for project
  const loadFlows = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/flows`);
      if (!response.ok) {
        throw new Error('Failed to load flows');
      }
      const data = await response.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error('Failed to load flows:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить список потоков',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  // Load specific flow
  const loadFlow = useCallback(
    async (flowId: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/projects/${projectId}/flows/${flowId}`
        );
        if (!response.ok) {
          throw new Error('Failed to load flow');
        }
        const data = await response.json();
        const flow = data.flow;
        if (flow && flow.projectId === projectId) {
          setCurrentFlow(flow);
          return flow;
        } else {
          throw new Error('Поток не найден');
        }
      } catch (error) {
        console.error('Failed to load flow:', error);
        toast({
          title: 'Ошибка загрузки',
          description: 'Не удалось загрузить поток',
          variant: 'destructive'
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, toast]
  );

  // Create new flow
  const createFlow = useCallback(
    async (data: CreateFlowRequest) => {
      try {
        setIsSaving(true);
        const response = await fetch(`/api/projects/${projectId}/flows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error('Failed to create flow');
        }

        const result = await response.json();
        const newFlow = result.flow;

        // Update local state
        setFlows((prev) => [...prev, newFlow]);
        setCurrentFlow(newFlow);

        toast({
          title: 'Поток создан',
          description: `Поток "${newFlow.name}" успешно создан`
        });

        return newFlow;
      } catch (error) {
        console.error('Failed to create flow:', error);
        toast({
          title: 'Ошибка создания',
          description: 'Не удалось создать поток',
          variant: 'destructive'
        });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, toast]
  );

  // Update existing flow
  const updateFlow = useCallback(
    async (flowId: string, data: UpdateFlowRequest) => {
      try {
        setIsSaving(true);
        const response = await fetch(
          `/api/projects/${projectId}/flows/${flowId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update flow');
        }

        const result = await response.json();
        const updatedFlow = result.flow;

        // Update local state
        setFlows((prev) =>
          prev.map((flow) => (flow.id === flowId ? updatedFlow : flow))
        );

        if (currentFlow?.id === flowId) {
          setCurrentFlow(updatedFlow);
        }

        return updatedFlow;
      } catch (error) {
        console.error('Failed to update flow:', error);
        toast({
          title: 'Ошибка сохранения',
          description: 'Не удалось сохранить изменения',
          variant: 'destructive'
        });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [currentFlow, projectId, toast]
  );

  // Save current flow (convenience method)
  const saveFlow = useCallback(async () => {
    if (!currentFlow) return;

    try {
      setIsSaving(true);
      await updateFlow(currentFlow.id, {
        nodes: currentFlow.nodes,
        connections: currentFlow.connections,
        variables: currentFlow.variables,
        settings: currentFlow.settings
      });

      toast({
        title: 'Сохранено',
        description: 'Поток успешно сохранен'
      });
    } catch (error) {
      // Error already handled in updateFlow
    } finally {
      setIsSaving(false);
    }
  }, [currentFlow, updateFlow, toast]);

  // Delete flow
  const deleteFlow = useCallback(
    async (flowId: string) => {
      try {
        setIsSaving(true);
        const response = await fetch(
          `/api/projects/${projectId}/flows/${flowId}`,
          {
            method: 'DELETE'
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete flow');
        }

        // Update local state
        setFlows((prev) => prev.filter((flow) => flow.id !== flowId));

        if (currentFlow?.id === flowId) {
          setCurrentFlow(null);
        }

        toast({
          title: 'Поток удален',
          description: 'Поток успешно удален'
        });
      } catch (error) {
        console.error('Failed to delete flow:', error);
        toast({
          title: 'Ошибка удаления',
          description: 'Не удалось удалить поток',
          variant: 'destructive'
        });
      } finally {
        setIsSaving(false);
      }
    },
    [currentFlow, projectId, toast]
  );

  // Clone flow
  const cloneFlow = useCallback(
    async (flowId: string, newName: string) => {
      try {
        setIsSaving(true);
        const response = await fetch(
          `/api/projects/${projectId}/flows/${flowId}/clone`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to clone flow');
        }

        const result = await response.json();
        const clonedFlow = result.flow;

        // Update local state
        setFlows((prev) => [...prev, clonedFlow]);
        setCurrentFlow(clonedFlow);

        toast({
          title: 'Поток клонирован',
          description: `Поток "${newName}" успешно создан`
        });

        return clonedFlow;
      } catch (error) {
        console.error('Failed to clone flow:', error);
        toast({
          title: 'Ошибка клонирования',
          description: 'Не удалось клонировать поток',
          variant: 'destructive'
        });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, toast]
  );

  // Validate current flow
  const validateFlow = useCallback(async () => {
    if (!currentFlow) return null;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/flows/${currentFlow.id}/validate`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to validate flow');
      }

      const data = await response.json();
      const validation = data.validation;

      if (!validation.isValid) {
        toast({
          title: 'Ошибки валидации',
          description: `Найдено ${validation.errors.length} ошибок`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Валидация пройдена',
          description: 'Поток корректен'
        });
      }

      return validation;
    } catch (error) {
      console.error('Failed to validate flow:', error);
      toast({
        title: 'Ошибка валидации',
        description: 'Не удалось выполнить валидацию',
        variant: 'destructive'
      });
      return null;
    }
  }, [currentFlow, projectId, toast]);

  // Toggle preview mode
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
    toast({
      title: isPreviewMode ? 'Режим редактирования' : 'Режим предпросмотра',
      description: isPreviewMode
        ? 'Теперь можно редактировать поток'
        : 'Изменения не будут сохранены'
    });
  }, [isPreviewMode, toast]);

  // Export current flow
  const exportFlow = useCallback(async () => {
    if (!currentFlow) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/flows/${currentFlow.id}/export`
      );

      if (!response.ok) {
        throw new Error('Failed to export flow');
      }

      // Создаем blob и скачиваем файл
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `bot-flow-${currentFlow.name.replace(/[^a-zA-Z0-9]/g, '-')}-${currentFlow.id.slice(-8)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast({
        title: 'Экспорт завершен',
        description: 'Поток успешно экспортирован'
      });
    } catch (error) {
      console.error('Failed to export flow:', error);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось экспортировать поток',
        variant: 'destructive'
      });
    }
  }, [currentFlow, projectId, toast]);

  // Import flow from file
  const importFlow = useCallback(
    async (file: File) => {
      try {
        // Читаем содержимое файла
        const text = await file.text();
        const importData = JSON.parse(text);

        const response = await fetch(
          `/api/projects/${projectId}/flows/import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(importData)
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to import flow');
        }

        const result = await response.json();
        const importedFlow = result.flow;

        // Обновляем локальное состояние
        setFlows((prev) => [...prev, importedFlow]);
        setCurrentFlow(importedFlow);

        toast({
          title: 'Импорт завершен',
          description: result.message || 'Поток успешно импортирован'
        });

        return importedFlow;
      } catch (error) {
        console.error('Failed to import flow:', error);
        toast({
          title: 'Ошибка импорта',
          description:
            error instanceof Error
              ? error.message
              : 'Не удалось импортировать поток',
          variant: 'destructive'
        });
        throw error;
      }
    },
    [projectId, toast]
  );

  // Load flows on mount
  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  return {
    // State
    flows,
    currentFlow,
    isLoading,
    isSaving,
    isPreviewMode,

    // Actions
    loadFlows,
    loadFlow,
    createFlow,
    updateFlow,
    saveFlow,
    deleteFlow,
    cloneFlow,
    validateFlow,
    exportFlow,
    importFlow,
    togglePreviewMode,

    // Utilities
    setCurrentFlow
  };
}
