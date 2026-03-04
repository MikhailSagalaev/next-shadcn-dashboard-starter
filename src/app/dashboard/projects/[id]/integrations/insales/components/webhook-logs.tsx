'use client';

/**
 * @file: webhook-logs.tsx
 * @description: InSales Webhook Logs Display
 * @project: SaaS Bonus System
 */

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface WebhookLog {
  id: string;
  event: string;
  status: number;
  success: boolean;
  error: string | null;
  processedAt: Date;
  payload: any;
  response: any;
}

export function InSalesWebhookLogs({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/integrations/insales/logs`
      );
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [projectId]);

  const getEventBadge = (event: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      'orders/create': 'default',
      'orders/update': 'secondary',
      'clients/create': 'outline',
      'clients/update': 'secondary'
    };
    return variants[event] || 'secondary';
  };

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge variant='default' className='bg-green-500'>
        Успешно
      </Badge>
    ) : (
      <Badge variant='destructive'>Ошибка</Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Логи Webhooks</CardTitle>
            <CardDescription>
              История обработки webhooks от InSales (последние 50)
            </CardDescription>
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className='py-8 text-center text-sm text-zinc-500'>
            Загрузка логов...
          </div>
        ) : logs.length === 0 ? (
          <div className='py-8 text-center text-sm text-zinc-500'>
            Пока нет логов webhooks
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Событие</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead className='w-[50px]'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className='cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    >
                      <TableCell>
                        <Badge variant={getEventBadge(log.event)}>
                          {log.event}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.success)}</TableCell>
                      <TableCell>
                        <code className='text-xs'>{log.status}</code>
                      </TableCell>
                      <TableCell className='text-xs text-zinc-500'>
                        {formatDistanceToNow(new Date(log.processedAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() =>
                            setExpandedLog(
                              expandedLog === log.id ? null : log.id
                            )
                          }
                        >
                          {expandedLog === log.id ? (
                            <ChevronUp className='h-4 w-4' />
                          ) : (
                            <ChevronDown className='h-4 w-4' />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedLog === log.id && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='bg-zinc-50 dark:bg-zinc-900'
                        >
                          <div className='space-y-4 p-4'>
                            {/* Error */}
                            {log.error && (
                              <div>
                                <h4 className='mb-2 text-sm font-medium text-red-600'>
                                  Ошибка:
                                </h4>
                                <pre className='overflow-x-auto rounded border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950'>
                                  {log.error}
                                </pre>
                              </div>
                            )}

                            {/* Payload */}
                            <div>
                              <h4 className='mb-2 text-sm font-medium'>
                                Payload:
                              </h4>
                              <pre className='max-h-64 overflow-x-auto overflow-y-auto rounded border bg-white p-3 text-xs dark:bg-zinc-950'>
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>

                            {/* Response */}
                            {log.response && (
                              <div>
                                <h4 className='mb-2 text-sm font-medium'>
                                  Response:
                                </h4>
                                <pre className='max-h-64 overflow-x-auto overflow-y-auto rounded border bg-white p-3 text-xs dark:bg-zinc-950'>
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
