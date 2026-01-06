/**
 * @file: homepage-hero.tsx
 * @description: Hero секция светлого лэндинга с аналитикой
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui, Lucide-react
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

const stats = [
  { label: 'Заказов', value: '12', change: '+7%', positive: true },
  { label: 'Товаров', value: '36', change: '+2%', positive: true },
  { label: 'Топ', value: '#7', change: '-2', positive: false },
  { label: 'Привёл', value: '6', change: '+7%', positive: true }
];

const partners = [
  { name: 'Partner 1', logo: '/partners/partner1.svg' },
  { name: 'Partner 2', logo: '/partners/partner2.svg' },
  { name: 'Partner 3', logo: '/partners/partner3.svg' },
  { name: 'Partner 4', logo: '/partners/partner4.svg' }
];

export function HomepageHero() {
  return (
    <section className='relative min-h-screen overflow-hidden bg-[#EFF0F0] pt-20'>
      <div className='mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24'>
        <div className='grid items-center gap-12 lg:grid-cols-2'>
          {/* Left content */}
          <div className='max-w-xl'>
            <h1 className='mb-6 text-4xl leading-tight font-bold tracking-tight text-black sm:text-5xl lg:text-6xl'>
              Система лояльности без танцев с бубном
            </h1>
            <p className='mb-8 text-lg leading-relaxed text-[#454748]'>
              Полноценная система лояльности с Telegram ботом, личным кабинетом
              и аналитикой. Подключение за 5 минут без программистов.
            </p>

            {/* CTA buttons */}
            <div className='mb-12 flex flex-col gap-4 sm:flex-row'>
              <Button
                asChild
                size='lg'
                className='group h-12 rounded-lg bg-[#FF3C00] px-6 text-base font-medium text-white hover:bg-[#E63600]'
              >
                <Link href='/auth/sign-up' className='flex items-center gap-2'>
                  Начать бесплатно
                  <ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-1' />
                </Link>
              </Button>
              <Button
                asChild
                variant='outline'
                size='lg'
                className='h-12 rounded-lg border-black bg-black px-6 text-base font-medium text-white hover:bg-gray-800'
              >
                <Link href='#steps'>Как это работает</Link>
              </Button>
            </div>

            {/* Partners */}
            <div>
              <p className='mb-4 text-sm text-[#9DA0A3]'>Нам доверяют</p>
              <div className='flex items-center gap-6'>
                {partners.map((partner, i) => (
                  <div
                    key={i}
                    className='flex h-8 w-20 items-center justify-center rounded bg-gray-300/50'
                  >
                    <span className='text-xs text-gray-500'>Logo {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right content - Analytics card */}
          <div className='relative'>
            <div className='rounded-2xl border border-gray-200 bg-white p-6 shadow-xl'>
              {/* Header */}
              <div className='mb-6 flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-semibold text-black'>
                    Аналитика
                  </h3>
                  <p className='text-sm text-[#9DA0A3]'>За последние 30 дней</p>
                </div>
                <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF3C00]'>
                  <TrendingUp className='h-5 w-5 text-white' />
                </div>
              </div>

              {/* Stats grid */}
              <div className='grid grid-cols-2 gap-4'>
                {stats.map((stat, i) => (
                  <div
                    key={i}
                    className='rounded-xl bg-[#F5F5F5] p-4 transition-colors hover:bg-[#EBEBEB]'
                  >
                    <div className='mb-1 text-sm text-[#9DA0A3]'>
                      {stat.label}
                    </div>
                    <div className='flex items-end justify-between'>
                      <span className='text-2xl font-bold text-black'>
                        {stat.value}
                      </span>
                      <span
                        className={`flex items-center text-sm font-medium ${
                          stat.positive ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {stat.positive ? (
                          <TrendingUp className='mr-1 h-3 w-3' />
                        ) : (
                          <TrendingDown className='mr-1 h-3 w-3' />
                        )}
                        {stat.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart placeholder */}
              <div className='mt-6 h-32 rounded-xl bg-gradient-to-r from-[#FF3C00]/10 to-[#FF3C00]/5 p-4'>
                <div className='flex h-full items-end gap-2'>
                  {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map(
                    (h, i) => (
                      <div
                        key={i}
                        className='flex-1 rounded-t bg-[#FF3C00]/60'
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className='absolute -top-4 -right-4 h-24 w-24 rounded-full bg-[#FF3C00]/10 blur-2xl' />
            <div className='absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-[#FF3C00]/5 blur-3xl' />
          </div>
        </div>
      </div>
    </section>
  );
}
