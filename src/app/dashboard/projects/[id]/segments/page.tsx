/**
 * @file: src/app/dashboard/projects/[id]/segments/page.tsx
 * @description: Страница управления сегментами проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, PageContainer
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { SegmentsPageView } from '@/features/segments/components/segments-page-view';

export const metadata: Metadata = {
  title: 'Сегменты - SaaS Bonus System',
  description: 'Управление сегментами пользователей',
};

interface SegmentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SegmentsPage({ params }: SegmentsPageProps) {
  const { id } = await params;

  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <SegmentsPageView projectId={id} />
      </div>
    </PageContainer>
  );
}

