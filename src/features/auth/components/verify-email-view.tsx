'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function VerifyEmailViewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error' | 'expired'>('pending');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Если есть токен в URL, автоматически верифицируем
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  async function handleVerify(verificationToken: string) {
    setStatus('verifying');
    
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        toast.success('Email успешно подтвержден!');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        if (data.error?.includes('истек')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        toast.error(data.error || 'Ошибка подтверждения');
      }
    } catch (error) {
      setStatus('error');
      toast.error('Ошибка подтверждения email');
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error('Email не указан');
      return;
    }

    setResendLoading(true);
    
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Письмо отправлено повторно');
      } else {
        toast.error(data.error || 'Ошибка отправки письма');
      }
    } catch (error) {
      toast.error('Ошибка отправки письма');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className='relative container grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
        <div className='flex flex-col space-y-2 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Подтверждение email
          </h1>
          {status === 'pending' && (
            <p className='text-muted-foreground text-sm'>
              Мы отправили письмо с подтверждением на ваш email
            </p>
          )}
          {status === 'verifying' && (
            <p className='text-muted-foreground text-sm'>
              Проверяем ваш email...
            </p>
          )}
          {status === 'success' && (
            <p className='text-green-600 text-sm font-medium'>
              Email успешно подтвержден!
            </p>
          )}
          {status === 'expired' && (
            <p className='text-orange-600 text-sm font-medium'>
              Ссылка истекла
            </p>
          )}
          {status === 'error' && (
            <p className='text-red-600 text-sm font-medium'>
              Ошибка подтверждения
            </p>
          )}
        </div>

        <div className='space-y-4'>
          {status === 'verifying' && (
            <div className='flex flex-col items-center justify-center space-y-4 py-8'>
              <Loader2 className='h-12 w-12 animate-spin text-primary' />
              <p className='text-muted-foreground text-sm'>
                Подтверждаем ваш email...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className='flex flex-col items-center justify-center space-y-4 py-8'>
              <CheckCircle className='h-12 w-12 text-green-600' />
              <p className='text-muted-foreground text-center text-sm'>
                Ваш email успешно подтвержден! Перенаправляем в панель управления...
              </p>
            </div>
          )}

          {status === 'pending' && (
            <div className='space-y-4'>
              <div className='flex flex-col items-center justify-center space-y-4 py-8 border rounded-lg bg-muted/50'>
                <Mail className='h-12 w-12 text-primary' />
                <div className='text-center space-y-2'>
                  <p className='text-sm font-medium'>Проверьте вашу почту</p>
                  {email && (
                    <p className='text-xs text-muted-foreground'>
                      {email.substring(0, 3)}***{email.substring(email.indexOf('@'))}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Перейдите по ссылке в письме для подтверждения
                  </p>
                </div>
              </div>
              
              <div className='space-y-2'>
                <p className='text-xs text-center text-muted-foreground'>
                  Не получили письмо?
                </p>
                <Button
                  onClick={handleResend}
                  disabled={resendLoading}
                  variant='outline'
                  className='w-full'
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Отправка...
                    </>
                  ) : (
                    'Отправить повторно'
                  )}
                </Button>
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div className='space-y-4'>
              <div className='flex flex-col items-center justify-center space-y-4 py-8 border rounded-lg bg-orange-50'>
                <AlertCircle className='h-12 w-12 text-orange-600' />
                <p className='text-sm text-center text-muted-foreground'>
                  Ссылка подтверждения истекла
                </p>
              </div>
              
              <Button
                onClick={handleResend}
                disabled={resendLoading}
                className='w-full'
              >
                {resendLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Отправка...
                  </>
                ) : (
                  'Получить новое письмо'
                )}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className='space-y-4'>
              <div className='flex flex-col items-center justify-center space-y-4 py-8 border rounded-lg bg-red-50'>
                <AlertCircle className='h-12 w-12 text-red-600' />
                <p className='text-sm text-center text-muted-foreground'>
                  Не удалось подтвердить email
                </p>
              </div>
              
              <Button
                onClick={handleResend}
                disabled={resendLoading}
                variant='outline'
                className='w-full'
              >
                {resendLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Отправка...
                  </>
                ) : (
                  'Отправить повторно'
                )}
              </Button>
            </div>
          )}
        </div>

        <div className='text-center'>
          <Button asChild variant='link' className='text-sm'>
            <Link href='/auth/sign-in'>Вернуться к входу</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

