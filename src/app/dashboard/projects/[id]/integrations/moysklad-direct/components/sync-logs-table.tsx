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
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

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
      firstName: string | null;
      lastName: string | null;
      email: string;
    } | null;
    requestData?: any;
    responseData?: any;
  }>;
  integrationId: string;
  projectId: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function SyncLogsTable({ logs, pagination }: SyncLogsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };
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
        <Accordion type='single' collapsible className='space-y-3'>
          {logs.map((log) => (
            <AccordionItem
              key={log.id}
              value={log.id}
              className='overflow-hidden rounded-lg border border-b-0 border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
            >
              <AccordionTrigger className='pointer-events-auto px-4 py-3 transition-colors hover:bg-zinc-50 hover:no-underline dark:hover:bg-zinc-800/50'>
                <div className='flex flex-1 items-center gap-4 pr-4 text-left'>
                  {/* Direction Icon */}
                  <div className='flex-shrink-0'>
                    {getDirectionIcon(log.direction)}
                  </div>

                  {/* Operation Info */}
                  <div className='flex-1 space-y-1'>
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
                          <span>
                            {log.user.firstName && log.user.lastName
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : log.user.email}
                          </span>
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
              </AccordionTrigger>

              <AccordionContent className='px-4 pt-1 pb-4'>
                <div className='space-y-4 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800'>
                  <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                    <div>
                      <p className='text-zinc-500'>ID Операции</p>
                      <p className='mt-1 font-mono text-xs'>{log.id}</p>
                    </div>
                    <div>
                      <p className='text-zinc-500'>Время (точное)</p>
                      <p className='mt-1'>
                        {format(
                          new Date(log.createdAt),
                          'dd MMM yyyy HH:mm:ss',
                          { locale: ru }
                        )}
                      </p>
                    </div>
                    <div className='col-span-1 md:col-span-2'>
                      <p className='text-zinc-500'>Статус детально</p>
                      <div className='mt-1 rounded border border-zinc-100 bg-zinc-50 p-2 text-xs break-all dark:border-zinc-800 dark:bg-zinc-950'>
                        {log.status === 'error'
                          ? 'Ошибка во время синхронизации'
                          : 'Успешная обработка'}
                        {log.status === 'error' && log.responseData?.error && (
                          <div className='mt-2 text-rose-500'>
                            {log.responseData.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {log.requestData && (
                    <div>
                      <p className='mb-2 text-zinc-500'>Запрос (Request)</p>
                      <pre
                        className='w-full overflow-x-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-50 dark:border-zinc-800 dark:bg-black'
                        style={{ maxWidth: '100%' }}
                      >
                        {JSON.stringify(log.requestData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.responseData && (
                    <div>
                      <p className='mb-2 text-zinc-500'>Ответ (Response)</p>
                      <pre
                        className='w-full overflow-x-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-50 dark:border-zinc-800 dark:bg-black'
                        style={{ maxWidth: '100%' }}
                      >
                        {JSON.stringify(log.responseData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Pagination logic */}
        {pagination && pagination.totalPages > 1 && (
          <div className='mt-6 flex items-center justify-between'>
            <p className='text-sm text-zinc-500'>
              Показано 10 из {pagination.total} записей (Страница{' '}
              {pagination.page} из {pagination.totalPages})
            </p>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Назад
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Вперед
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
