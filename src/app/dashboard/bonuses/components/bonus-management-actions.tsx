/**
 * @file: bonus-management-actions.tsx
 * @description: Быстрые действия для управления бонусами (Client Component)
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Gift, Settings, FileText, Zap } from 'lucide-react';

const actions = [
  {
    title: 'Управление пользователями',
    description: 'Просмотр и редактирование',
    icon: Users,
    href: '/dashboard/projects',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  {
    title: 'Начислить бонусы',
    description: 'Массовое начисление',
    icon: Gift,
    href: '/dashboard/projects',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  {
    title: 'Настройки программы',
    description: 'Правила и уровни',
    icon: Settings,
    href: '/dashboard/projects',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  {
    title: 'Отчеты',
    description: 'Аналитика и экспорт',
    icon: FileText,
    href: '/dashboard/projects',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  }
];

export function BonusManagementActions() {
  const router = useRouter();

  return (
    <Card className='glass-card h-[400px] border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-xl font-semibold'>
          <Zap className='h-5 w-5 text-indigo-500' />
          Быстрые действия
        </CardTitle>
        <CardDescription>Часто используемые функции управления</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3'>
        {actions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='group cursor-pointer rounded-xl border border-zinc-100 bg-white p-3 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
            onClick={() => router.push(action.href)}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`rounded-lg p-2 ${action.bgColor} ${action.color}`}
              >
                <action.icon className='h-5 w-5' />
              </div>
              <div className='flex-1'>
                <h4 className='text-sm font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400'>
                  {action.title}
                </h4>
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                  {action.description}
                </p>
              </div>
              <div className='text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600'>
                →
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
