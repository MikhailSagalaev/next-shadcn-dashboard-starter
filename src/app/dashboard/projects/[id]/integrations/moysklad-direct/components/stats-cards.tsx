/**
 * @file: stats-cards.tsx
 * @description: Sync statistics cards with animations
 * @project: SaaS Bonus System
 * @dependencies: React 19, framer-motion
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

'use client';

import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SyncStatsCardsProps {
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncTime: Date | null;
    totalBonusSynced: number;
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
      description: 'Общее количество операций',
      icon: RefreshCw,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Успешность',
      value: `${stats.successRate.toFixed(1)}%`,
      description: `${stats.successfulSyncs} успешных`,
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Последняя синхронизация',
      value: stats.lastSyncTime
        ? formatDistanceToNow(new Date(stats.lastSyncTime), {
            addSuffix: true,
            locale: ru
          })
        : 'Нет данных',
      description: stats.lastSyncTime
        ? new Date(stats.lastSyncTime).toLocaleString('ru-RU')
        : 'Еще не выполнялась',
      icon: Clock,
      iconColor: 'text-amber-500',
      iconBgColor: 'bg-amber-500/10'
    },
    {
      title: 'Всего бонусов',
      value: stats.totalBonusSynced.toLocaleString('ru-RU'),
      description: 'Синхронизировано бонусов',
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
          <div className='glass-card relative overflow-hidden rounded-xl border border-zinc-200 p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
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
