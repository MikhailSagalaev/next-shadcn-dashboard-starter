/**
 * @file: stats-cards.tsx
 * @description: Sync statistics cards component
 * @project: SaaS Bonus System
 * @dependencies: React 19, framer-motion
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

'use client';

import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Users, AlertCircle } from 'lucide-react';

interface SyncStatsCardsProps {
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSyncDuration: number | null;
  };
}

export function SyncStatsCards({ stats }: SyncStatsCardsProps) {
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
      title: 'Всего синхронизаций',
      value: stats.totalSyncs,
      description: 'За все время',
      icon: Users,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Успешных',
      value: stats.successfulSyncs,
      description: `${stats.totalSyncs > 0 ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100) : 0}% от общего числа`,
      icon: ArrowUpRight,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'С ошибками',
      value: stats.failedSyncs,
      description: `${stats.totalSyncs > 0 ? Math.round((stats.failedSyncs / stats.totalSyncs) * 100) : 0}% от общего числа`,
      icon: AlertCircle,
      iconColor: 'text-rose-500',
      iconBgColor: 'bg-rose-500/10'
    },
    {
      title: 'Последняя синхронизация',
      value: stats.lastSyncDuration
        ? `${(stats.lastSyncDuration / 1000).toFixed(2)}s`
        : 'N/A',
      description: 'Время выполнения',
      icon: ArrowDownRight,
      iconColor: 'text-amber-500',
      iconBgColor: 'bg-amber-500/10'
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
