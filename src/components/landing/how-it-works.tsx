/**
 * @file: how-it-works.tsx
 * @description: Секция "Как это работает" - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { UserPlus, Settings, Webhook, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Создайте проект',
    description:
      'Зарегистрируйтесь и создайте новый проект в панели управления за 30 секунд'
  },
  {
    number: '02',
    icon: Settings,
    title: 'Настройте бонусы',
    description:
      'Укажите правила начисления, уровни лояльности и срок действия бонусов'
  },
  {
    number: '03',
    icon: Webhook,
    title: 'Подключите webhook',
    description:
      'Скопируйте URL и вставьте в настройки формы Tilda. Одна строка — готово'
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Запускайте!',
    description:
      'Система работает. Клиенты получают бонусы, вы видите аналитику'
  }
];

export function HowItWorks() {
  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-[#0A0A0B]'>
        <div className='absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-orange-600/10 blur-[150px]' />
        <div className='absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[150px]' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center lg:mb-20'>
          <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2'>
            <span className='text-sm font-medium text-orange-500'>
              Быстрый старт
            </span>
          </div>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            4 шага к запуску
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-zinc-400'>
            Полная настройка системы лояльности за 5 минут
          </p>
        </div>

        {/* Steps */}
        <div className='relative'>
          {/* Connection line */}
          <div className='absolute top-1/2 right-0 left-0 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block' />

          <div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-4'>
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className='group relative'>
                  {/* Card */}
                  <div className='relative rounded-2xl border border-white/5 bg-zinc-900/50 p-6 transition-all duration-300 hover:border-orange-500/30'>
                    {/* Step number */}
                    <div className='absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-600'>
                      <span className='text-xs font-bold text-white'>
                        {step.number}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className='mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 transition-colors group-hover:bg-orange-500/10'>
                      <Icon className='h-6 w-6 text-zinc-400 transition-colors group-hover:text-orange-500' />
                    </div>

                    {/* Content */}
                    <h3 className='mb-2 text-lg font-semibold text-white'>
                      {step.title}
                    </h3>
                    <p className='text-sm leading-relaxed text-zinc-500'>
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow for mobile */}
                  {index < steps.length - 1 && (
                    <div className='my-4 flex justify-center sm:hidden'>
                      <div className='h-8 w-px bg-gradient-to-b from-orange-500/50 to-transparent' />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom message */}
        <div className='mt-16 text-center'>
          <p className='text-zinc-500'>
            Никаких сложных настроек. Никакого кода. Просто работает.
          </p>
        </div>
      </div>
    </section>
  );
}
