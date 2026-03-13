/**
 * @file: page.tsx
 * @description: Главная страница дашборда (Server Component)
 * @project: SaaS Bonus System
 * @created: 2025-01-31
 * @updated: 2026-01-17 (Refactoring to RSC & Premium UI)
 */

import { Suspense } from 'react';
import { getDashboardStats } from './data-access';
import { DashboardStats } from './components/dashboard-stats';
import { RecentProjects } from './components/recent-projects';
import { DashboardCharts } from './components/dashboard-charts';
import { QuickActions } from './components/quick-actions';

export const metadata = {
  title: 'Дашборд | Gupil',
  description: 'Обзор системы бонусных программ'
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  // Если нет проектов, показываем приветственный экран
  if (stats.totalProjects === 0) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center px-6 py-12'>
        <div className='mx-auto max-w-2xl text-center'>
          <div className='mb-6 flex justify-center'>
            <div className='flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'>
              <svg
                className='h-10 w-10'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                />
              </svg>
            </div>
          </div>

          <h1 className='mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
            Добро пожаловать в Gupil!
          </h1>

          <p className='mb-8 text-lg text-zinc-600 dark:text-zinc-400'>
            Создайте свой первый проект, чтобы начать работу с бонусной
            системой. Это займет всего несколько минут.
          </p>

          <div className='mb-8 grid gap-4 text-left sm:grid-cols-3'>
            <div className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M13 10V3L4 14h7v7l9-11h-7z'
                  />
                </svg>
              </div>
              <h3 className='mb-1 font-semibold text-zinc-900 dark:text-zinc-50'>
                Быстрый старт
              </h3>
              <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                Настройка за 5 минут
              </p>
            </div>

            <div className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
                  />
                </svg>
              </div>
              <h3 className='mb-1 font-semibold text-zinc-900 dark:text-zinc-50'>
                Гибкие настройки
              </h3>
              <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                Настройте под свой бизнес
              </p>
            </div>

            <div className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
              <h3 className='mb-1 font-semibold text-zinc-900 dark:text-zinc-50'>
                Готовые шаблоны
              </h3>
              <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                Используйте готовые решения
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:justify-center'>
            <a
              href='/dashboard/projects/new'
              className='inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:shadow-indigo-500/30'
            >
              <svg
                className='mr-2 h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                />
              </svg>
              Создать первый проект
            </a>

            <a
              href='/docs'
              className='inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-6 py-3 text-base font-semibold text-zinc-900 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800'
            >
              <svg
                className='mr-2 h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                />
              </svg>
              Документация
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      <Suspense fallback={<div>Loading stats...</div>}>
        <DashboardStats
          totalProjects={stats.totalProjects}
          totalUsers={stats.totalUsers}
          activeUsers={stats.activeUsers}
          activeBots={stats.activeBots}
          totalBonuses={stats.totalBonuses}
        />
      </Suspense>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-7'>
        <div className='col-span-1 lg:col-span-4'>
          <DashboardCharts
            data={stats.userGrowth}
            dataByDays={stats.userGrowthByDays}
            dataByWeeks={stats.userGrowthByWeeks}
          />
        </div>
        <div className='col-span-1 lg:col-span-3'>
          <QuickActions />
        </div>
      </div>

      <div className='grid grid-cols-1'>
        <RecentProjects projects={stats.recentProjects} />
      </div>
    </div>
  );
}
