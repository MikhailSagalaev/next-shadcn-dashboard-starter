/**
 * @file: error.tsx
 * @description: Error boundary для страницы управления бонусами
 * @project: SaaS Bonus System
 * @dependencies: next.js, react
 * @created: 2025-09-29
 * @author: AI Assistant + User
 */

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Логируем ошибку
    console.error('[BonusPageError]', error);
  }, [error]);

  return (
    <div className='container mx-auto py-8'>
      <Card className='mx-auto max-w-2xl'>
        <CardHeader>
          <CardTitle className='text-red-600'>
            Ошибка загрузки страницы бонусов
          </CardTitle>
          <CardDescription>
            Произошла ошибка при загрузке страницы управления бонусами
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
            <p className='text-sm font-medium text-red-700'>Детали ошибки:</p>
            <p className='mt-1 font-mono text-xs text-red-600'>
              {error.message}
            </p>
            {error.digest && (
              <p className='mt-1 text-xs text-red-500'>
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div className='flex gap-3'>
            <Button onClick={reset} variant='default'>
              Попробовать снова
            </Button>
            <Button onClick={() => window.location.reload()} variant='outline'>
              Перезагрузить страницу
            </Button>
            <Button
              onClick={() => (window.location.href = '/dashboard')}
              variant='secondary'
            >
              Вернуться в дашборд
            </Button>
          </div>

          <div className='text-muted-foreground text-sm'>
            <p>Если ошибка повторяется, обратитесь к администратору системы.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
