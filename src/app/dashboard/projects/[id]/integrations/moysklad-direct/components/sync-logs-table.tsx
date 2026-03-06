/**
 * @file: sync-logs-table.tsx
 * @description: Sync logs table with filtering
 * @project: SaaS Bonus System
 * @dependencies: React 19
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SyncLogsTableProps {
  logs: Array<{
    id: string;
    operation: string;
    direction: string;
    status: string;
    amount: number | null;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  }>;
  integrationId: string;
  projectId: string;
}

export function SyncLogsTable({ logs }: SyncLogsTableProps) {
  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'bonus_accrual':
        return 'Начисление';
      case 'bonus_spending':
        return 'Списание';
      case 'balance_sync':
        return 'Проверка баланса';
      default:
        return operation;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge
            variant='default'
            className='bg-emerald-500 hover:bg-emerald-600'
          >
            <CheckCircle2 className='mr-1 h-3 w-3' />
            Успешно
          </Badge>
        );
      case 'error':
        return (
          <Badge variant='destructive'>
            <XCircle className='mr-1 h-3 w-3' />
            Ошибка
          </Badge>
        );
      default:
        return <Badge variant='secondary'>{status}</Badge>;
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === 'incoming') {
      return <ArrowDownCircle className='h-4 w-4 text-blue-500' />;
    }
    return <ArrowUpCircle className='h-4 w-4 text-purple-500' />;
  };

  if (logs.length === 0) {
    return (
      <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            Последние синхронизации
          </CardTitle>
          <CardDescription>История операций синхронизации</CardDescription>
        </CardHeader>
        <CardContent className='flex h-[200px] items-center justify-center text-sm text-zinc-500'>
          Нет данных для отображения
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Последние синхронизации
        </CardTitle>
        <CardDescription>
          История операций синхронизации (последние 10)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {logs.map((log) => (
            <div
              key={log.id}
              className='flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-3 transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
            >
              <div className='flex items-center gap-4'>
                {/* Direction Icon */}
                <div className='flex-shrink-0'>
                  {getDirectionIcon(log.direction)}
                </div>

                {/* Operation Info */}
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                      {getOperationLabel(log.operation)}
                    </p>
                    {log.amount && (
                      <span className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                        {log.amount.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400'>
                    {log.user && (
                      <>
                        <span>{log.user.name || log.user.email}</span>
                        <span className='h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700' />
                      </>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className='flex-shrink-0'>{getStatusBadge(log.status)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
