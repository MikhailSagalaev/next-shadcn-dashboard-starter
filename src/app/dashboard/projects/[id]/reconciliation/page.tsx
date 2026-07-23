import type { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ReconciliationPageView } from '@/features/marking/components/reconciliation-page-view';

export const metadata: Metadata = {
  title: 'Сверка маркировки'
};

export default async function ReconciliationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageContainer scrollable>
      <ReconciliationPageView projectId={id} />
    </PageContainer>
  );
}
