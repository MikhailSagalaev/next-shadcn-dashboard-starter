/**
 * @file: src/app/super-admin/page.tsx
 * @description: Главная страница панели супер-администратора
 * @project: SaaS Bonus System
 * @dependencies: Next.js, shadcn/ui
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  FolderKanban,
  Bot,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import SuperAdminStats from '@/components/super-admin/stats';

export default async function SuperAdminDashboard() {
  let stats = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5006'}/api/super-admin/stats`, {
      cache: 'no-store'
    });
    if (res.ok) {
      stats = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
        <p className='text-muted-foreground'>
          Обзор системы и статистика
        </p>
      </div>

      {/* Метрики */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Пользователи</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.metrics?.totalUsers || 0}</div>
            <p className='text-xs text-muted-foreground'>
              Всего пользователей
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Проекты</CardTitle>
            <FolderKanban className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.metrics?.totalProjects || 0}</div>
            <p className='text-xs text-muted-foreground'>
              Всего проектов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Боты</CardTitle>
            <Bot className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.metrics?.activeBots || 0} / {stats?.metrics?.totalBots || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              Активных / Всего
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>MRR</CardTitle>
            <CreditCard className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.metrics?.mrr || 0} ₽
            </div>
            <p className='text-xs text-muted-foreground'>
              Месячный доход
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Ошибки</CardTitle>
            <AlertTriangle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.recent?.errors?.length || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              Последние ошибки
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Компонент со статистикой и графиками */}
      <SuperAdminStats stats={stats} />
    </div>
  );
}
