'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className='flex min-h-[50vh] items-center justify-center p-4'>
      <Card className='w-full max-w-xl'>
        <CardHeader>
          <AlertTriangle
            className='text-destructive mb-2 h-7 w-7'
            aria-hidden='true'
          />
          <CardTitle>Не удалось загрузить данные</CardTitle>
          <CardDescription>
            Мы не показываем нули вместо реальных данных. Попробуйте повторить
            запрос.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Попробовать снова</Button>
        </CardContent>
      </Card>
    </div>
  );
}
