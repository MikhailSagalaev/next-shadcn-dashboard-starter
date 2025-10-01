/**
 * @file: src/app/dashboard/projects/[id]/constructor/page.tsx
 * @description: Главная страница визуального конструктора ботов
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotConstructor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { BotConstructor } from '@/features/bot-constructor/components/bot-constructor';

export const metadata: Metadata = {
  title: 'Конструктор бота - SaaS Bonus System',
  description: 'Визуальный конструктор Telegram ботов с drag & drop интерфейсом'
};

interface ConstructorPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConstructorPage({
  params
}: ConstructorPageProps) {
  const { id: projectId } = await params;

  return (
    <PageContainer scrollable={false}>
      <Suspense
        fallback={
          <div className='flex h-96 items-center justify-center'>
            Загрузка конструктора...
          </div>
        }
      >
        <BotConstructor projectId={projectId} />
      </Suspense>
    </PageContainer>
  );
}
