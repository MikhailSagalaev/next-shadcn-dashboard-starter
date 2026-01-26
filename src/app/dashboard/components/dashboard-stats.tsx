'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Gift, Users, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardStatsProps {
  totalProjects: number;
  totalUsers: number;
  activeUsers: number;
  activeBots: number;
  totalBonuses: number;
}

export function DashboardStats({
  totalProjects,
  totalUsers,
  activeUsers,
  activeBots,
  totalBonuses
}: DashboardStatsProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={container}
      initial='hidden'
      animate='show'
      className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'
    >
      <motion.div variants={item}>
        <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
          <div className='absolute top-4 right-4 rounded-full bg-blue-500/10 p-2.5 text-blue-500'>
            <Wallet className='h-5 w-5' />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
              Проекты
            </p>
            <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
              {totalProjects}
            </h3>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              Активных программ
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
          <div className='absolute top-4 right-4 rounded-full bg-purple-500/10 p-2.5 text-purple-500'>
            <Users className='h-5 w-5' />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
              Пользователи
            </p>
            <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
              {totalUsers}
            </h3>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              {activeUsers} активированных
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
          <div className='absolute top-4 right-4 rounded-full bg-emerald-500/10 p-2.5 text-emerald-500'>
            <Bot className='h-5 w-5' />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
              Активные боты
            </p>
            <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
              {activeBots}
            </h3>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              Запущено в Telegram
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
          <div className='absolute top-4 right-4 rounded-full bg-amber-500/10 p-2.5 text-amber-500'>
            <Gift className='h-5 w-5' />
          </div>
          <div>
            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
              Выдано бонусов
            </p>
            <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
              {totalBonuses.toLocaleString()}
            </h3>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              Всего баллов
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
