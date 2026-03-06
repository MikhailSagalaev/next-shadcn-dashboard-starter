'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Webhook,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebhookManagerProps {
  projectId: string;
}

interface MoySkladWebhook {
  id: string;
  entityType: string;
  action: string;
  url: string;
  enabled: boolean;
}

export function WebhookManager({ projectId }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<MoySkladWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct/webhooks`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch webhooks');
      }

      const data = await response.json();
      setWebhooks(data.webhooks);

      toast({
        title: 'Вебхуки загружены',
        description: `Найдено ${data.total} вебхуков`
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить вебхуки',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createWebhooks = async () => {
    setCreating(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct/webhooks`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create webhooks');
      }

      const data = await response.json();

      toast({
        title: 'Вебхуки созданы',
        description: `Создано: ${data.created}, Ошибок: ${data.failed}`
      });

      // Refresh list
      await fetchWebhooks();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать вебхуки',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteWebhooks = async () => {
    if (
      !confirm(
        'Вы уверены? Это удалит все вебхуки для этой интеграции из МойСклад.'
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct/webhooks`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete webhooks');
      }

      const data = await response.json();

      toast({
        title: 'Вебхуки удалены',
        description: `Удалено: ${data.deleted}, Ошибок: ${data.failed}`
      });

      // Refresh list
      setWebhooks([]);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить вебхуки',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-xl font-semibold'>
              <Webhook className='h-5 w-5 text-indigo-500' />
              Управление вебхуками
            </CardTitle>
            <CardDescription>
              Автоматическая настройка вебхуков в МойСклад
            </CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={fetchWebhooks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Actions */}
        <div className='flex gap-2'>
          <Button
            onClick={createWebhooks}
            disabled={creating || loading}
            className='flex-1'
          >
            {creating ? (
              <>
                <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                Создание...
              </>
            ) : (
              <>
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Создать вебхуки
              </>
            )}
          </Button>

          {webhooks.length > 0 && (
            <Button
              variant='destructive'
              onClick={deleteWebhooks}
              disabled={deleting || loading}
            >
              {deleting ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className='mr-2 h-4 w-4' />
                  Удалить все
                </>
              )}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className='rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/30'>
          <p className='font-medium text-blue-900 dark:text-blue-100'>
            Что делают вебхуки?
          </p>
          <ul className='mt-2 space-y-1 text-blue-700 dark:text-blue-300'>
            <li>• Автоматически синхронизируют бонусные операции</li>
            <li>• Обновляют данные клиентов при изменениях</li>
            <li>• Начисляют бонусы при новых продажах</li>
          </ul>
        </div>

        {/* Webhooks List */}
        <AnimatePresence>
          {webhooks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className='space-y-2'
            >
              <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                Активные вебхуки ({webhooks.length}):
              </p>
              {webhooks.map((webhook) => (
                <motion.div
                  key={webhook.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className='flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900'
                >
                  <div className='flex items-center gap-3'>
                    {webhook.enabled ? (
                      <CheckCircle2 className='h-4 w-4 text-emerald-500' />
                    ) : (
                      <XCircle className='h-4 w-4 text-zinc-400' />
                    )}
                    <div>
                      <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                        {webhook.entityType}
                      </p>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        {webhook.action}
                      </p>
                    </div>
                  </div>
                  <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                    {webhook.enabled ? 'Активен' : 'Отключен'}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {webhooks.length === 0 && !loading && (
          <div className='rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700'>
            <Webhook className='mx-auto h-8 w-8 text-zinc-400' />
            <p className='mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
              Вебхуки не настроены
            </p>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              Нажмите "Создать вебхуки" для автоматической настройки
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
