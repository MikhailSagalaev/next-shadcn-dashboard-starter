/**
 * @file: help-section.tsx
 * @description: Секция "Нужна помощь?" для dashboard страниц
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Framer Motion, Lucide Icons
 * @created: 2026-01-26
 * @author: AI Assistant + User
 */

'use client';

import { motion } from 'framer-motion';
import { BookOpen, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const helpCards = [
  {
    title: 'Документация',
    description: 'Подробное руководство по интеграции с примерами кода',
    icon: BookOpen,
    href: '/docs/getting-started',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverBorder: 'hover:border-blue-100 dark:hover:border-blue-900/50'
  },
  {
    title: 'Техподдержка',
    description: 'Свяжитесь с нами, если возникли вопросы',
    icon: MessageCircle,
    href: 'https://t.me/gupil_support',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    hoverBorder: 'hover:border-emerald-100 dark:hover:border-emerald-900/50'
  }
];

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

export function DashboardHelpSection() {
  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>Нужна помощь?</CardTitle>
        <CardDescription>
          Мы всегда готовы помочь вам разобраться
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={container}
          initial='hidden'
          animate='show'
          className='grid gap-4 md:grid-cols-2'
        >
          {helpCards.map((card) => (
            <motion.div key={card.title} variants={item}>
              <Link
                href={card.href}
                target={card.href.startsWith('http') ? '_blank' : undefined}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group cursor-pointer rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all ${card.hoverBorder} hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900`}
                >
                  <div className='flex items-center gap-4'>
                    <div
                      className={`rounded-lg p-2.5 ${card.bgColor} ${card.color}`}
                    >
                      <card.icon className='h-5 w-5' />
                    </div>
                    <div className='flex-1'>
                      <h4 className='text-sm font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400'>
                        {card.title}
                      </h4>
                      <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                        {card.description}
                      </p>
                    </div>
                    <div className='text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600'>
                      →
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}
