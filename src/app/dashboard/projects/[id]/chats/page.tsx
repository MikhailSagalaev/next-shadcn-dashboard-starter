/**
 * @file: src/app/dashboard/projects/[id]/chats/page.tsx
 * @description: Страница управления чатами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ChatsPageView } from '@/features/chats/components/chats-page-view';

export const metadata: Metadata = {
  title: 'Чаты - SaaS Bonus System',
};

export default async function ChatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <ChatsPageView projectId={id} />
      </div>
    </PageContainer>
  );
}

