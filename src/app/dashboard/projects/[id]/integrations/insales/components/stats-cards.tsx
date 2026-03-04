'use client';

/**
 * @file: stats-cards.tsx
 * @description: InSales Integration Statistics Cards
 * @project: SaaS Bonus System
 */

import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Gift,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface InSalesStatsCardsProps {
  stats: {
    totalWebhooks: number;
    successWebhooks: number;
    errorWebhooks: number;
    successRate: string;
  };
  integration: {
    totalOrders: number;
    totalBonusAwarded: any;
    totalBonusSpent: any;
    lastWebhookAt: Date | null;
    isActive: boolean;
  };
}

export function InSalesStatsCards({
  stats,
  integration
}: InSalesStatsCardsProps) {
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
      title: 'Всего заказов',
      value: integration.totalOrders.toLocaleString('ru-RU'),
      description: 'Обработано через webhooks',
      icon: ShoppingCart,
      iconColor: 'text-blue-500',
      iconBgColor: 'bg-blue-500/10'
    },
    {
      title: 'Начислено бонусов',
      value: `${parseFloat(integration.totalBonusAwarded.toString()).toLocaleString('ru-RU')} ₽`,
      description: 'За все время',
      icon: Gift,
      iconColor: 'text-emerald-500',
      iconBgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Списано бонусов',
      value: `${parseFloat(integration.totalBonusSpent.toString()).toLocaleString('ru-RU')} ₽`,
      description: 'Использовано клиентами',
      icon: TrendingUp,
      iconColor: 'text-purple-500',
      iconBgColor: 'bg-purple-500/10'
    },
    {
      title: 'Webhooks',
      value: stats.totalWebhooks.toLocaleString('ru-RU'),
      description: `${stats.successRate}% успешных`,
      icon: Activity,
      iconColor: 'text-indigo-500',
      iconBgColor: 'bg-indigo-500/10'
    },
    {
      title: 'Успешные',
      value: stats.successWebhooks.toLocaleString('ru-RU'),
      description: 'Обработано без ошибок',
      icon: CheckCircle2,
      iconColor: 'text-green-500',
      iconBgColor: 'bg-green-500/10'
    },
    {
      title: 'Ошибки',
      value: stats.errorWebhooks.toLocaleString('ru-RU'),
      description: 'Требуют внимания',
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBgColor: 'bg-red-500/10'
    }
  ];

  return (
    <div className='space-y-4'>
      <motion.div
        variants={container}
        initial='hidden'
        animate='show'
        className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'
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

      {/* Status Banner */}
      <Card className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div
              className={`h-3 w-3 rounded-full ${integration.isActive ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`}
            />
            <div>
              <p className='text-sm font-medium'>
                Статус: {integration.isActive ? 'Активна' : 'Неактивна'}
              </p>
              {integration.lastWebhookAt && (
                <p className='text-xs text-zinc-500'>
                  Последний webhook:{' '}
                  {formatDistanceToNow(new Date(integration.lastWebhookAt), {
                    addSuffix: true,
                    locale: ru
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
