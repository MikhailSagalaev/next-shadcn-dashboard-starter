/**
 * @file: homepage-pricing.tsx
 * @description: Секция тарифов в стиле Meridian (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui, Lucide-react
 * @created: 2026-01-06
 * @updated: 2026-01-21 - Оптимизация: Server Component (статичный контент)
 * @author: AI Assistant + User
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Foundations',
    price: '$299',
    period: '/мес',
    description: 'Для небольших проектов',
    features: [
      'До 1,000 пользователей',
      '1 проект',
      'Telegram бот',
      'Базовая аналитика',
      'Email поддержка'
    ],
    popular: false
  },
  {
    name: 'Growth',
    price: '$999',
    period: '/мес',
    description: 'Для растущего бизнеса',
    features: [
      'До 10,000 пользователей',
      '5 проектов',
      'Telegram бот + виджет',
      'Расширенная аналитика',
      'Реферальная программа',
      'API доступ',
      'Приоритетная поддержка'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Для крупных компаний',
    features: [
      'Безлимитные пользователи',
      'Безлимитные проекты',
      'White-label решение',
      'Кастомные интеграции',
      'Выделенный менеджер',
      'SLA гарантии'
    ],
    popular: false
  }
];

export function HomepagePricing() {
  return (
    <section id='pricing' className='bg-white py-24'>
      <div className='mx-auto max-w-[1200px] px-6'>
        {/* Header */}
        <div className='mb-16 text-center'>
          <h2 className='mb-4 text-[40px] leading-[1.15] font-semibold tracking-[-0.02em] text-[#1A1A1A]'>
            Простые и понятные тарифы
          </h2>
          <p className='mx-auto max-w-md text-lg text-[#666666]'>
            Выберите план, который подходит вашему бизнесу
          </p>
        </div>

        {/* Pricing Cards */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-3xl p-8 transition-all ${
                plan.popular
                  ? 'bg-[#1A1A1A] text-white shadow-2xl shadow-black/20'
                  : 'bg-[#FAFAFA] hover:bg-[#F5F5F5]'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className='absolute -top-3 left-8 rounded-full bg-[#FF4D00] px-4 py-1 text-xs font-medium text-white'>
                  Популярный
                </div>
              )}

              {/* Plan name */}
              <p
                className={`mb-2 text-[13px] font-medium tracking-wider uppercase ${
                  plan.popular ? 'text-[#666666]' : 'text-[#999999]'
                }`}
              >
                {plan.name}
              </p>

              {/* Price */}
              <div className='mb-2'>
                <span
                  className={`text-4xl font-semibold ${
                    plan.popular ? 'text-white' : 'text-[#1A1A1A]'
                  }`}
                >
                  {plan.price}
                </span>
                <span
                  className={`text-sm ${
                    plan.popular ? 'text-[#666666]' : 'text-[#999999]'
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <p
                className={`mb-8 text-[15px] ${
                  plan.popular ? 'text-[#999999]' : 'text-[#666666]'
                }`}
              >
                {plan.description}
              </p>

              {/* Features */}
              <ul className='mb-8 space-y-3'>
                {plan.features.map((feature, j) => (
                  <li key={j} className='flex items-start gap-3'>
                    <Check
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                        plan.popular ? 'text-[#FF4D00]' : 'text-emerald-500'
                      }`}
                    />
                    <span
                      className={`text-[15px] ${
                        plan.popular ? 'text-[#CCCCCC]' : 'text-[#666666]'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                className={`w-full rounded-full py-6 text-[15px] font-medium ${
                  plan.popular
                    ? 'bg-[#FF4D00] text-white hover:bg-[#E64500]'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#333333]'
                }`}
              >
                <Link href='/auth/sign-up' className='flex items-center gap-2'>
                  {plan.name === 'Enterprise' ? 'Связаться' : 'Начать'}
                  <ArrowRight className='h-4 w-4' />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
