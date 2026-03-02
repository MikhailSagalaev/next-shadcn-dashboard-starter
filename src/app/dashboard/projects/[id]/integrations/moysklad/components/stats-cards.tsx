/**
 * @file: stats-cards.tsx
 * @description: Statistics cards for МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

'use client';

import { Card } from '@/components/ui/card';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface StatsCardsProps {
  stats: {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgProcessingTime: number;
    successRate: string;
  };
  isActive: boolean;
  lastRequestAt: Date | null;
}

export function MoySkladStatsCards({
  stats,
  isActive,
  lastRequestAt
}: StatsCardsProps) {
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

  const cards = [
    {
      title: 'Всего запросов',
      value: stats.totalRequests.toLocaleString(),
      description: lastRequestAt
        ? `Последний: ${formatDistanceToNow(new Date(lastRequestAt), {
            addSuffix: true,
            locale: ru
          })}`
        : 'Нет запросов',
      icon: Activity,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Успешных',
      value: stats.successRequests.toLocaleString(),
      description: `${stats.successRate}% success rate`,
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Ошибок',
      value: stats.errorRequests.toLocaleString(),
      description: stats.errorRequests > 0 ? 'Требует внимания' : 'Все хорошо',
      icon: XCircle,
      iconColor: stats.errorRequests > 0 ? 'text-red-500' : 'text-zinc-400',
      iconBgColor: stats.errorRequests > 0 ? 'bg-red-500/10' : 'bg-zinc-500/10'
    },
    {
      title: 'Среднее время',
      value: `${Math.round(stats.avgProcessingTime)}ms`,
      description: stats.avgProcessingTime < 500 ? 'Отлично' : 'Требует оптимизации',
      icon: Clock,
      iconColor: stats.avgProcessingTime < 500 ? 'text-indigo-500' : 'text-amber-500',
      iconBgColor: stats.avgProcessingTime < 500 ? 'bg-indigo-500/10' : 'bg-amber-500/10'
    }
  ];

  return (
    <motion.div
      variants={container}
      initial='hidden'
      animate='show'
      className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'
    >
      {cards.map((card, index) => (
        <motion.div key={index} variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className={`absolute right-4 top-4 rounded-full ${card.iconBgColor} p-2.5 ${card.iconColor}`}>
              <card.icon className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                {card.title}
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {card.value}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {card.description}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
