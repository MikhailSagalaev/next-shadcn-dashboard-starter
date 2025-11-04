/**
 * @file: src/app/super-admin/layout.tsx
 * @description: Layout для панели супер-администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, shadcn/ui sidebar
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import SuperAdminSidebar from '@/components/layout/super-admin-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Супер-админка | SaaS Bonus System',
  description: 'Панель управления системой'
};

export default async function SuperAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SuperAdminSidebar />
      <SidebarInset className='h-screen'>
        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <h1 className='text-lg font-semibold'>Супер-администратор</h1>
        </header>
        <div className='flex-1 overflow-y-auto p-4'>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
