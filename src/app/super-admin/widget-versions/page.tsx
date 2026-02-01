/**
 * @file: src/app/super-admin/widget-versions/page.tsx
 * @description: Страница управления версиями виджета в супер-админке
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { getWidgetVersionPageData } from './data-access';
import { WidgetVersionStats } from './components/widget-version-stats';
import { WidgetVersionTable } from './components/widget-version-table';

export const metadata = {
  title: 'Управление версиями виджета | Gupil Super Admin',
  description: 'Контроль версий виджета для всех проектов'
};

export default async function WidgetVersionsPage() {
  const data = await getWidgetVersionPageData();

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Heading
          title='Управление версиями виджета'
          description='Контроль миграции с legacy на universal архитектуру'
        />
      </div>

      <Separator className='my-4' />

      {/* Stats Cards */}
      <Suspense fallback={<div>Загрузка статистики...</div>}>
        <WidgetVersionStats stats={data.stats} />
      </Suspense>

      {/* Projects Table */}
      <div className='grid grid-cols-1'>
        <Suspense fallback={<div>Загрузка проектов...</div>}>
          <WidgetVersionTable projects={data.projects} />
        </Suspense>
      </div>
    </div>
  );
}
