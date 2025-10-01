/**
 * @file: src/features/bot-constructor/hooks/use-bot-flow.ts
 * @description: Хук для управления потоками бота в конструкторе
 * @project: SaaS Bonus System
 * @dependencies: React, BotFlowService, API calls
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { useState, useEffect, useCallback } from 'react';
import { BotFlowService } from '@/lib/services/bot-flow.service';
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

  // Load all flows for project
  const loadFlows = useCallback(async () => {
    try {
      setIsLoading(true);
      const projectFlows = await BotFlowService.getFlowsByProject(projectId);
      setFlows(projectFlows);
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
        const flow = await BotFlowService.getFlowById(flowId);
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
        const newFlow = await BotFlowService.createFlow(projectId, data);

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
        const updatedFlow = await BotFlowService.updateFlow(flowId, data);

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
    [currentFlow, toast]
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
        await BotFlowService.deleteFlow(flowId);

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
    [currentFlow, toast]
  );

  // Clone flow
  const cloneFlow = useCallback(
    async (flowId: string, newName: string) => {
      try {
        setIsSaving(true);
        const clonedFlow = await BotFlowService.cloneFlow(flowId, newName);

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
    [toast]
  );

  // Validate current flow
  const validateFlow = useCallback(async () => {
    if (!currentFlow) return null;

    try {
      const validation = BotFlowService.validateFlow(
        currentFlow.nodes,
        currentFlow.connections
      );

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
  }, [currentFlow, toast]);

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

    // Actions
    loadFlows,
    loadFlow,
    createFlow,
    updateFlow,
    saveFlow,
    deleteFlow,
    cloneFlow,
    validateFlow,

    // Utilities
    setCurrentFlow
  };
}
