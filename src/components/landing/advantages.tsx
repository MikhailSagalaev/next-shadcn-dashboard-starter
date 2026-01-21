/**
 * @file: advantages.tsx
 * @description: Секция с 5 уникальными преимуществами (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @updated: 2026-01-21 - Оптимизация: Server Component (статичный контент)
 * @author: AI Assistant + User
 */

import { Coins, Palette, MousePointerClick, Users, Link2 } from 'lucide-react';

const advantages = [
  {
    icon: Coins,
    title: 'Экономия до 80%',
    description:
      'Используем AI и автоматизацию. Нет раздутого штата — цена ниже, качество выше.',
    gradient: 'from-emerald-500 to-teal-500'
  },
  {
    icon: Palette,
    title: 'Премиальный дизайн',
    description:
      'Качественная эстетика как у Verso и Resend. Приятно работать каждый день.',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    icon: MousePointerClick,
    title: '5 минут на старт',
    description:
      'Минимальный порог входа. Полная настройка системы без программистов.',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    icon: Users,
    title: 'Живая поддержка',
    description:
      'Telegram-чат с создателем. Быстрые ответы и комьюнити специалистов.',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Link2,
    title: 'Интеграция с ЛК',
    description:
      'Уникальная функция: прямая связь с личным кабинетом Tilda. Только у нас.',
    gradient: 'from-rose-500 to-orange-500'
  }
];

export function Advantages() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-zinc-950'>
        <div className='absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/5 blur-[150px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center lg:mb-20'>
          <p className='mb-3 text-sm font-medium tracking-wide text-orange-500 uppercase'>
            Почему мы
          </p>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            5 причин выбрать GUPIL
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-zinc-400'>
            Уникальные преимущества, которых нет у конкурентов
          </p>
        </div>

        {/* Grid */}
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            return (
              <div
                key={index}
                className='group relative rounded-2xl border border-white/5 bg-zinc-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/10'
              >
                {/* Icon */}
                <div
                  className={`h-12 w-12 rounded-xl bg-gradient-to-br ${advantage.gradient} mb-5 p-[1px]`}
                >
                  <div className='flex h-full w-full items-center justify-center rounded-xl bg-zinc-900'>
                    <Icon className='h-5 w-5 text-white' />
                  </div>
                </div>

                {/* Content */}
                <h3 className='mb-2 text-lg font-semibold text-white'>
                  {advantage.title}
                </h3>
                <p className='text-sm leading-relaxed text-zinc-400'>
                  {advantage.description}
                </p>

                {/* Hover gradient */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${advantage.gradient} pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
