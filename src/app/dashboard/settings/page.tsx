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
          <p className='text-muted-foreground mt-1'>
            Управление профилем, настройками и подпиской
          </p>
        </div>

        {/* Основной контент с табами */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className='w-full'
        >
          <TabsList className='flex w-full'>
            <TabsTrigger
              value='profile'
              className='flex flex-1 items-center justify-center gap-2'
            >
              <User className='h-4 w-4' />
              Профиль
            </TabsTrigger>
            <TabsTrigger
              value='settings'
              className='flex flex-1 items-center justify-center gap-2'
            >
              <Settings className='h-4 w-4' />
              Настройки
            </TabsTrigger>
            <TabsTrigger
              value='billing'
              className='flex flex-1 items-center justify-center gap-2'
            >
              <CreditCard className='h-4 w-4' />
              Биллинг
            </TabsTrigger>
          </TabsList>

          <TabsContent value='profile' className='mt-6'>
            <ProfileTab />
          </TabsContent>

          <TabsContent value='settings' className='mt-6'>
            <SettingsTab />
          </TabsContent>

          <TabsContent value='billing' className='mt-6'>
            <BillingTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
