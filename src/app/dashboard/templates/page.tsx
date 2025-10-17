/**
 * @file: src/app/dashboard/templates/page.tsx
 * @description: Страница библиотеки шаблонов ботов
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, BotTemplatesLibrary
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { BotTemplatesLibrary } from '@/features/bot-templates/components/bot-templates-library';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Библиотека шаблонов - SaaS Bonus System',
  description: 'Готовые шаблоны ботов для автоматизации бизнеса'
};

export default async function TemplatesPage() {
  // Получаем информацию о текущем администраторе
  const admin = await getCurrentAdmin();

  if (!admin?.sub) {
    // Перенаправляем на страницу входа если не авторизован
    redirect('/auth/sign-in');
  }

  return (
    <PageContainer scrollable={false}>
      <BotTemplatesLibrary
        userId={admin.sub} // Используем sub из JWT как userId
      />
    </PageContainer>
  );
}
