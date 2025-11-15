/**
 * @file: src/app/dashboard/projects/[id]/chats/[chatId]/page.tsx
 * @description: Страница просмотра чата
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { ChatView } from '@/features/chats/components/chat-view';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Чат - SaaS Bonus System',
};

export default async function ChatPage({
  params
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    notFound();
  }

  const { id: projectId, chatId } = await params;

  // Проверяем доступ к проекту
  await ProjectService.verifyProjectAccess(projectId, admin.sub);

  // Загружаем чат
  const chat = await db.chat.findFirst({
    where: {
      id: chatId,
      projectId,
    },
    include: {
      channel: true,
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!chat) {
    notFound();
  }

  return (
    <PageContainer scrollable={true}>
      <div className='space-y-6 md:px-6'>
        <ChatView projectId={projectId} chatId={chatId} chat={chat} />
      </div>
    </PageContainer>
  );
}

