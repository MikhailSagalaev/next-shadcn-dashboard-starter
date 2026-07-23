import type { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ReceivingPageView } from '@/features/marking/components/receiving/receiving-page-view';

export const metadata: Metadata = {
  title: 'Приёмки маркированных товаров',
  description: 'Приёмка поставок и сверка Data Matrix'
};

export default async function ReceiptsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageContainer scrollable>
      <ReceivingPageView projectId={id} />
    </PageContainer>
  );
}
