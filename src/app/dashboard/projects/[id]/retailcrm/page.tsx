/**
 * @file: src/app/dashboard/projects/[id]/retailcrm/page.tsx
 * @description: Страница настройки RetailCRM интеграции
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { RetailCrmIntegrationView } from '@/features/retailcrm/components/retailcrm-integration-view';

export const metadata: Metadata = {
  title: 'RetailCRM - SaaS Bonus System',
};

export default async function RetailCrmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <RetailCrmIntegrationView projectId={id} />
      </div>
    </PageContainer>
  );
}

