/**
 * @file: homepage-features.tsx
 * @description: Bento grid фичи в стиле Meridian
 * @project: SaaS Bonus System
 * @dependencies: React, Lucide-react
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { BarChart3, Zap, Users, Globe, TrendingUp } from 'lucide-react';

export function HomepageFeatures() {
  return (
    <section className='bg-white py-24'>
      <div className='mx-auto max-w-[1200px] px-6'>
        {/* Header */}
        <div className='mb-16 max-w-[600px]'>
          <h2 className='mb-4 text-[40px] leading-[1.15] font-semibold tracking-[-0.02em] text-[#1A1A1A]'>
            Рефералки, уровни бонусов, аналитика и маркетинг в единой платформе
          </h2>
        </div>

        {/* Bento Grid */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {/* Card 1 - Brand Analytics (Large) */}
          <div className='group relative overflow-hidden rounded-3xl bg-[#FAFAFA] p-8 transition-all hover:bg-[#F5F5F5] lg:col-span-2'>
            <div className='mb-6 flex items-center gap-2'>
              <BarChart3 className='h-5 w-5 text-[#FF4D00]' />
              <span className='text-[13px] font-medium tracking-wider text-[#999999] uppercase'>
                Brand Analytics
              </span>
            </div>

            <h3 className='mb-3 text-2xl font-semibold text-[#1A1A1A]'>
              Аналитика бренда в реальном времени
            </h3>
            <p className='mb-8 max-w-md text-[15px] leading-relaxed text-[#666666]'>
              Отслеживайте эффективность программы лояльности, анализируйте
              поведение клиентов и оптимизируйте маркетинговые кампании.
            </p>

            {/* Mock Chart */}
            <div className='relative h-32 w-full rounded-xl bg-white p-4 shadow-sm'>
              <div className='flex h-full items-end justify-between gap-2'>
                {[30, 45, 35, 60, 50, 70, 55, 80, 65, 90, 75, 85].map(
                  (h, i) => (
                    <div
                      key={i}
                      className='flex-1 rounded-t bg-gradient-to-t from-[#FF4D00] to-[#FF8A50]'
                      style={{ height: `${h}%` }}
                    />
                  )
                )}
              </div>
              <div className='absolute top-4 right-4 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1'>
                <TrendingUp className='h-3 w-3 text-emerald-600' />
                <span className='text-xs font-medium text-emerald-600'>
                  +54%
                </span>
              </div>
            </div>
          </div>

          {/* Card 2 - Automation */}
          <div className='group relative overflow-hidden rounded-3xl bg-[#FAFAFA] p-8 transition-all hover:bg-[#F5F5F5]'>
            <div className='mb-6 flex items-center gap-2'>
              <Zap className='h-5 w-5 text-[#FF4D00]' />
              <span className='text-[13px] font-medium tracking-wider text-[#999999] uppercase'>
                Automation
              </span>
            </div>

            <h3 className='mb-3 text-xl font-semibold text-[#1A1A1A]'>
              Автоматизация процессов
            </h3>
            <p className='text-[15px] leading-relaxed text-[#666666]'>
              Автоматическое начисление бонусов, уведомления и триггерные
              сценарии без ручной работы.
            </p>
          </div>

          {/* Card 3 - Product Tracking */}
          <div className='group relative overflow-hidden rounded-3xl bg-[#1A1A1A] p-8 transition-all hover:bg-[#2A2A2A]'>
            <div className='mb-6 flex items-center gap-2'>
              <Users className='h-5 w-5 text-[#FF4D00]' />
              <span className='text-[13px] font-medium tracking-wider text-[#666666] uppercase'>
                Product-Level Tracking
              </span>
            </div>

            <h3 className='mb-3 text-xl font-semibold text-white'>
              Товарная аналитика
            </h3>
            <p className='mb-6 text-[15px] leading-relaxed text-[#999999]'>
              Анализ покупок на уровне товаров: популярные позиции, средний чек,
              частота повторных покупок.
            </p>

            {/* Mock Product Cards */}
            <div className='space-y-2'>
              <div className='flex items-center gap-3 rounded-xl bg-white/10 p-3'>
                <div className='h-10 w-10 rounded-lg bg-white/20' />
                <div>
                  <p className='text-sm font-medium text-white'>
                    Pro 34" Monitor
                  </p>
                  <p className='text-xs text-[#666666]'>$1,199.00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4 - Integrations */}
          <div className='group relative overflow-hidden rounded-3xl bg-[#FAFAFA] p-8 transition-all hover:bg-[#F5F5F5] lg:col-span-2'>
            <div className='mb-6 flex items-center gap-2'>
              <Globe className='h-5 w-5 text-[#FF4D00]' />
              <span className='text-[13px] font-medium tracking-wider text-[#999999] uppercase'>
                Integrations
              </span>
            </div>

            <h3 className='mb-3 text-2xl font-semibold text-[#1A1A1A]'>
              Готовые интеграции
            </h3>
            <p className='max-w-md text-[15px] leading-relaxed text-[#666666]'>
              Подключайте Tilda, RetailCRM, Telegram и другие популярные сервисы
              в несколько кликов.
            </p>

            {/* Integration logos placeholder */}
            <div className='mt-6 flex gap-3'>
              {['Tilda', 'Telegram', 'RetailCRM', 'WooCommerce'].map((name) => (
                <div
                  key={name}
                  className='rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#666666] shadow-sm'
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
