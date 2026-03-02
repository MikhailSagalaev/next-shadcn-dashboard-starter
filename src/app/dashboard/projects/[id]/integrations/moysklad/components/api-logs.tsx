/**
 * @file: api-logs.tsx
 * @description: API logs viewer for МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ApiLogsProps {
  integrationId: string;
}

async function getApiLogs(integrationId: string) {
  const logs = await db.moySkladApiLog.findMany({
    where: { integrationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      endpoint: true,
      method: true,
      responseStatus: true,
      processingTimeMs: true,
      errorMessage: true,
      createdAt: true,
    }
  });

  return logs;
}

export async function MoySkladApiLogs({ integrationId }: ApiLogsProps) {
  const logs = await getApiLogs(integrationId);

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История API запросов</CardTitle>
          <CardDescription>
            Последние 20 запросов к Loyalty API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-zinc-500 text-center py-8'>
            Нет запросов для отображения
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История API запросов</CardTitle>
        <CardDescription>
          Последние 20 запросов к Loyalty API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {logs.map((log) => {
            const isSuccess = log.responseStatus >= 200 && log.responseStatus < 300;
            const isError = log.responseStatus >= 400;

            return (
              <div
                key={log.id}
                className='flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
              >
                <div className='flex-1 space-y-1'>
                  <div className='flex items-center gap-3'>
                    <Badge
                      variant='outline'
                      className='font-mono text-xs'
                    >
                      {log.method}
                    </Badge>
                    <span className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                      {log.endpoint}
                    </span>
                  </div>
                  
                  {log.errorMessage && (
                    <p className='text-xs text-red-600 dark:text-red-400'>
                      {log.errorMessage}
                    </p>
                  )}
                  
                  <div className='flex items-center gap-4 text-xs text-zinc-500'>
                    <span>
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                    <span>•</span>
                    <span>{log.processingTimeMs}ms</span>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <Badge
                    variant={isSuccess ? 'default' : isError ? 'destructive' : 'secondary'}
                    className='min-w-[60px] justify-center'
                  >
                    {log.responseStatus}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {logs.length === 20 && (
          <p className='text-xs text-zinc-500 text-center mt-4'>
            Показаны последние 20 запросов
          </p>
        )}
      </CardContent>
    </Card>
  );
}
