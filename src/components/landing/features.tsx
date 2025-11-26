/**
 * @file: features.tsx
 * @description: Секция функционала/возможностей - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import {
  Gift,
  Bot,
  Webhook,
  BarChart3,
  TrendingUp,
  Users,
  Bell,
  Sliders
} from 'lucide-react';

const features = [
  {
    icon: Gift,
    title: 'Система лояльности',
    description:
      'Начисление и списание бонусов, многоуровневые программы, срок действия'
  },
  {
    icon: Bot,
    title: 'Telegram боты',
    description: 'Уникальный бот для каждого проекта с конструктором сценариев'
  },
  {
    icon: Webhook,
    title: 'Webhook API',
    description: 'Универсальный API для Tilda, интернет-магазинов и CRM систем'
  },
  {
    icon: BarChart3,
    title: 'Аналитика',
    description: 'RFM-анализ, воронки продаж, когорты и KPI в реальном времени'
  },
  {
    icon: TrendingUp,
    title: 'Уровни лояльности',
    description:
      'Автоматическое повышение уровня с увеличением бонусного процента'
  },
  {
    icon: Users,
    title: 'Реферальная программа',
    description: 'Многоуровневая система поощрений с отслеживанием UTM меток'
  },
  {
    icon: Bell,
    title: 'Уведомления',
    description:
      'Email, SMS и Telegram о начислениях, списаниях и истечении бонусов'
  },
  {
    icon: Sliders,
    title: 'Гибкие настройки',
    description:
      'Правила начисления, лимиты списания, сроки действия и многое другое'
  }
];

export function Features() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-zinc-950'>
        <div className='absolute top-0 left-1/3 h-[600px] w-[600px] rounded-full bg-blue-600/5 blur-[150px]' />
        <div className='absolute right-1/3 bottom-0 h-[600px] w-[600px] rounded-full bg-purple-600/5 blur-[150px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center lg:mb-20'>
          <p className='mb-3 text-sm font-medium tracking-wide text-blue-500 uppercase'>
            Возможности
          </p>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            Всё в одном решении
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-zinc-400'>
            Система лояльности, боты, аналитика и маркетинг в единой платформе
          </p>
        </div>

        {/* Features grid */}
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className='group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]'
              >
                {/* Icon */}
                <div className='mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-blue-500/10'>
                  <Icon className='h-5 w-5 text-zinc-500 transition-colors group-hover:text-blue-500' />
                </div>

                {/* Content */}
                <h3 className='mb-2 text-base font-semibold text-white'>
                  {feature.title}
                </h3>
                <p className='text-sm leading-relaxed text-zinc-500'>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom stats */}
        <div className='mx-auto mt-20 grid max-w-3xl gap-8 sm:grid-cols-3'>
          {[
            { value: '10K+', label: 'Пользователей' },
            { value: '99.9%', label: 'Uptime' },
            { value: '24/7', label: 'Поддержка' }
          ].map((stat, index) => (
            <div key={index} className='text-center'>
              <div className='mb-1 text-3xl font-bold text-white lg:text-4xl'>
                {stat.value}
              </div>
              <div className='text-sm text-zinc-500'>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
