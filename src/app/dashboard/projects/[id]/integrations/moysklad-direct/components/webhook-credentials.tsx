/**
 * @file: webhook-credentials.tsx
 * @description: Webhook credentials display component with copy functionality
 * @project: SaaS Bonus System
 * @dependencies: React 19
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Copy, Eye, EyeOff, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WebhookCredentialsProps {
  webhookUrl: string;
  webhookSecret: string | null;
}

export function WebhookCredentials({
  webhookUrl,
  webhookSecret
}: WebhookCredentialsProps) {
  const { toast } = useToast();
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const copyToClipboard = async (text: string, type: 'url' | 'secret') => {
    try {
      await navigator.clipboard.writeText(text);

      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      }

      toast({
        title: 'Скопировано',
        description: `${type === 'url' ? 'URL' : 'Secret'} скопирован в буфер обмена`
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Webhook настройки
        </CardTitle>
        <CardDescription>
          Настройте webhook в МойСклад для получения событий
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Webhook URL */}
        <div className='space-y-2'>
          <label className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
            Webhook URL
          </label>
          <div className='flex gap-2'>
            <Input value={webhookUrl} readOnly className='font-mono text-xs' />
            <Button
              variant='outline'
              size='icon'
              onClick={() => copyToClipboard(webhookUrl, 'url')}
            >
              {copiedUrl ? (
                <Check className='h-4 w-4 text-emerald-500' />
              ) : (
                <Copy className='h-4 w-4' />
              )}
            </Button>
          </div>
          <p className='text-xs text-zinc-500 dark:text-zinc-400'>
            Используйте этот URL для настройки webhook в МойСклад
          </p>
        </div>

        {/* Webhook Secret */}
        {webhookSecret && (
          <div className='space-y-2'>
            <label className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
              Webhook Secret
            </label>
            <div className='flex gap-2'>
              <Input
                value={showSecret ? webhookSecret : '••••••••••••••••'}
                readOnly
                className='font-mono text-xs'
                type={showSecret ? 'text' : 'password'}
              />
              <Button
                variant='outline'
                size='icon'
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </Button>
              <Button
                variant='outline'
                size='icon'
                onClick={() => copyToClipboard(webhookSecret, 'secret')}
              >
                {copiedSecret ? (
                  <Check className='h-4 w-4 text-emerald-500' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </Button>
            </div>
            <p className='text-xs text-zinc-500 dark:text-zinc-400'>
              Используйте этот secret для подписи webhook запросов
            </p>
          </div>
        )}

        {/* Setup Instructions */}
        <Accordion type='single' collapsible className='w-full'>
          <AccordionItem
            value='instructions'
            className='border-zinc-200 dark:border-zinc-800'
          >
            <AccordionTrigger className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
              Инструкция по настройке webhook
            </AccordionTrigger>
            <AccordionContent className='space-y-3 text-sm text-zinc-600 dark:text-zinc-400'>
              <div>
                <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                  Шаг 1: Откройте настройки МойСклад
                </p>
                <p>Перейдите в админ-панель МойСклад → Настройки → Вебхуки</p>
              </div>

              <div>
                <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                  Шаг 2: Создайте новый webhook
                </p>
                <p>
                  Нажмите "Добавить вебхук" и выберите тип "Бонусная транзакция"
                </p>
              </div>

              <div>
                <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                  Шаг 3: Укажите URL
                </p>
                <p>Вставьте Webhook URL из поля выше</p>
              </div>

              <div>
                <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                  Шаг 4: Настройте подпись
                </p>
                <p>
                  Включите подпись запросов и вставьте Webhook Secret из поля
                  выше
                </p>
              </div>

              <div>
                <p className='font-medium text-zinc-900 dark:text-zinc-100'>
                  Шаг 5: Сохраните настройки
                </p>
                <p>
                  Нажмите "Сохранить" и проверьте работу через тестовую
                  транзакцию
                </p>
              </div>

              <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20'>
                <p className='text-xs text-amber-900 dark:text-amber-100'>
                  <strong>Важно:</strong> Webhook будет получать события только
                  для транзакций бонусной программы, указанной в настройках
                  интеграции.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
