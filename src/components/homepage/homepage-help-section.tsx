/**
 * @file: homepage-help-section.tsx
 * @description: Секция "Нужна помощь?" с карточками документации и поддержки
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Framer Motion, Lucide Icons
 * @created: 2026-01-26
 * @author: AI Assistant + User
 */

'use client';

import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const helpCards = [
  {
    title: 'Документация',
    description: 'Подробное руководство по интеграции с примерами кода',
    icon: BookOpen,
    href: '/docs/getting-started',
    linkText: 'Читать документацию →',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverBorder: 'hover:border-blue-100 dark:hover:border-blue-900/50'
  },
  {
    title: 'Техподдержка',
    description: 'Свяжитесь с нами, если возникли вопросы',
    icon: MessageCircle,
    href: 'https://t.me/gupil_support',
    linkText: 'Написать в поддержку →',
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

export function HomepageHelpSection() {
  return (
    <section className='bg-white py-24 dark:bg-zinc-950'>
      <div className='mx-auto max-w-[1200px] px-6'>
        <div className='mb-12 text-center'>
          <h2 className='mb-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
            Нужна помощь?
          </h2>
          <p className='text-lg text-zinc-600 dark:text-zinc-400'>
            Мы всегда готовы помочь вам разобраться
          </p>
        </div>

        <motion.div
          variants={container}
          initial='hidden'
          whileInView='show'
          viewport={{ once: true }}
          className='grid gap-6 md:grid-cols-2'
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
                  className={`group cursor-pointer rounded-xl border border-zinc-100 bg-white p-8 shadow-sm transition-all ${card.hoverBorder} hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900`}
                >
                  <div className='flex items-start gap-6'>
                    <div
                      className={`rounded-lg p-3 ${card.bgColor} ${card.color}`}
                    >
                      <card.icon className='h-6 w-6' />
                    </div>
                    <div className='flex-1'>
                      <h3 className='mb-2 text-xl font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400'>
                        {card.title}
                      </h3>
                      <p className='mb-4 text-zinc-600 dark:text-zinc-400'>
                        {card.description}
                      </p>
                      <div className='flex items-center text-sm font-medium text-indigo-600 transition-all group-hover:gap-2 dark:text-indigo-400'>
                        <span>{card.linkText}</span>
                        <ArrowRight className='-ml-4 h-4 w-4 opacity-0 transition-all group-hover:ml-0 group-hover:opacity-100' />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
