/**
 * @file: src/features/workflow/hooks/use-workflow.ts
 * @description: Хук для управления workflow в конструкторе
 * @project: SaaS Bonus System
 * @dependencies: React, API calls
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  Workflow,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowNode,
  WorkflowConnection
} from '@/types/workflow';

export function useWorkflow(projectId: string) {
  const { toast } = useToast();

  // State
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load all workflows for project
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/workflows`);
      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить список workflow',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  // Load specific workflow
  const loadWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`);
        if (!response.ok) {
          throw new Error('Failed to load workflow');
        }
        const data = await response.json();
        setCurrentWorkflow(data.workflow);
        toast({
          title: 'Workflow загружен',
          description: `Workflow "${data.workflow.name}" успешно загружен.`,
          variant: 'default'
        });
      } catch (error) {
        console.error('Failed to load workflow:', error);
        toast({
          title: 'Ошибка загрузки',
          description: 'Не удалось загрузить workflow',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, toast]
  );

  // Create new workflow
  const createWorkflow = useCallback(
    async (name: string, description?: string) => {
      setIsSaving(true);
      try {
        const newWorkflowData: CreateWorkflowRequest = {
          name,
          description,
          nodes: [
            {
              id: 'trigger-node',
              type: 'trigger.command',
              position: { x: 100, y: 100 },
              data: {
                label: 'Триггер',
                config: { 'trigger.command': { command: '/start' } }
              }
            } as WorkflowNode
          ],
          connections: [],
          variables: [],
          settings: {}
        };

        const response = await fetch(`/api/projects/${projectId}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newWorkflowData)
        });

        if (!response.ok) {
          throw new Error('Failed to create workflow');
        }

        const data = await response.json();
        setWorkflows((prev) => [...prev, data.workflow]);
        setCurrentWorkflow(data.workflow);
        toast({
          title: 'Workflow создан',
          description: `Workflow "${name}" успешно создан.`,
          variant: 'default'
        });
        return data.workflow;
      } catch (error) {
        console.error('Failed to create workflow:', error);
        toast({
          title: 'Ошибка создания',
          description: 'Не удалось создать workflow',
          variant: 'destructive'
        });
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, toast]
  );

  // Update existing workflow
  const updateWorkflow = useCallback(
    async (workflowId: string, updates: UpdateWorkflowRequest) => {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error('Failed to update workflow');
        }

        const data = await response.json();
        setWorkflows((prev) =>
          prev.map((w) => (w.id === workflowId ? data.workflow : w))
        );
        setCurrentWorkflow(data.workflow);
        toast({
          title: 'Workflow обновлен',
          description: `Workflow "${data.workflow.name}" успешно обновлен.`,
          variant: 'default'
        });
        return data.workflow;
      } catch (error) {
        console.error('Failed to update workflow:', error);
        toast({
          title: 'Ошибка обновления',
          description: 'Не удалось обновить workflow',
          variant: 'destructive'
        });
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, toast]
  );

  // Save current workflow (wrapper for update)
  const saveWorkflow = useCallback(
    async (workflow: Workflow) => {
      if (!workflow) return;
      await updateWorkflow(workflow.id, {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        connections: workflow.connections,
        variables: workflow.variables,
        settings: workflow.settings,
        isActive: workflow.isActive
      });
    },
    [updateWorkflow]
  );

  // Delete workflow
  const deleteWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete workflow');
        }

        setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
        if (currentWorkflow?.id === workflowId) {
          setCurrentWorkflow(null);
        }
        toast({
          title: 'Workflow удален',
          description: 'Workflow успешно удален.',
          variant: 'default'
        });
      } catch (error) {
        console.error('Failed to delete workflow:', error);
        toast({
          title: 'Ошибка удаления',
          description: 'Не удалось удалить workflow',
          variant: 'destructive'
        });
      }
    },
    [projectId, currentWorkflow?.id, toast]
  );

  // Export workflow
  const exportWorkflow = useCallback((workflow: Workflow) => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${workflow.name}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({
      title: 'Workflow экспортирован',
      description: `Workflow "${workflow.name}" успешно экспортирован.`,
      variant: 'default'
    });
  }, [toast]);

  // Import workflow
  const importWorkflow = useCallback(async (file: File) => {
    try {
      const fileText = await file.text();
      const importedWorkflow: Workflow = JSON.parse(fileText);

      // Basic validation
      if (!importedWorkflow.name || !importedWorkflow.nodes || !importedWorkflow.connections) {
        throw new Error('Invalid workflow file format');
      }

      // Create a new workflow based on the imported one
      const newWorkflow = await createWorkflow(
        `${importedWorkflow.name} (импорт)`,
        importedWorkflow.description
      );

      if (newWorkflow) {
        // Update the newly created workflow with imported data
        await updateWorkflow(newWorkflow.id, {
          nodes: importedWorkflow.nodes,
          connections: importedWorkflow.connections,
          variables: importedWorkflow.variables,
          settings: importedWorkflow.settings
        });
        toast({
          title: 'Workflow импортирован',
          description: `Workflow "${importedWorkflow.name}" успешно импортирован.`,
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Failed to import workflow:', error);
      toast({
        title: 'Ошибка импорта',
        description: `Не удалось импортировать workflow: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive'
      });
    }
  }, [createWorkflow, updateWorkflow, toast]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  return {
    workflows,
    currentWorkflow,
    isLoading,
    isSaving,
    loadWorkflows,
    loadWorkflow,
    createWorkflow,
    updateWorkflow,
    saveWorkflow,
    deleteWorkflow,
    exportWorkflow,
    importWorkflow,
    setCurrentWorkflow // Allow external components to set the current workflow
  };
}
