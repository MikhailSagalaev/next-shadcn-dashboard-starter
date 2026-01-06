/**
 * @file: src/features/workflow/components/execution-canvas.tsx
 * @description: Компонент canvas для визуализации пути выполнения workflow (n8n-style)
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type StepStatus = 'success' | 'error' | 'running' | 'skipped' | 'pending';

interface ExecutionStep {
  nodeId: string;
  status: StepStatus;
  duration?: number;
  message?: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label?: string;
    config?: any;
  };
  position: { x: number; y: number };
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface ExecutionCanvasProps {
  nodes: Record<string, WorkflowNode>;
  connections: WorkflowConnection[];
  executionPath: string[];
  stepStatuses: Record<string, ExecutionStep>;
  onNodeClick?: (nodeId: string) => void;
}

// Стили для разных статусов (n8n-style)
const STATUS_STYLES: Record<
  StepStatus,
  { border: string; bg: string; text: string }
> = {
  success: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-700 dark:text-green-400'
  },
  error: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-400'
  },
  running: {
    border: 'border-blue-500 animate-pulse',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-400'
  },
  skipped: {
    border: 'border-gray-300',
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    text: 'text-gray-500'
  },
  pending: {
    border: 'border-gray-200',
    bg: 'bg-white dark:bg-gray-900',
    text: 'text-gray-600'
  }
};

function ExecutionNodeCard({
  node,
  step,
  isInPath,
  onClick
}: {
  node: WorkflowNode;
  step?: ExecutionStep;
  isInPath: boolean;
  onClick?: () => void;
}) {
  let status: StepStatus = 'pending';
  if (step) {
    const stepStatus = step.status as string;
    if (stepStatus === 'completed' || stepStatus === 'success')
      status = 'success';
    else if (stepStatus === 'error') status = 'error';
    else if (stepStatus === 'running') status = 'running';
    else if (stepStatus === 'skipped') status = 'skipped';
  } else if (!isInPath) {
    status = 'skipped';
  }

  const styles = STATUS_STYLES[status];

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'cursor-pointer rounded-lg border-2 px-4 py-3 transition-all duration-200 hover:shadow-md',
              styles.border,
              styles.bg,
              status === 'skipped' && 'opacity-50'
            )}
            onClick={onClick}
          >
            <div className='flex min-w-[120px] flex-col items-center gap-1'>
              <span className={cn('text-sm font-medium', styles.text)}>
                {node.data?.label || node.id}
              </span>
              <span className='text-muted-foreground text-xs'>{node.type}</span>
              {step?.duration && (
                <Badge variant='outline' className='mt-1 text-xs'>
                  {formatDuration(step.duration)}
                </Badge>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side='right' className='max-w-xs'>
          <div className='space-y-1'>
            <p className='font-medium'>{node.data?.label || node.id}</p>
            <p className='text-muted-foreground text-xs'>{node.type}</p>
            {step?.message && <p className='text-xs'>{step.message}</p>}
            {step?.duration && (
              <p className='text-xs'>Время: {formatDuration(step.duration)}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ExecutionCanvas({
  nodes,
  connections,
  executionPath,
  stepStatuses,
  onNodeClick
}: ExecutionCanvasProps) {
  // Сортируем узлы по пути выполнения
  const sortedNodes = useMemo(() => {
    const nodeList = Object.entries(nodes);

    // Если есть путь выполнения, сортируем по нему
    if (executionPath.length > 0) {
      return nodeList.sort((a, b) => {
        const aIndex = executionPath.indexOf(a[0]);
        const bIndex = executionPath.indexOf(b[0]);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    // Иначе сортируем по позиции Y
    return nodeList.sort(
      (a, b) => (a[1].position?.y || 0) - (b[1].position?.y || 0)
    );
  }, [nodes, executionPath]);

  return (
    <div className='h-full w-full overflow-auto p-4'>
      <div className='flex flex-col items-center gap-2'>
        {sortedNodes.map(([id, node], index) => {
          const step = stepStatuses[id];
          const isInPath = executionPath.includes(id);
          const nextNodeId = sortedNodes[index + 1]?.[0];
          const hasConnection = connections.some(
            (c) => c.source === id && c.target === nextNodeId
          );

          return (
            <div key={id} className='flex flex-col items-center'>
              <ExecutionNodeCard
                node={node}
                step={step}
                isInPath={isInPath}
                onClick={() => onNodeClick?.(id)}
              />
              {index < sortedNodes.length - 1 && (
                <div
                  className={cn(
                    'my-1 h-8 w-0.5',
                    hasConnection &&
                      isInPath &&
                      executionPath.includes(nextNodeId)
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
