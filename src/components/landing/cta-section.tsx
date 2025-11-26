/**
 * @file: cta-section.tsx
 * @description: Финальный CTA секция - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CTASection() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-[#0A0A0B]'>
        {/* Gradient orbs */}
        <div className='absolute top-1/2 left-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-600/30 via-pink-600/20 to-purple-600/30 blur-[100px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8'>
        <div className='text-center'>
          {/* Badge */}
          <div className='mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2'>
            <Sparkles className='h-4 w-4 text-orange-500' />
            <span className='text-sm text-zinc-400'>Бесплатный старт</span>
          </div>

          {/* Heading */}
          <h2 className='mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl'>
            Готовы увеличить
            <br />
            <span className='bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent'>
              лояльность клиентов?
            </span>
          </h2>

          {/* Description */}
          <p className='mx-auto mb-10 max-w-2xl text-lg text-zinc-400'>
            Подключите систему лояльности для Tilda за 5 минут. Без
            программистов, без сложных настроек.
          </p>

          {/* CTA buttons */}
          <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
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
              <Link href='/auth/sign-in'>Уже есть аккаунт?</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className='mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-zinc-500'>
            <div className='flex items-center gap-2'>
              <div className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
              <span>Без кредитной карты</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
              <span>Настройка за 5 минут</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
              <span>Поддержка в Telegram</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
