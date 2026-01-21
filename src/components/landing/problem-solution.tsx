/**
 * @file: problem-solution.tsx
 * @description: Секция Проблема/Решение (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui
 * @created: 2025-01-28
 * @updated: 2026-01-21 - Оптимизация: Server Component (статичный контент)
 * @author: AI Assistant + User
 */

import { X, Check, Zap } from 'lucide-react';

const problems = [
  'Нет единого инструмента для Tilda с личным кабинетом',
  'Нужно подключать множество сервисов отдельно',
  'Сложная настройка и долгая интеграция',
  'Высокая стоимость кастомной разработки'
];

const solutions = [
  'Все в одном: бонусы + боты + аналитика + ЛК',
  'Единый webhook — подключение за 5 минут',
  'Интуитивный интерфейс без программистов',
  'Доступная подписка вместо разработки'
];

export function ProblemSolution() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-[#0A0A0B]'>
        <div className='absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-red-600/10 blur-[150px]' />
        <div className='absolute right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-[150px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center lg:mb-20'>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            Проблема, которую мы решаем
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-zinc-400'>
            Для Tilda не существовало нормального инструмента системы
            лояльности. До сегодняшнего дня.
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 lg:gap-12'>
          {/* Problem column */}
          <div className='relative'>
            <div className='absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-xl' />
            <div className='relative rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-sm'>
              <div className='mb-8 flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20'>
                  <X className='h-5 w-5 text-red-500' />
                </div>
                <h3 className='text-xl font-semibold text-white'>
                  Было раньше
                </h3>
              </div>
              <ul className='space-y-4'>
                {problems.map((problem, index) => (
                  <li key={index} className='flex items-start gap-4'>
                    <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10'>
                      <X className='h-3.5 w-3.5 text-red-500' />
                    </div>
                    <span className='leading-relaxed text-zinc-400'>
                      {problem}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Solution column */}
          <div className='relative'>
            <div className='absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-xl' />
            <div className='relative rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-sm'>
              <div className='mb-8 flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20'>
                  <Check className='h-5 w-5 text-emerald-500' />
                </div>
                <h3 className='text-xl font-semibold text-white'>
                  Теперь с GUPIL
                </h3>
              </div>
              <ul className='space-y-4'>
                {solutions.map((solution, index) => (
                  <li key={index} className='flex items-start gap-4'>
                    <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10'>
                      <Check className='h-3.5 w-3.5 text-emerald-500' />
                    </div>
                    <span className='leading-relaxed text-zinc-300'>
                      {solution}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className='mt-16 text-center'>
          <div className='inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-orange-500/10 to-pink-500/10 px-6 py-4'>
            <Zap className='h-5 w-5 text-orange-500' />
            <span className='font-medium text-white'>
              Система лояльности для Tilda = GUPIL.RU
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
