/**
 * @file: pricing.tsx
 * @description: Секция тарифов - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Basic',
    price: '1 500',
    period: '/мес',
    description: 'Для малого бизнеса и старта',
    features: [
      '1 проект',
      'До 1 000 пользователей',
      '1 Telegram бот',
      'Базовая аналитика',
      'Email поддержка',
      'Webhook API'
    ],
    popular: false,
    gradient: 'from-zinc-500 to-zinc-600'
  },
  {
    name: 'Pro',
    price: '2 000',
    period: '/мес',
    description: 'Для растущего бизнеса',
    features: [
      '3 проекта',
      'До 10 000 пользователей',
      '3 Telegram бота',
      'Расширенная аналитика',
      'Приоритетная поддержка',
      'API интеграции',
      'Кастомные настройки'
    ],
    popular: true,
    gradient: 'from-orange-500 to-pink-600'
  },
  {
    name: 'Enterprise',
    price: '2 500',
    period: '/мес',
    description: 'Для крупных компаний',
    features: [
      'Безлимит проектов',
      'Безлимит пользователей',
      'Безлимит ботов',
      'Полная аналитика',
      'Персональный менеджер',
      'Все API интеграции',
      'Кастомный дизайн',
      'SLA гарантии'
    ],
    popular: false,
    gradient: 'from-purple-500 to-blue-600'
  }
];

export function Pricing() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-[#0A0A0B]'>
        <div className='absolute top-1/2 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-600/10 via-pink-600/10 to-purple-600/10 blur-[120px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center lg:mb-20'>
          <p className='mb-3 text-sm font-medium tracking-wide text-orange-500 uppercase'>
            Тарифы
          </p>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            Простое ценообразование
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-zinc-400'>
            Выберите план, который подходит вашему бизнесу. Скидки при оплате за
            год.
          </p>
        </div>

        {/* Plans grid */}
        <div className='mx-auto grid max-w-6xl gap-8 lg:grid-cols-3'>
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl ${
                plan.popular
                  ? 'bg-gradient-to-b from-orange-500/20 to-transparent p-[1px]'
                  : ''
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className='absolute -top-4 left-1/2 z-10 -translate-x-1/2'>
                  <div className='flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 px-3 py-1.5 text-xs font-medium text-white'>
                    <Sparkles className='h-3 w-3' />
                    Популярный
                  </div>
                </div>
              )}

              <div
                className={`h-full rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-zinc-900'
                    : 'border border-white/5 bg-zinc-900/50'
                }`}
              >
                {/* Plan name */}
                <div className='mb-6'>
                  <h3 className='mb-1 text-xl font-semibold text-white'>
                    {plan.name}
                  </h3>
                  <p className='text-sm text-zinc-500'>{plan.description}</p>
                </div>

                {/* Price */}
                <div className='mb-8'>
                  <div className='flex items-baseline gap-1'>
                    <span className='text-4xl font-bold text-white'>
                      {plan.price}₽
                    </span>
                    <span className='text-zinc-500'>{plan.period}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className='mb-8 space-y-3'>
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className='flex items-start gap-3'>
                      <Check className='mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500' />
                      <span className='text-sm text-zinc-400'>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  asChild
                  className={`w-full ${
                    plan.popular
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  size='lg'
                >
                  <Link href='/auth/sign-up'>Начать</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <div className='mt-16 text-center'>
          <div className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2'>
            <span className='text-sm text-zinc-400'>
              Нужна помощь с настройкой? Мы предоставляем консультации.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
