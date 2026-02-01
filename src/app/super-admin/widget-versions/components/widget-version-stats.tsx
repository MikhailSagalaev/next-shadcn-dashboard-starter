/**
 * @file: src/app/super-admin/widget-versions/components/widget-version-stats.tsx
 * @description: Статистика по версиям виджета
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

'use client';

import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Package, Rocket, TrendingUp, Activity } from 'lucide-react';
import type { WidgetVersionStats as StatsType } from '../data-access';

interface WidgetVersionStatsProps {
  stats: StatsType;
}

export function WidgetVersionStats({ stats }: WidgetVersionStatsProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  const statsData = [
    {
      title: 'Всего проектов',
      value: stats.totalProjects,
      description: 'Общее количество',
      icon: Activity,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Legacy виджет',
      value: stats.legacyProjects,
      description: `${stats.legacyPercentage}% от общего числа`,
      icon: Package,
      iconColor: 'text-amber-500',
      iconBgColor: 'bg-amber-500/10'
    },
    {
      title: 'Universal виджет',
      value: stats.universalProjects,
      description: `${stats.universalPercentage}% от общего числа`,
      icon: Rocket,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Прогресс миграции',
      value: `${stats.universalPercentage}%`,
      description: 'Мигрировано на universal',
      icon: TrendingUp,
      iconColor: 'text-purple-500',
      iconBgColor: 'bg-purple-500/10'
    }
  ];

  return (
    <motion.div
      variants={container}
      initial='hidden'
      animate='show'
      className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'
    >
      {statsData.map((stat, index) => (
        <motion.div key={index} variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div
              className={`absolute top-4 right-4 rounded-full ${stat.iconBgColor} p-2.5 ${stat.iconColor}`}
            >
              <stat.icon className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                {stat.title}
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {stat.value}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {stat.description}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
