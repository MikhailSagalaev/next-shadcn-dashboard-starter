/**
 * @file: src/features/workflow/components/executions-list.tsx
 * @description: Компонент списка выполнений workflow с пагинацией и фильтрами
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn UI, useApi
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ExecutionSummary {
  id: string;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  userId?: string;
  telegramChatId?: string;
  currentNodeId?: string;
  waitType?: string;
  stepCount: number;
  error?: string;
}

interface ExecutionsListProps {
  projectId: string;
  workflowId: string;
  onSelectExecution?: (executionId: string) => void;
}

const STATUS_CONFIG = {
  running: { label: 'Выполняется', icon: Play, color: 'bg-blue-500' },
  waiting: { label: 'Ожидание', icon: Pause, color: 'bg-yellow-500' },
  completed: { label: 'Завершено', icon: CheckCircle, color: 'bg-green-500' },
  failed: { label: 'Ошибка', icon: XCircle, color: 'bg-red-500' },
  cancelled: { label: 'Отменено', icon: Clock, color: 'bg-gray-500' }
};

export function ExecutionsList({
  projectId,
  workflowId,
  onSelectExecution
}: ExecutionsListProps) {
  const api = useApi();
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchExecutions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (search) {
        params.set('search', search);
      }

      const response = await api.execute(
        `/api/projects/${projectId}/workflows/${workflowId}/executions?${params}`
      );

      if (response.executions) {
        setExecutions(response.executions);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    api,
    projectId,
    workflowId,
    pagination.page,
    pagination.limit,
    statusFilter,
    search
  ]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const getStatusBadge = (status: ExecutionSummary['status']) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge variant='outline' className='flex items-center gap-1'>
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
        <Icon className='h-3 w-3' />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className='space-y-4'>
      {/* Filters */}
      <div className='flex items-center gap-4'>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value='all'>Все</TabsTrigger>
            <TabsTrigger value='running'>Активные</TabsTrigger>
            <TabsTrigger value='completed'>Завершенные</TabsTrigger>
            <TabsTrigger value='failed'>Ошибки</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Поиск по sessionId или chatId...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>

        <Button variant='outline' size='icon' onClick={fetchExecutions}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Статус</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Длительность</TableHead>
              <TableHead>Шаги</TableHead>
              <TableHead>Chat ID</TableHead>
              <TableHead>Текущий узел</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className='py-8 text-center'>
                  <Loader2 className='mx-auto h-6 w-6 animate-spin' />
                </TableCell>
              </TableRow>
            ) : executions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-8 text-center'
                >
                  Нет выполнений
                </TableCell>
              </TableRow>
            ) : (
              executions.map((execution) => (
                <TableRow
                  key={execution.id}
                  className='hover:bg-muted/50 cursor-pointer'
                  onClick={() => onSelectExecution?.(execution.id)}
                >
                  <TableCell>{getStatusBadge(execution.status)}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(execution.startedAt), {
                      addSuffix: true,
                      locale: ru
                    })}
                  </TableCell>
                  <TableCell>{formatDuration(execution.duration)}</TableCell>
                  <TableCell>{execution.stepCount}</TableCell>
                  <TableCell className='font-mono text-xs'>
                    {execution.telegramChatId || '-'}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {execution.currentNodeId || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground text-sm'>
          Показано {executions.length} из {pagination.total}
        </div>
        <div className='flex items-center gap-2'>
          <Select
            value={pagination.limit.toString()}
            onValueChange={(value) =>
              setPagination((prev) => ({
                ...prev,
                limit: parseInt(value),
                page: 1
              }))
            }
          >
            <SelectTrigger className='w-20'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='10'>10</SelectItem>
              <SelectItem value='20'>20</SelectItem>
              <SelectItem value='50'>50</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant='outline'
            size='icon'
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <span className='text-sm'>
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant='outline'
            size='icon'
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
