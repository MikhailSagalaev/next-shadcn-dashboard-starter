/**
 * @file: src/app/dashboard/projects/[id]/orders/page.tsx
 * @description: Страница управления заказами проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, PageContainer
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { OrdersPageView } from '@/features/orders/components/orders-page-view';

export const metadata: Metadata = {
  title: 'Заказы - SaaS Bonus System',
  description: 'Управление заказами проекта',
};

interface OrdersPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { id } = await params;
  
  return (
    <PageContainer scrollable={false}>
      <OrdersPageView projectId={id} />
    </PageContainer>
  );
}

