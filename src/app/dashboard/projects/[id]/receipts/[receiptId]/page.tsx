import type { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ReceiptDetailView } from '@/features/marking/components/receiving/receipt-detail-view';

export const metadata: Metadata = {
  title: 'Приёмка маркированных товаров',
  description: 'Сканирование и сверка поставки'
};

export default async function ReceiptPage({
  params
}: {
  params: Promise<{ id: string; receiptId: string }>;
}) {
  const { id, receiptId } = await params;
  return (
    <PageContainer scrollable>
      <ReceiptDetailView projectId={id} receiptId={receiptId} />
    </PageContainer>
  );
}
