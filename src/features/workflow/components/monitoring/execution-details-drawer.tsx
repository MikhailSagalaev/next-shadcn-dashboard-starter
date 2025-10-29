/**
 * @file: execution-details-drawer.tsx
 * @description: Компонент подробного просмотра выполнения workflow с SSE обновлениями
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui, lucide-react, Workflow monitoring types
 * @created: 2025-10-25
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Download,
  Link2,
  PauseCircle,
  PlayCircle,
  User,
  TimerReset,
  FileJson,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

import type {
  WorkflowExecutionDetailsResponse,
  WorkflowExecutionSummary,
  WorkflowExecutionStatus,
  WorkflowExecutionLogEntry
} from '@/types/workflow-monitoring';
import { ExecutionTimeline } from './execution-timeline';

interface ExecutionDetailsDrawerProps {
  projectId: string;
  workflowId: string;
  execution: WorkflowExecutionSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionDetailsDrawer({
  projectId,
  workflowId,
  execution,
  open,
  onOpenChange
}: ExecutionDetailsDrawerProps) {
  const { toast } = useToast();
  const [details, setDetails] = useState<WorkflowExecutionDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [resetVariables, setResetVariables] = useState(false);
  const [liveStatus, setLiveStatus] = useState<WorkflowExecutionStatus>(execution.status);
  const [logs, setLogs] = useState<WorkflowExecutionLogEntry[]>([]);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/workflows/${workflowId}/executions/${execution.id}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error('Не удалось загрузить подробности выполнения');
      }
      const data: WorkflowExecutionDetailsResponse = await response.json();
      setDetails(data);
      setLiveStatus(data.execution.status);

      const initialLogs: WorkflowExecutionLogEntry[] = data.steps.map((step) => ({
        id: `${step.id}-summary`,
        step: step.step,
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        level: step.status === 'error' ? 'error' : 'info',
        message: step.message ?? `Шаг ${step.step} (${step.nodeType})`,
        timestamp: step.completedAt ?? step.startedAt,
        data: step.data
      }));

      setLogs((prev) => mergeLogs(prev, initialLogs));
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error instanceof Error ? error.message : 'Не удалось загрузить детали выполнения',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId, execution.id, toast]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      return;
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      refreshTimeoutRef.current = null;
      await fetchDetails();
    }, 600);
  }, [fetchDetails]);

  useEffect(() => {
    if (open) {
      fetchDetails();
    } else {
      setDetails(null);
      setLogs([]);
      setResetVariables(false);
    }
  }, [open, fetchDetails]);

  useEffect(() => {
    if (!open) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const source = new EventSource(
      `/api/projects/${projectId}/workflows/${workflowId}/executions/${execution.id}/stream`
    );
    eventSourceRef.current = source;

    source.addEventListener('status', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload?.status) {
          setLiveStatus(payload.status as WorkflowExecutionStatus);
          setDetails((prev) =>
            prev
              ? {
                  ...prev,
                  execution: {
                    ...prev.execution,
                    status: payload.status,
                    currentNodeId: payload.currentNodeId ?? prev.execution.currentNodeId,
                    waitType: payload.waitType ?? prev.execution.waitType,
                    waitPayload: payload.waitPayload ?? prev.execution.waitPayload,
                    stepCount: payload.stepCount ?? prev.execution.stepCount,
                    error: payload.error ?? prev.execution.error,
                    finishedAt: payload.finishedAt ?? prev.execution.finishedAt
                  }
                }
              : prev
          );
        }
      } catch (err) {
        console.warn('Failed to parse status event', err);
      }
    });

    source.addEventListener('logs', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as WorkflowExecutionLogEntry[];
        if (Array.isArray(payload)) {
          setLogs((prev) => mergeLogs(prev, payload));
          scheduleRefresh();
        }
      } catch (err) {
        console.warn('Failed to parse logs event', err);
      }
    });

    source.addEventListener('execution', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        setDetails((prev) => (prev ? { ...prev, execution: { ...prev.execution, ...payload } } : prev));
      } catch (err) {
        console.warn('Failed to parse execution event', err);
      }
    });

    source.onerror = () => {
      console.warn('Workflow execution stream error. Closing EventSource.');
      source.close();
      eventSourceRef.current = null;
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [open, projectId, workflowId, execution.id, scheduleRefresh]);

  const handleRestart = async () => {
    try {
      setIsRestarting(true);
      const response = await fetch(
        `/api/projects/${projectId}/workflows/${workflowId}/executions/${execution.id}/restart`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetVariables })
        }
      );

      if (!response.ok) {
        throw new Error('Не удалось перезапустить выполнение');
      }

      toast({
        title: 'Перезапуск выполнен',
        description: 'Workflow перезапущен. Обновление состояния появится через несколько секунд.'
      });

      await fetchDetails();
    } catch (error) {
      console.error('Failed to restart execution:', error);
      toast({
        title: 'Ошибка перезапуска',
        description: error instanceof Error ? error.message : 'Не удалось перезапустить выполнение',
        variant: 'destructive'
      });
    } finally {
      setIsRestarting(false);
    }
  };

  const statusInfo = useMemo(() => getStatusInfo(liveStatus), [liveStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl gap-6 overflow-hidden px-0 pb-0 sm:max-w-6xl'>
        <DialogHeader className='px-6'>
          <DialogTitle className='flex items-center gap-2 text-xl font-semibold'>
            <Activity className='h-5 w-5 text-primary' /> Выполнение #{execution.id}
          </DialogTitle>
          <DialogDescription>
            Отслеживание прогресса, анализ шагов и управление перезапуском выполнения workflow.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className='max-h-[80vh] px-6'>
          {loading && !details ? (
            <div className='space-y-4 py-8'>
              <Skeleton className='h-6 w-56' />
              <Skeleton className='h-40 w-full' />
              <Skeleton className='h-56 w-full' />
            </div>
          ) : details ? (
            <div className='space-y-6 py-6'>
              <div className='grid gap-4 lg:grid-cols-[2fr,1fr]'>
                <Card className='border border-primary/30 bg-primary/5'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                      <Badge className={statusInfo.badgeClass}>{statusInfo.label}</Badge>
                      <span className='text-muted-foreground text-sm'>Workflow {details.execution.workflowId}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='grid gap-2 text-sm'>
                    <InfoRow label='Старт' value={format(new Date(details.execution.startedAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru })} />
                    <InfoRow label='Длительность' value={details.execution.duration ? formatDuration(details.execution.duration) : '—'} />
                    <InfoRow label='Статус ожидания' value={details.execution.waitType ?? '—'} />
                    <InfoRow label='Текущая нода' value={details.execution.currentNodeId ?? '—'} />
                    <InfoRow label='Шагов выполнено' value={details.execution.stepCount} />
                    {details.execution.error && (
                      <InfoRow label='Ошибка' valueClassName='text-destructive'>
                        {details.execution.error}
                      </InfoRow>
                    )}
                  </CardContent>
                </Card>

                <Card className='shadow-sm'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base font-semibold'>Данные сессии</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2 text-sm'>
                    <InfoRow label='Session ID' value={details.execution.sessionId} copyable />
                    <InfoRow label='Пользователь' value={details.execution.userId ?? '—'} />
                    <InfoRow label='Telegram чат' value={details.execution.telegramChatId ?? '—'} />
                    <InfoRow label='Wait payload' value={details.waitPayload ? JSON.stringify(details.waitPayload) : '—'} />
                  </CardContent>
                </Card>
              </div>

              <ExecutionTimeline steps={details.steps} currentNodeId={details.execution.currentNodeId} />

              <Tabs defaultValue='overview'>
                <TabsList className='grid w-full grid-cols-3'>
                  <TabsTrigger value='overview'>Обзор</TabsTrigger>
                  <TabsTrigger value='variables'>Переменные</TabsTrigger>
                  <TabsTrigger value='logs'>Логи</TabsTrigger>
                </TabsList>

                <TabsContent value='overview' className='mt-4 space-y-4'>
                  <Card>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm font-semibold uppercase text-muted-foreground'>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3 text-sm md:grid-cols-2'>
                      <InfoRow label='Workflow ID' value={details.execution.workflowId} copyable />
                      <InfoRow label='Статус' value={statusInfo.label} />
                      <InfoRow label='Начало' value={format(new Date(details.execution.startedAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru })} />
                      <InfoRow label='Продолжительность' value={details.execution.duration ? formatDuration(details.execution.duration) : '—'} />
                      <InfoRow label='Текущая нода' value={details.execution.currentNodeId ?? '—'} />
                      <InfoRow label='Ожидание' value={details.execution.waitType ?? '—'} />
                      <InfoRow label='Шагов' value={details.execution.stepCount} />
                      <InfoRow label='Завершение' value={details.execution.finishedAt ? format(new Date(details.execution.finishedAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru }) : '—'} />
                    </CardContent>
                  </Card>

                  {details.execution.error && (
                    <Card className='border-destructive/40 bg-destructive/5'>
                      <CardHeader className='pb-2'>
                        <CardTitle className='flex items-center gap-2 text-sm font-semibold text-destructive'>
                          <AlertCircle className='h-4 w-4' /> Ошибка выполнения
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className='whitespace-pre-wrap text-sm text-destructive'>{details.execution.error}</pre>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value='variables' className='mt-4'>
                  <Card>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm font-semibold uppercase text-muted-foreground'>Переменные выполнения</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(details.variables || {}).length === 0 ? (
                        <p className='text-muted-foreground text-sm'>Переменные отсутствуют.</p>
                      ) : (
                        <Accordion type='multiple' className='space-y-3'>
                          {Object.entries(details.variables).map(([scope, vars]) => (
                            <AccordionItem key={scope} value={scope} className='border rounded-lg px-2'>
                              <AccordionTrigger className='text-sm font-semibold capitalize'>Scope: {scope}</AccordionTrigger>
                              <AccordionContent>
                                <pre className='whitespace-pre-wrap break-all text-xs'>{JSON.stringify(vars, null, 2)}</pre>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value='logs' className='mt-4'>
                  <Card>
                    <CardHeader className='flex items-center justify-between pb-2'>
                      <CardTitle className='text-sm font-semibold uppercase text-muted-foreground'>Логи выполнения</CardTitle>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => downloadLogs(logs, execution.id)}
                        disabled={logs.length === 0}
                      >
                        <Download className='mr-2 h-4 w-4' /> Экспорт JSON
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className='h-72 rounded-md border'>
                        <div className='space-y-3 p-3'>
                          {logs.length === 0 ? (
                            <p className='text-muted-foreground text-sm'>Логи ещё не сформированы.</p>
                          ) : (
                            logs.map((log) => (
                              <div key={log.id} className='rounded-md border bg-muted/40 p-3 text-xs'>
                                <div className='flex flex-wrap items-center gap-2'>
                                  <Badge variant='outline' className='uppercase'>Шаг {log.step}</Badge>
                                  <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'}>{log.level}</Badge>
                                  <span className='text-muted-foreground'>
                                    {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                                  </span>
                                </div>
                                <div className='mt-2 font-medium text-sm'>{log.message}</div>
                                {log.data && (
                                  <pre className='mt-2 whitespace-pre-wrap break-all text-[11px] text-muted-foreground'>
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className='py-6 text-sm text-muted-foreground'>Данные недоступны.</p>
          )}
        </ScrollArea>

        <Separator />

        <DialogFooter className='flex items-center justify-between gap-3 px-6 py-4 md:flex-row'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Checkbox
              id='resetVariables'
              checked={resetVariables}
              onCheckedChange={(value) => setResetVariables(Boolean(value))}
            />
            <label htmlFor='resetVariables' className='cursor-pointer select-none'>
              Сбросить переменные перед перезапуском
            </label>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => downloadDetails(details)} disabled={!details}>
              <FileJson className='mr-2 h-4 w-4' /> Экспорт деталей
            </Button>
            <Button onClick={handleRestart} disabled={isRestarting}>
              <TimerReset className='mr-2 h-4 w-4' />
              {isRestarting ? 'Перезапуск...' : 'Перезапустить'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mergeLogs(existing: WorkflowExecutionLogEntry[], incoming: WorkflowExecutionLogEntry[]): WorkflowExecutionLogEntry[] {
  const map = new Map<string, WorkflowExecutionLogEntry>();
  for (const log of existing) {
    map.set(log.id, log);
  }
  for (const log of incoming) {
    map.set(log.id, log);
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function getStatusInfo(status: WorkflowExecutionStatus) {
  switch (status) {
    case 'running':
      return { label: 'Выполняется', badgeClass: 'bg-primary/10 text-primary border-primary/30' };
    case 'waiting':
      return { label: 'Ожидает', badgeClass: 'bg-amber-100 text-amber-700 border-amber-300' };
    case 'completed':
      return { label: 'Завершён', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
    case 'failed':
      return { label: 'Ошибка', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30' };
    case 'cancelled':
      return { label: 'Отменён', badgeClass: 'bg-muted text-muted-foreground border-muted-foreground/30' };
    default:
      return { label: status, badgeClass: 'bg-muted text-muted-foreground border-muted-foreground/30' };
  }
}

interface InfoRowProps {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  copyable?: boolean;
  valueClassName?: string;
}

function InfoRow({ label, value, children, copyable, valueClassName }: InfoRowProps) {
  const displayValue = value ?? children ?? '—';
  const valueToCopy = typeof value === 'string' ? value : undefined;

  return (
    <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <div className='flex items-center gap-2'>
        <span className={valueClassName}>{displayValue}</span>
        {copyable && valueToCopy && (
          <Button
            size='icon'
            variant='ghost'
            className='h-7 w-7'
            onClick={() => navigator.clipboard.writeText(valueToCopy)}
          >
            <Link2 className='h-3.5 w-3.5' />
          </Button>
        )}
      </div>
    </div>
  );
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

function downloadLogs(logs: WorkflowExecutionLogEntry[], executionId: string) {
  if (!logs.length) return;
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `workflow-execution-${executionId}-logs.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadDetails(details: WorkflowExecutionDetailsResponse | null) {
  if (!details) return;
  const blob = new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `workflow-execution-${details.execution.id}-details.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

