/**
 * @file: src/app/dashboard/projects/[id]/mailings/page.tsx
 * @description: Страница управления рассылками
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { MailingsPageView } from '@/features/mailings/components/mailings-page-view';

export const metadata: Metadata = {
  title: 'Рассылки - SaaS Bonus System',
};

export default async function MailingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <MailingsPageView projectId={id} />
      </div>
    </PageContainer>
  );
}

