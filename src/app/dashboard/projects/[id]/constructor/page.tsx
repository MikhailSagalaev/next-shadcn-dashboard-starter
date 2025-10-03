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
    <div className='flex h-screen flex-col overflow-hidden'>
      <Suspense
        fallback={
          <div className='flex h-full items-center justify-center'>
            <div className='text-center'>
              <div className='border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2'></div>
              <p className='text-muted-foreground mt-4'>
                Загрузка конструктора...
              </p>
            </div>
          </div>
        }
      >
        <BotConstructor projectId={projectId} />
      </Suspense>
    </div>
  );
}
