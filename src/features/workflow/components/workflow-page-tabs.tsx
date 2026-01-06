/**
 * @file: src/features/workflow/components/workflow-page-tabs.tsx
 * @description: Компонент с табами Editor/Executions для страницы workflow
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn UI
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Code, History, X } from 'lucide-react';
import { WorkflowConstructor } from './workflow-constructor';
import { ExecutionsList } from './executions-list';
import { ExecutionCanvas } from './execution-canvas';
import { StepInspector } from './step-inspector';
import { useExecutionStream } from '../hooks/use-execution-stream';
import { useApi } from '@/hooks/use-api';

interface WorkflowPageTabsProps {
  projectId: string;
  workflowId?: string;
}

interface ExecutionDetails {
  execution: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    duration?: number;
    workflowId: string;
    sessionId: string;
    waitPayload?: any;
  };
  steps: any[];
  variables: Record<string, Record<string, any>>;
}

export function WorkflowPageTabs({
  projectId,
  workflowId
}: WorkflowPageTabsProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'executions'>('editor');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(
    null
  );
  const [executionDetails, setExecutionDetails] =
    useState<ExecutionDetails | null>(null);
  const [selectedStep, setSelectedStep] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const api = useApi();

  // SSE для real-time обновлений выбранного выполнения
  const {
    status: liveStatus,
    logs: liveLogs,
    isConnected
  } = useExecutionStream({
    projectId,
    workflowId: workflowId || '',
    executionId: selectedExecutionId || '',
    enabled:
      !!selectedExecutionId &&
      !!workflowId &&
      executionDetails?.execution.status === 'running',
    onStatusChange: (status) => {
      if (executionDetails) {
        setExecutionDetails({
          ...executionDetails,
          execution: {
            ...executionDetails.execution,
            status: status.status,
            finishedAt: status.finishedAt
          }
        });
      }
    }
  });

  // Загрузка деталей выполнения
  const loadExecutionDetails = useCallback(
    async (executionId: string) => {
      if (!workflowId) return;

      setIsLoadingDetails(true);
      setSelectedStep(null);

      try {
        const details = await api.execute(
          `/api/projects/${projectId}/workflows/${workflowId}/executions/${executionId}`
        );
        setExecutionDetails(details);
        setSelectedExecutionId(executionId);
      } catch (error) {
        console.error('Failed to load execution details:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [api, projectId, workflowId]
  );

  // Перезапуск выполнения
  const handleRestart = useCallback(
    async (nodeId: string) => {
      if (!workflowId || !selectedExecutionId) return;

      try {
        const result = await api.execute(
          `/api/projects/${projectId}/workflows/${workflowId}/executions/${selectedExecutionId}/restart`,
          {
            method: 'POST',
            body: JSON.stringify({ fromNodeId: nodeId, resetVariables: false })
          }
        );

        if (result.executionId) {
          // Переключаемся на новое выполнение
          loadExecutionDetails(result.executionId);
        }
      } catch (error) {
        console.error('Failed to restart execution:', error);
      }
    },
    [api, projectId, workflowId, selectedExecutionId, loadExecutionDetails]
  );

  // Закрытие деталей выполнения
  const closeExecutionDetails = useCallback(() => {
    setSelectedExecutionId(null);
    setExecutionDetails(null);
    setSelectedStep(null);
  }, []);

  // Если нет workflowId, показываем только редактор
  if (!workflowId) {
    return <WorkflowConstructor projectId={projectId} />;
  }

  return (
    <div className='flex h-full flex-col'>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'editor' | 'executions')}
        className='flex flex-1 flex-col'
      >
        <div className='flex items-center justify-between border-b px-4 py-2'>
          <TabsList>
            <TabsTrigger value='editor' className='flex items-center gap-2'>
              <Code className='h-4 w-4' />
              Редактор
            </TabsTrigger>
            <TabsTrigger value='executions' className='flex items-center gap-2'>
              <History className='h-4 w-4' />
              История выполнений
            </TabsTrigger>
          </TabsList>

          {/* Mini status indicator */}
          {liveStatus && isConnected && (
            <Badge variant='outline' className='flex items-center gap-1'>
              <span className='h-2 w-2 animate-pulse rounded-full bg-blue-500' />
              Live: {liveStatus.status}
            </Badge>
          )}
        </div>

        <TabsContent value='editor' className='m-0 flex-1'>
          <WorkflowConstructor projectId={projectId} />
        </TabsContent>

        <TabsContent value='executions' className='m-0 flex-1 p-4'>
          <div className='flex h-full gap-4'>
            {/* Список выполнений */}
            <div className={selectedExecutionId ? 'w-1/3' : 'w-full'}>
              <ExecutionsList
                projectId={projectId}
                workflowId={workflowId}
                onSelectExecution={loadExecutionDetails}
              />
            </div>

            {/* Детали выполнения */}
            {selectedExecutionId && executionDetails && (
              <div className='flex flex-1 flex-col overflow-hidden rounded-lg border'>
                {/* Header */}
                <div className='bg-muted/30 flex items-center justify-between border-b p-4'>
                  <div>
                    <h3 className='font-semibold'>
                      Выполнение #{executionDetails.execution.id.slice(-8)}
                    </h3>
                    <p className='text-muted-foreground text-sm'>
                      {new Date(
                        executionDetails.execution.startedAt
                      ).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant={
                        executionDetails.execution.status === 'completed'
                          ? 'default'
                          : executionDetails.execution.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {executionDetails.execution.status}
                    </Badge>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={closeExecutionDetails}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className='flex flex-1 overflow-hidden'>
                  {/* Canvas */}
                  <div className='flex-1 border-r'>
                    <ExecutionCanvas
                      nodes={{}}
                      connections={[]}
                      executionPath={executionDetails.steps.map(
                        (s) => s.nodeId
                      )}
                      stepStatuses={executionDetails.steps.reduce(
                        (acc, step) => {
                          acc[step.nodeId] = {
                            nodeId: step.nodeId,
                            status: step.status,
                            duration: step.duration,
                            message: step.message
                          };
                          return acc;
                        },
                        {} as Record<string, any>
                      )}
                      onNodeClick={(nodeId) => {
                        const step = executionDetails.steps.find(
                          (s) => s.nodeId === nodeId
                        );
                        if (step) setSelectedStep(step);
                      }}
                    />
                  </div>

                  {/* Step Inspector */}
                  {selectedStep && (
                    <div className='w-96 border-l'>
                      <StepInspector
                        step={selectedStep}
                        onRestart={handleRestart}
                        onClose={() => setSelectedStep(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
