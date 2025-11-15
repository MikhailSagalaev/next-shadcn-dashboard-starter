/**
 * @file: src/app/dashboard/projects/[id]/orders/[orderId]/page.tsx
 * @description: Детальная страница заказа
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, PageContainer
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { OrderDetailView } from '@/features/orders/components/order-detail-view';

export const metadata: Metadata = {
  title: 'Заказ - SaaS Bonus System',
  description: 'Детальная информация о заказе',
};

interface OrderDetailPageProps {
  params: Promise<{ id: string; orderId: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id, orderId } = await params;
  
  return (
    <PageContainer scrollable={false}>
      <OrderDetailView projectId={id} orderId={orderId} />
    </PageContainer>
  );
}

