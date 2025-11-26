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
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

  const tabs = [
    {
      value: 'profile',
      label: 'Профиль',
      icon: User
    },
    {
      value: 'settings',
      label: 'Настройки',
      icon: Settings
    },
    {
      value: 'billing',
      label: 'Биллинг',
      icon: CreditCard
    }
  ];

  return (
    <PageContainer>
      <div className='space-y-6'>
        {/* Заголовок */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className='text-3xl font-bold tracking-tight'>Настройки</h1>
          <p className='text-muted-foreground mt-1'>
            Управление профилем, настройками и подпиской
          </p>
        </motion.div>

        {/* Основной контент с табами */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className='w-full space-y-6'
        >
          <TabsList className='bg-muted/50 grid h-auto w-full grid-cols-3 gap-2 rounded-lg p-1.5'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'relative flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-all duration-300',
                    'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md',
                    'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                    'data-[state=inactive]:hover:bg-muted/80',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId='activeTab'
                      className='bg-background border-border/50 absolute inset-0 rounded-md border shadow-md'
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'relative z-10 h-4 w-4 transition-transform duration-300',
                      isActive && 'scale-110'
                    )}
                  />
                  <span className='relative z-10'>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <AnimatePresence mode='wait'>
            <TabsContent
              value='profile'
              className='mt-0'
              key={activeTab === 'profile' ? 'profile' : ''}
            >
              {activeTab === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProfileTab />
                </motion.div>
              )}
            </TabsContent>

            <TabsContent
              value='settings'
              className='mt-0'
              key={activeTab === 'settings' ? 'settings' : ''}
            >
              {activeTab === 'settings' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <SettingsTab />
                </motion.div>
              )}
            </TabsContent>

            <TabsContent
              value='billing'
              className='mt-0'
              key={activeTab === 'billing' ? 'billing' : ''}
            >
              {activeTab === 'billing' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <BillingTab />
                </motion.div>
              )}
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </PageContainer>
  );
}
