/**
 * @file: page.tsx
 * @description: Страница аналитики заказов и товаров
 * @project: SaaS Bonus System
 * @created: 2026-01-27
 */

import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { AnalyticsClient } from './analytics-client';

export const metadata = {
  title: 'Аналитика | Gupil',
  description: 'Аналитика заказов и товаров'
};

export default async function AnalyticsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      <div className='flex items-center justify-between'>
        <Heading
          title='Аналитика'
          description='Статистика заказов, товаров и продаж'
        />
      </div>

      <Separator className='my-4' />

      <Suspense fallback={<div>Загрузка...</div>}>
        <AnalyticsClient projectId={id} />
      </Suspense>
    </div>
  );
}
