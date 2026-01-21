/**
 * @file: homepage-steps.tsx
 * @description: Секция шагов в стиле Meridian (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, Lucide-react
 * @created: 2026-01-06
 * @updated: 2026-01-21 - Оптимизация: Server Component (статичный контент)
 * @author: AI Assistant + User
 */

import { Settings, Globe, Bot, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Settings,
    title: 'Настройка',
    description:
      'Создайте проект и настройте параметры бонусной программы: процент начисления, срок действия.'
  },
  {
    number: '02',
    icon: Globe,
    title: 'Сайт',
    description:
      'Добавьте виджет на сайт. Поддержка Tilda, WordPress и любых других платформ.'
  },
  {
    number: '03',
    icon: Bot,
    title: 'Бот',
    description:
      'Подключите Telegram бота. Клиенты смогут проверять баланс и получать уведомления.'
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Результат',
    description:
      'Система готова! Отслеживайте статистику и растите лояльность клиентов.'
  }
];

export function HomepageSteps() {
  return (
    <section id='steps' className='bg-[#FAFAFA] py-24'>
      <div className='mx-auto max-w-[1200px] px-6'>
        {/* Header */}
        <div className='mb-16 text-center'>
          <h2 className='mb-4 text-[40px] leading-[1.15] font-semibold tracking-[-0.02em] text-[#1A1A1A]'>
            Установка в четыре шага
          </h2>
          <p className='mx-auto max-w-md text-lg text-[#666666]'>
            Запустите программу лояльности за 5 минут без помощи программистов
          </p>
        </div>

        {/* Steps Grid */}
        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
          {steps.map((step, i) => (
            <div
              key={i}
              className='group relative rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-md'
            >
              {/* Step number */}
              <div className='mb-6 flex items-center justify-between'>
                <span className='text-[13px] font-semibold text-[#FF4D00]'>
                  {step.number}
                </span>
                <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAFAFA] transition-colors group-hover:bg-[#FF4D00]/10'>
                  <step.icon className='h-6 w-6 text-[#1A1A1A] transition-colors group-hover:text-[#FF4D00]' />
                </div>
              </div>

              {/* Content */}
              <h3 className='mb-3 text-xl font-semibold text-[#1A1A1A]'>
                {step.title}
              </h3>
              <p className='text-[15px] leading-relaxed text-[#666666]'>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
