'use client';
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
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Mail } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Введите корректный email' }),
  password: z.string().min(1, { message: 'Пароль обязателен' })
});

type FormValues = z.infer<typeof formSchema>;

export default function SignInViewPage({ stars }: { stars: number }) {
  return (
    <div className='relative container grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
        <div className='flex flex-col space-y-4 text-center'>
          <div className='flex justify-center'>
            <Logo className='text-primary' width={64} height={64} />
          </div>
          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Добро пожаловать
            </h1>
            <p className='text-muted-foreground text-sm'>
              Войдите в свой аккаунт
            </p>
          </div>
        </div>
        <AuthForm />
        <p className='text-muted-foreground px-8 text-center text-sm'>
          Нет аккаунта?{' '}
          <Link
            href='/auth/sign-up'
            className='hover:text-primary underline underline-offset-4'
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}

function AuthForm() {
  const router = useRouter();
  const [showResendOption, setShowResendOption] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' }
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiError = (data?.error as string) || 'Ошибка входа';
        const apiMessage = data?.message as string;
        
        // Если ошибка связана с неподтвержденным email, показываем опцию повторной отправки
        if (apiError === 'Email не подтвержден' || res.status === 403) {
          setShowResendOption(true);
          setUserEmail(values.email);
          toast.error(apiMessage || apiError);
        } else {
          setShowResendOption(false);
          // Пробросить ошибки в форму, если есть детали
          if (data?.details?.fieldErrors) {
            const fieldErrors = data.details.fieldErrors as Record<
              string,
              string[]
            >;
            Object.entries(fieldErrors).forEach(([key, messages]) => {
              form.setError(key as keyof FormValues, {
                type: 'server',
                message: messages?.[0] ?? apiError
              });
            });
          } else {
            toast.error(apiError);
          }
        }
        return;
      }

      setShowResendOption(false);
      toast.success('Вход выполнен успешно');
      router.push('/dashboard');
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Ошибка входа';
      toast.error(message);
    }
  }

  async function handleResendVerification() {
    if (!userEmail) return;
    
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Ссылка для подтверждения была отправлена на ваш email.');
      } else {
        toast.error(data.error || 'Не удалось отправить письмо повторно.');
      }
    } catch (error) {
      toast.error('Произошла ошибка при отправке письма.');
    }
  }

  return (
    <div className='grid gap-6'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Эл. почта</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='admin@example.com'
                    autoComplete='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between'>
                  <FormLabel>Пароль</FormLabel>
                  <Link
                    href='/auth/forgot-password'
                    className='text-muted-foreground hover:text-primary text-sm underline underline-offset-4'
                  >
                    Забыли пароль?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type='password'
                    placeholder='Введите пароль'
                    autoComplete='current-password'
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
            {form.formState.isSubmitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </Form>
      
      {showResendOption && (
        <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
          <p className='text-sm text-yellow-800 mb-2'>
            Email не подтвержден. Нужна новая ссылка для подтверждения?
          </p>
          <Button
            variant='outline'
            size='sm'
            onClick={handleResendVerification}
            className='w-full'
          >
            <Mail className='mr-2 h-4 w-4' />
            Отправить письмо повторно
          </Button>
        </div>
      )}
    </div>
  );
}
