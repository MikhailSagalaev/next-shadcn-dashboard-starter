'use client';

/**
 * @file: src/app/super-admin/login/page.tsx
 * @description: Страница входа супер-администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React Hook Form, shadcn/ui
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/logo';
import { Lock } from 'lucide-react';

const formSchema = z.object({
  password: z.string().min(1, { message: 'Пароль обязателен' })
});

type FormValues = z.infer<typeof formSchema>;

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '' }
  });
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/super-admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: values.password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        const error = data?.error || 'Ошибка входа';
        toast.error(error);
        return;
      }

      toast.success('Вход выполнен успешно');
      router.push('/super-admin');
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Ошибка входа';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='relative container grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
        <div className='flex flex-col space-y-4 text-center'>
          <div className='flex justify-center'>
            <Logo className='text-primary' width={64} height={64} />
          </div>
          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Супер-администратор
            </h1>
            <p className='text-muted-foreground text-sm'>
              Войдите в панель управления системой
            </p>
          </div>
        </div>
        <div className='grid gap-6'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                        <Input
                          type='password'
                          placeholder='Введите пароль супер-администратора'
                          autoComplete='current-password'
                          className='pl-10'
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='submit'
                className='w-full'
                disabled={isLoading}
              >
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
