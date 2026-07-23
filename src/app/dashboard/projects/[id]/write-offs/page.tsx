import type { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { WriteOffsPageView } from '@/features/marking/components/write-offs-page-view';

export const metadata: Metadata = {
  title: 'Списания маркированного товара'
};

export default async function WriteOffsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageContainer scrollable>
      <WriteOffsPageView projectId={id} />
    </PageContainer>
  );
}
