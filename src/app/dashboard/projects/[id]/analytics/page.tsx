/**
 * @file: src/app/dashboard/projects/[id]/analytics/page.tsx
 * @description: Страница аналитики и статистики проекта (полная ширина)
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, Charts
 * @created: 2024-12-31
 * @updated: 2026-01-21 - Полная ширина без PageContainer
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import { ProjectAnalyticsView } from '@/features/projects/components/project-analytics-view';

export const metadata: Metadata = {
  title: 'Аналитика проекта - SaaS Bonus System',
  description: 'Статистика, графики и аналитические данные проекта'
};

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params;

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      <ProjectAnalyticsView projectId={id} />
    </div>
  );
}
