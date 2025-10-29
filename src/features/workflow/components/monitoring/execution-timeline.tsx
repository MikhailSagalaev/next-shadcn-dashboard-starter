/**
 * @file: execution-timeline.tsx
 * @description: Компонент таймлайна шагов выполнения workflow
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui, lucide-react, Workflow monitoring types
 * @created: 2025-10-25
 */

'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, PauseCircle, PlayCircle, AlertTriangle, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { WorkflowExecutionStep } from '@/types/workflow-monitoring';

interface ExecutionTimelineProps {
  steps: WorkflowExecutionStep[];
  currentNodeId?: string;
}

export function ExecutionTimeline({ steps, currentNodeId }: ExecutionTimelineProps) {
  return (
    <Card className='h-full'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base font-semibold'>Таймлайн выполнения</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className='p-0'>
        <ScrollArea className='h-[420px] px-4 py-3'>
          <div className='relative flex flex-col gap-4'>
            {steps.length === 0 && (
              <p className='text-muted-foreground text-sm'>Шаги выполнения отсутствуют.</p>
            )}

            {steps.map((step, index) => {
              const isCurrent = currentNodeId && step.nodeId === currentNodeId;
              return (
                <TimelineItem
                  key={step.id}
                  step={step}
                  isCurrent={isCurrent}
                  isLast={index === steps.length - 1}
                />
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface TimelineItemProps {
  step: WorkflowExecutionStep;
  isCurrent?: boolean;
  isLast?: boolean;
}

function TimelineItem({ step, isCurrent, isLast }: TimelineItemProps) {
  const icon = getIconByStatus(step.status);
  const statusBadgeVariant = getStatusBadgeVariant(step.status);
  const startedAt = new Date(step.startedAt);
  const completedAt = step.completedAt ? new Date(step.completedAt) : undefined;
  const duration = step.duration ?? (completedAt ? completedAt.getTime() - startedAt.getTime() : undefined);

  return (
    <div className='relative flex gap-4'>
      <div className='flex flex-col items-center'>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-sm',
            statusBadgeVariant,
            isCurrent && 'ring-2 ring-offset-2'
          )}
        >
          {icon}
        </div>
        {!isLast && <div className='bg-border mt-1 h-full w-px flex-1'></div>}
      </div>

      <div className='flex-1 rounded-lg border p-4 shadow-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline' className='text-xs font-medium uppercase'>
            Шаг {step.step}
          </Badge>
          <Badge variant='secondary' className='text-xs font-medium'>
            {getStatusLabel(step.status)}
          </Badge>
          {step.nodeLabel && (
            <span className='font-medium text-sm'>{step.nodeLabel}</span>
          )}
          <span className='text-muted-foreground text-xs'>
            {format(startedAt, 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
          </span>
          <span className='text-muted-foreground text-xs'>
            {formatDistanceToNow(startedAt, { addSuffix: true, locale: ru })}
          </span>
        </div>

        <div className='mt-3 space-y-2 text-sm'>
          <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  Старт: {format(startedAt, 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{startedAt.toISOString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {completedAt && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className='flex items-center gap-1'>
                    <CheckCircle2 className='h-3 w-3 text-emerald-500' />
                    Завершён: {format(completedAt, 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{completedAt.toISOString()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {typeof duration === 'number' && (
              <span className='flex items-center gap-1'>
                <TimerIcon className='h-3 w-3' />
                {formatDuration(duration)}
              </span>
            )}
          </div>

          {step.message && (
            <p className='text-sm'>{step.message}</p>
          )}

          {step.data && (
            <details className='rounded-md border bg-muted/40 p-2 text-xs shadow-sm'>
              <summary className='cursor-pointer font-medium'>Данные шага</summary>
              <pre className='mt-2 whitespace-pre-wrap break-all text-[11px]'>
                {JSON.stringify(step.data, null, 2)}
              </pre>
            </details>
          )}

          {step.variables && Object.keys(step.variables).length > 0 && (
            <details className='rounded-md border bg-muted/40 p-2 text-xs shadow-sm'>
              <summary className='cursor-pointer font-medium'>Переменные</summary>
              <pre className='mt-2 whitespace-pre-wrap break-all text-[11px]'>
                {JSON.stringify(step.variables, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function getIconByStatus(status: WorkflowExecutionStep['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className='h-4 w-4 text-emerald-500' />;
    case 'error':
      return <XCircle className='h-4 w-4 text-destructive' />;
    case 'running':
      return <PlayCircle className='h-4 w-4 text-primary' />;
    case 'pending':
      return <PauseCircle className='h-4 w-4 text-muted-foreground' />;
    case 'skipped':
      return <AlertTriangle className='h-4 w-4 text-amber-500' />;
    default:
      return <Clock className='h-4 w-4 text-muted-foreground' />;
  }
}

function getStatusBadgeVariant(status: WorkflowExecutionStep['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-500 text-emerald-500';
    case 'error':
      return 'border-destructive text-destructive';
    case 'running':
      return 'border-primary text-primary';
    case 'skipped':
      return 'border-amber-500 text-amber-500';
    default:
      return 'border-muted-foreground text-muted-foreground';
  }
}

function getStatusLabel(status: WorkflowExecutionStep['status']) {
  switch (status) {
    case 'completed':
      return 'Завершён';
    case 'error':
      return 'Ошибка';
    case 'running':
      return 'Выполняется';
    case 'pending':
      return 'Ожидает';
    case 'skipped':
      return 'Пропущен';
    default:
      return status;
  }
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} мс`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds} сек`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes} мин ${remainingSeconds} сек`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} ч ${remainingMinutes} мин`;
}

function TimerIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Clock {...props} />;
}

