/**
 * @file: src/app/super-admin/errors/page.tsx
 * @description: Страница мониторинга ошибок и логов
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorsTable } from '@/components/super-admin/errors-table';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminErrorsPage() {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3000';

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Мониторинг ошибок</h1>
          <p className='text-muted-foreground'>
            Просмотр системных логов и ошибок
          </p>
        </div>
        <Button asChild variant='outline'>
          <Link href={grafanaUrl} target='_blank' rel='noopener noreferrer'>
            <ExternalLink className='mr-2 h-4 w-4' />
            Открыть Grafana
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Системные логи</CardTitle>
          <CardDescription>
            Ошибки и предупреждения из SystemLog базы данных
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorsTable />
        </CardContent>
      </Card>
    </div>
  );
}
