/**
 * @file: src/features/auth/components/reset-password-view.tsx
 * @description: Компонент установки нового пароля
 * @project: SaaS Bonus System
 * @dependencies: React Hook Form, Zod
 * @created: 2025-10-02
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(72, 'Максимум 72 символа'),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSuccess, setIsSuccess] = useState(false);
  const token = searchParams.get('token');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (!token) {
      toast.error('Отсутствует токен восстановления');
      router.push('/auth/forgot-password');
    }
  }, [token, router]);

  async function handleSubmit(values: FormValues) {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: values.password
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Ошибка установки пароля');
      }

      toast.success('Пароль успешно изменён');
      setIsSuccess(true);

      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push('/auth/sign-in');
      }, 2000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Произошла ошибка';
      toast.error(message);
    }
  }

  if (isSuccess) {
    return (
      <div className='space-y-4 text-center'>
        <h2 className='text-2xl font-semibold'>Пароль изменён!</h2>
        <p className='text-muted-foreground text-sm'>
          Вы будете перенаправлены на страницу входа...
        </p>
      </div>
    );
  }

  return (
    <div className='grid gap-6'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Новый пароль</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder='Введите новый пароль'
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Подтвердите пароль</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder='Повторите пароль'
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type='submit'
            className='w-full'
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? 'Сохранение...'
              : 'Установить пароль'}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default function ResetPasswordView() {
  return (
    <div className='relative container grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
        <div className='flex flex-col space-y-2 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Установка нового пароля
          </h1>
          <p className='text-muted-foreground text-sm'>
            Введите новый пароль для вашего аккаунта
          </p>
        </div>

        <Suspense fallback={<div>Загрузка...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <p className='text-muted-foreground px-8 text-center text-sm'>
          Вспомнили пароль?{' '}
          <Link
            href='/auth/sign-in'
            className='hover:text-primary underline underline-offset-4'
          >
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
