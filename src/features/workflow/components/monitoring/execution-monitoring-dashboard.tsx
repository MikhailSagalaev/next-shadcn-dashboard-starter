/**
 * @file: execution-monitoring-dashboard.tsx
 * @description: Дашборд мониторинга выполнений workflow с фильтрами и деталями
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui, lucide-react, Workflow hooks
 * @created: 2025-10-25
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertTriangle,
  Activity,
  ListRestart,
  RefreshCcw,
  Search,
  ServerCrash,
  Clock,
  Workflow as WorkflowIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

import { useWorkflow } from '@/features/workflow/hooks/use-workflow';
import { useWorkflowExecutions } from '@/features/workflow/hooks/use-workflow-executions';
import type {
  WorkflowExecutionSummary,
  WorkflowExecutionStatus
} from '@/types/workflow-monitoring';
import { ExecutionDetailsDrawer } from './execution-details-drawer';

interface ExecutionMonitoringDashboardProps {
  projectId: string;
}

export function ExecutionMonitoringDashboard({ projectId }: ExecutionMonitoringDashboardProps) {
  const { toast } = useToast();
  const {
    workflows,
    loadWorkflows,
    currentWorkflow,
    setCurrentWorkflow
  } = useWorkflow(projectId);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowExecutionStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionSummary | null>(null);
  const [page, setPage] = useState(1);

  const {
    executions,
    pagination,
    loading,
    error,
    fetchExecutions
  } = useWorkflowExecutions(projectId, selectedWorkflowId ?? undefined);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    if (workflows.length > 0) {
      const activeWorkflow = workflows.find((wf) => wf.isActive) ?? workflows[0];
      setCurrentWorkflow(activeWorkflow || null);
      setSelectedWorkflowId(activeWorkflow?.id ?? null);
    }
  }, [workflows, setCurrentWorkflow]);

  useEffect(() => {
    if (selectedWorkflowId) {
      fetchExecutions({
        page,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined
      });
    }
  }, [selectedWorkflowId, statusFilter, searchTerm, page, fetchExecutions]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm, selectedWorkflowId]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Ошибка загрузки выполнений',
        description: error,
        variant: 'destructive'
      });
    }
  }, [error, toast]);

  const handleWorkflowChange = (workflowId: string) => {
    const workflow = workflows.find((wf) => wf.id === workflowId) ?? null;
    setCurrentWorkflow(workflow);
    setSelectedWorkflowId(workflowId);
    setPage(1);
  };

  const handleRefresh = () => {
    if (!selectedWorkflowId) return;
    fetchExecutions({
      page,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchTerm || undefined
    });
  };

  const handleViewExecution = (execution: WorkflowExecutionSummary) => {
    setSelectedExecution(execution);
  };

  const currentWorkflowName = useMemo(() => {
    return currentWorkflow?.name ?? 'Workflow не выбран';
  }, [currentWorkflow]);

  return (
    <div className='flex flex-col gap-6'>
      <Card className='border border-primary/20 bg-primary/5'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-lg font-semibold'>
            <Activity className='h-5 w-5 text-primary' />
            Мониторинг выполнения Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Отслеживайте выполнения, анализируйте шаги и перезапускайте процессы без выхода из панели администрирования.
          </p>

          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              icon={WorkflowIcon}
              title='Активный workflow'
              value={currentWorkflowName}
              description={currentWorkflow?.isActive ? 'Workflow активен и принимает события.' : 'Workflow не активирован.'}
            />
            <StatCard
              icon={RefreshCcw}
              title='Всего запусков'
              value={pagination?.total ? String(pagination.total) : '—'}
              description='Количество выполнений, попадающих под выбранные фильтры.'
            />
            <StatCard
              icon={Clock}
              title='Последний запуск'
              value={executions[0]?.startedAt ? format(new Date(executions[0].startedAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : '—'}
              description={executions[0]?.startedAt ? formatDistanceToNow(new Date(executions[0].startedAt), { addSuffix: true, locale: ru }) : 'Нет данных'}
            />
            <StatCard
              icon={AlertTriangle}
              title='Ошибок'
              value={executions.filter((execution) => execution.status === 'failed').length}
              description='Количество выполнений с ошибками в текущей выборке.'
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base font-semibold'>Фильтры и выбор workflow</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4 lg:flex-row lg:items-end'>
          <div className='flex flex-1 flex-col gap-2'>
            <label className='text-sm font-medium'>Workflow</label>
            <Select
              value={selectedWorkflowId ?? undefined}
              onValueChange={handleWorkflowChange}
            >
              <SelectTrigger>
                <SelectValue placeholder='Выберите workflow' />
              </SelectTrigger>
              <SelectContent>
                {workflows.length === 0 && <SelectItem value='empty'>Workflow отсутствуют</SelectItem>}
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                    {workflow.isActive && ' · Активен'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-1 flex-col gap-2'>
            <label className='text-sm font-medium'>Статус</label>
            <Select
              value={statusFilter}
              onValueChange={(value: WorkflowExecutionStatus | 'all') => setStatusFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Статус выполнения' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все статусы</SelectItem>
                <SelectItem value='running'>Выполняется</SelectItem>
                <SelectItem value='waiting'>Ожидает</SelectItem>
                <SelectItem value='completed'>Завершён</SelectItem>
                <SelectItem value='failed'>Ошибка</SelectItem>
                <SelectItem value='cancelled'>Отменён</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-1 flex-col gap-2'>
            <label className='text-sm font-medium'>Поиск</label>
            <div className='relative'>
              <Search className='text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Session ID или Telegram chat ID'
                className='pl-9'
              />
            </div>
          </div>

          <div className='flex flex-none items-end gap-2'>
            <Button variant='outline' onClick={handleRefresh} disabled={loading || !selectedWorkflowId}>
              <RefreshCcw className='mr-2 h-4 w-4' /> Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base font-semibold'>Выполнения workflow</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <ExecutionTableSkeleton />}
          {!loading && executions.length === 0 && (
            <div className='flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground'>
              <ServerCrash className='h-10 w-10 text-muted-foreground/80' />
              <span>По выбранным фильтрам выполнений не найдено.</span>
            </div>
          )}

          {!loading && executions.length > 0 && (
            <ScrollArea className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[140px]'>Статус</TableHead>
                    <TableHead className='w-[200px]'>Старт</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Текущая нода</TableHead>
                    <TableHead>Шаги</TableHead>
                    <TableHead>Длительность</TableHead>
                    <TableHead className='w-[120px] text-right'>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => (
                    <TableRow key={execution.id} className='hover:bg-muted/40'>
                      <TableCell>
                        <StatusBadge status={execution.status} waitType={execution.waitType} />
                      </TableCell>
                      <TableCell className='space-y-1 text-sm'>
                        <div>{format(new Date(execution.startedAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru })}</div>
                        <div className='text-muted-foreground text-xs'>
                          {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true, locale: ru })}
                        </div>
                      </TableCell>
                      <TableCell className='text-sm'>
                        <div>{execution.userId ?? '—'}</div>
                        <div className='text-muted-foreground text-xs'>{execution.telegramChatId ?? '—'}</div>
                      </TableCell>
                      <TableCell className='text-sm'>{execution.currentNodeId ?? '—'}</TableCell>
                      <TableCell className='text-sm'>{execution.stepCount}</TableCell>
                      <TableCell className='text-sm'>{execution.duration ? formatDuration(execution.duration) : '—'}</TableCell>
                      <TableCell className='text-right'>
                        <Button size='sm' variant='secondary' onClick={() => handleViewExecution(execution)}>
                          <ListRestart className='mr-2 h-4 w-4' /> Подробнее
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {pagination && executions.length > 0 && (
            <div className='mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground'>
              <span>
                Страница {pagination.page} из {pagination.totalPages}. Всего {pagination.total} выполнений.
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={loading || pagination.page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Предыдущая
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={loading || pagination.page >= pagination.totalPages}
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                >
                  Следующая
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedExecution && selectedWorkflowId && (
        <ExecutionDetailsDrawer
          open={!!selectedExecution}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedExecution(null);
              handleRefresh();
            }
          }}
          projectId={projectId}
          workflowId={selectedWorkflowId}
          execution={selectedExecution}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  description?: string;
}

function StatCard({ icon: Icon, title, value, description }: StatCardProps) {
  return (
    <Card className='shadow-sm'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <Icon className='h-4 w-4 text-primary' />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        <div className='text-lg font-semibold'>{value}</div>
        {description && <p className='text-muted-foreground text-xs'>{description}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, waitType }: { status: WorkflowExecutionStatus; waitType?: string }) {
  const mapping: Record<WorkflowExecutionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    running: { label: 'Выполняется', variant: 'default' },
    waiting: { label: 'Ожидание', variant: 'secondary', className: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Завершён', variant: 'secondary', className: 'bg-emerald-100 text-emerald-700' },
    failed: { label: 'Ошибка', variant: 'destructive' },
    cancelled: { label: 'Отменён', variant: 'outline' }
  };

  const badge = mapping[status];
  return (
    <div className='flex flex-col gap-1'>
      <Badge variant={badge.variant} className={badge.className}>
        {badge.label}
      </Badge>
      {waitType && (
        <span className='text-muted-foreground text-xs'>
          Ожидание: {waitType}
        </span>
      )}
    </div>
  );
}

function ExecutionTableSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className='h-14 w-full' />
      ))}
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

