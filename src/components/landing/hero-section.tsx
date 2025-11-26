/**
 * @file: hero-section.tsx
 * @description: Hero секция лэндинга - современный темный дизайн с градиентами
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className='relative flex min-h-screen items-center justify-center overflow-hidden'>
      {/* Background gradient effects */}
      <div className='absolute inset-0 bg-[#0A0A0B]'>
        {/* Primary gradient orb */}
        <div className='absolute top-1/4 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-600/30 via-pink-600/20 to-purple-600/30 blur-[120px]' />
        {/* Secondary gradient orb */}
        <div className='absolute right-0 bottom-0 h-[400px] w-[600px] rounded-full bg-gradient-to-l from-blue-600/20 to-transparent blur-[100px]' />
        {/* Grid overlay */}
        <div
          className='absolute inset-0 opacity-[0.03]'
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 pt-32 pb-20 sm:px-6 lg:px-8'>
        <div className='text-center'>
          {/* Badge */}
          <div className='mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2'>
            <Sparkles className='h-4 w-4 text-orange-500' />
            <span className='text-sm text-zinc-400'>
              Первая система лояльности для Tilda
            </span>
          </div>

          {/* Main heading */}
          <h1 className='mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl'>
            <span className='block text-white'>Бонусы и лояльность</span>
            <span className='block bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent'>
              для вашего бизнеса
            </span>
          </h1>

          {/* Subtitle */}
          <p className='mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl'>
            Полноценная система лояльности с Telegram ботом, личным кабинетом и
            аналитикой. Подключение за 5 минут без программистов.
          </p>

          {/* CTA buttons */}
          <div className='mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row'>
            <Button
              asChild
              size='lg'
              className='group h-auto rounded-xl bg-white px-8 py-6 text-base font-medium text-black shadow-2xl shadow-white/10 hover:bg-zinc-200'
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
              className='h-auto rounded-xl border-white/20 bg-transparent px-8 py-6 text-base font-medium text-white hover:border-white/30 hover:bg-white/5'
            >
              <Link href='#how-it-works' className='flex items-center gap-2'>
                <Play className='h-4 w-4' />
                Как это работает
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className='flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-zinc-500'>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 animate-pulse rounded-full bg-emerald-500' />
              <span>Бесплатный старт</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 animate-pulse rounded-full bg-emerald-500' />
              <span>Без кредитной карты</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 animate-pulse rounded-full bg-emerald-500' />
              <span>Поддержка в Telegram</span>
            </div>
          </div>
        </div>

        {/* Hero image/preview section */}
        <div className='relative mt-20'>
          <div className='pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent' />
          <div className='relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm'>
            {/* Mock dashboard preview */}
            <div className='aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 p-8'>
              <div className='grid h-full grid-cols-3 gap-4'>
                {/* Sidebar mock */}
                <div className='col-span-1 space-y-3 rounded-xl bg-zinc-800/50 p-4'>
                  <div className='h-8 w-3/4 rounded-lg bg-white/10' />
                  <div className='space-y-2'>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className='h-6 rounded-lg bg-white/5'
                        style={{ width: `${60 + Math.random() * 30}%` }}
                      />
                    ))}
                  </div>
                </div>
                {/* Main content mock */}
                <div className='col-span-2 space-y-4'>
                  <div className='grid grid-cols-3 gap-4'>
                    {[
                      {
                        label: 'Пользователей',
                        value: '12,847',
                        color: 'from-orange-500 to-pink-500'
                      },
                      {
                        label: 'Бонусов',
                        value: '₽847,230',
                        color: 'from-blue-500 to-purple-500'
                      },
                      {
                        label: 'Конверсия',
                        value: '24.8%',
                        color: 'from-emerald-500 to-teal-500'
                      }
                    ].map((stat, i) => (
                      <div key={i} className='rounded-xl bg-zinc-800/50 p-4'>
                        <div
                          className={`bg-gradient-to-r text-2xl font-bold ${stat.color} bg-clip-text text-transparent`}
                        >
                          {stat.value}
                        </div>
                        <div className='mt-1 text-xs text-zinc-500'>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className='flex-1 rounded-xl bg-zinc-800/50 p-4'>
                    <div className='mb-4 h-4 w-1/4 rounded bg-white/10' />
                    <div className='flex h-32 items-end gap-2'>
                      {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map(
                        (h, i) => (
                          <div
                            key={i}
                            className='flex-1 rounded-t bg-gradient-to-t from-orange-500/80 to-orange-500/20'
                            style={{ height: `${h}%` }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
