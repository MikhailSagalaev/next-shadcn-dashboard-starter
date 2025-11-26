/**
 * @file: src/app/dashboard/settings/page.tsx
 * @description: Объединенная страница настроек с табами: Профиль, Настройки, Биллинг
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React, UI components
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { User, Settings, CreditCard } from 'lucide-react';
import { ProfileTab } from '@/features/profile/components/profile-tab';
import { SettingsTab } from '@/features/settings/components/settings-tab';
import { BillingTab } from '@/features/billing/components/billing-tab';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('profile');

  useEffect(() => {
    // Проверяем query параметр tab и устанавливаем активный таб
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'settings', 'billing'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Обновляем URL без перезагрузки страницы
    const newUrl =
      value === 'profile'
        ? '/dashboard/settings'
        : `/dashboard/settings?tab=${value}`;
    router.replace(newUrl, { scroll: false });
  };

  return (
    <PageContainer>
      <div className='space-y-6'>
        {/* Заголовок */}
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Настройки</h1>
          <p className='text-muted-foreground'>
            Управление профилем, настройками и подпиской
          </p>
        </div>

        {/* Кнопка возврата */}
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => router.push('/dashboard')}>
            Вернуться в дашборд
          </Button>
        </div>

        {/* Основной контент с табами */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className='space-y-4'
        >
          <TabsList>
            <TabsTrigger value='profile'>
              <User className='mr-2 h-4 w-4' />
              Профиль
            </TabsTrigger>
            <TabsTrigger value='settings'>
              <Settings className='mr-2 h-4 w-4' />
              Настройки
            </TabsTrigger>
            <TabsTrigger value='billing'>
              <CreditCard className='mr-2 h-4 w-4' />
              Биллинг
            </TabsTrigger>
          </TabsList>

          <TabsContent value='profile'>
            <ProfileTab />
          </TabsContent>

          <TabsContent value='settings'>
            <SettingsTab />
          </TabsContent>

          <TabsContent value='billing'>
            <BillingTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
