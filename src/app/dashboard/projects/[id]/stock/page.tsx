import type { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { StockPageView } from '@/features/marking/components/stock/stock-page-view';

export const metadata: Metadata = {
  title: 'Склад маркированных товаров',
  description: 'Реестр физических упаковок и кодов Data Matrix'
};

export default async function StockPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageContainer scrollable>
      <StockPageView projectId={id} />
    </PageContainer>
  );
}
