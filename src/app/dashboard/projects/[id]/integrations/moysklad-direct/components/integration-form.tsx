/**
 * @file: integration-form.tsx
 * @description: МойСклад Direct integration configuration form
 * @project: SaaS Bonus System
 * @dependencies: React Hook Form, Zod
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Loader2, Save, Trash2, TestTube2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  accountId: z.string().uuid('Account ID должен быть в формате UUID'),
  apiToken: z.string().min(1, 'API Token обязателен'),
  bonusProgramId: z
    .string()
    .uuid('Bonus Program ID должен быть в формате UUID'),
  syncDirection: z.enum(['BIDIRECTIONAL', 'MOYSKLAD_TO_US', 'US_TO_MOYSKLAD']),
  autoSync: z.boolean(),
  isActive: z.boolean()
});

type FormValues = z.infer<typeof formSchema>;

interface IntegrationFormProps {
  projectId: string;
  integration: {
    accountId: string;
    bonusProgramId: string;
    syncDirection: string;
    autoSync: boolean;
    isActive: boolean;
  } | null;
}

export function IntegrationForm({
  projectId,
  integration
}: IntegrationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: integration?.accountId || '',
      apiToken: '', // Не показываем сохраненный токен
      bonusProgramId: integration?.bonusProgramId || '',
      syncDirection: (integration?.syncDirection as any) || 'BIDIRECTIONAL',
      autoSync: integration?.autoSync ?? true,
      isActive: integration?.isActive ?? false
    }
  });

  async function onSubmit(data: FormValues) {
    try {
      setLoading(true);

      const method = integration ? 'PUT' : 'POST';
      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct`,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save integration');
      }

      toast({
        title: 'Успешно сохранено',
        description: integration
          ? 'Настройки МойСклад Direct интеграции обновлены'
          : 'МойСклад Direct интеграция создана'
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function onTestConnection() {
    try {
      setTesting(true);

      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct/test`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Подключение успешно',
          description: 'Соединение с МойСклад API установлено'
        });
      } else {
        toast({
          title: 'Ошибка подключения',
          description: data.error || data.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  }

  async function onDelete() {
    if (!confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/projects/${projectId}/integrations/moysklad-direct`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete integration');
      }

      toast({
        title: 'Интеграция удалена',
        description: 'МойСклад Direct интеграция успешно удалена'
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить интеграцию',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Настройки интеграции
        </CardTitle>
        <CardDescription>
          Настройте параметры подключения к МойСклад API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* API Credentials */}
            <div className='space-y-4'>
              <h3 className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                API Credentials
              </h3>

              <FormField
                control={form.control}
                name='accountId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      UUID организации в МойСклад (из URL админ-панели)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='apiToken'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Token</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={
                          integration ? '••••••••' : 'Введите Bearer токен'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {integration
                        ? 'Оставьте пустым, чтобы не менять токен'
                        : 'Bearer токен для доступа к API (Настройки → Токены)'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='bonusProgramId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bonus Program ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      UUID бонусной программы в МойСклад
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='border-t border-zinc-200 dark:border-zinc-800' />

            {/* Sync Settings */}
            <div className='space-y-4'>
              <h3 className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                Настройки синхронизации
              </h3>

              <FormField
                control={form.control}
                name='syncDirection'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Направление синхронизации</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Выберите направление' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='BIDIRECTIONAL'>
                          Двусторонняя (онлайн ↔ офлайн)
                        </SelectItem>
                        <SelectItem value='MOYSKLAD_TO_US'>
                          Только МойСклад → Онлайн
                        </SelectItem>
                        <SelectItem value='US_TO_MOYSKLAD'>
                          Только Онлайн → МойСклад
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Контролирует, в каких направлениях синхронизируются бонусы
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='autoSync'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        Автоматическая синхронизация
                      </FormLabel>
                      <FormDescription>
                        Синхронизировать бонусы автоматически при операциях
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='isActive'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>Активна</FormLabel>
                      <FormDescription>
                        Включить/выключить интеграцию
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Button type='submit' disabled={loading} className='flex-1'>
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                <Save className='mr-2 h-4 w-4' />
                {integration ? 'Обновить' : 'Создать'}
              </Button>

              {integration && (
                <>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={onTestConnection}
                    disabled={testing}
                  >
                    {testing && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    <TestTube2 className='mr-2 h-4 w-4' />
                    Тест
                  </Button>

                  <Button
                    type='button'
                    variant='destructive'
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    {deleting && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    <Trash2 className='mr-2 h-4 w-4' />
                    Удалить
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
