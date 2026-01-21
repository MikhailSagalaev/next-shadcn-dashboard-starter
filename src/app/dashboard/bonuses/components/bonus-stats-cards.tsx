/**
 * @file: bonus-stats-cards.tsx
 * @description: Карточки статистики бонусов (Client Component)
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import { motion } from 'framer-motion';
import { Wallet, Users, Gift, TrendingUp, AlertCircle } from 'lucide-react';
import type { BonusStats } from '../data-access';

interface BonusStatsCardsProps {
  stats: BonusStats;
}

export function BonusStatsCards({ stats }: BonusStatsCardsProps) {
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
      title: 'Проекты',
      value: stats.totalProjects,
      description: 'Активных программ',
      icon: Wallet,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Пользователи',
      value: stats.totalUsers,
      description: 'Участников системы',
      icon: Users,
      iconColor: 'text-purple-500',
      iconBgColor: 'bg-purple-500/10'
    },
    {
      title: 'Всего бонусов',
      value: stats.totalBonuses.toLocaleString(),
      description: 'Начислено баллов',
      icon: Gift,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Активные бонусы',
      value: stats.activeBonuses.toLocaleString(),
      description: 'Доступно к списанию',
      icon: TrendingUp,
      iconColor: 'text-amber-500',
      iconBgColor: 'bg-amber-500/10'
    },
    {
      title: 'Истекают скоро',
      value: stats.expiringSoon.toLocaleString(),
      description: 'В течение 30 дней',
      icon: AlertCircle,
      iconColor: 'text-rose-500',
      iconBgColor: 'bg-rose-500/10'
    }
  ];

  return (
    <motion.div
      variants={container}
      initial='hidden'
      animate='show'
      className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'
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
