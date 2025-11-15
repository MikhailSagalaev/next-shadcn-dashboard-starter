/**
 * @file: src/app/dashboard/projects/[id]/products/page.tsx
 * @description: Страница управления товарами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ProductsPageView } from '@/features/products/components/products-page-view';

export const metadata: Metadata = {
  title: 'Товары - SaaS Bonus System',
};

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <ProductsPageView projectId={id} />
      </div>
    </PageContainer>
  );
}

