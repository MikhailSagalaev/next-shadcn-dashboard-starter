/**
 * @file: faq.tsx
 * @description: Секция FAQ - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn/ui
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Как быстро можно подключить систему?',
    answer:
      'Подключение занимает 5 минут. Создайте проект, настройте бонусы, скопируйте webhook в Tilda — и система готова к работе.'
  },
  {
    question: 'Нужна ли техническая поддержка для интеграции?',
    answer:
      'Нет, интеграция очень простая — справится даже не-технарь. Но если нужна помощь, мы предоставляем консультации.'
  },
  {
    question: 'Как работает интеграция с личным кабинетом?',
    answer:
      'GUPIL — единственное решение для Tilda с прямой интеграцией в личный кабинет пользователей. Это уникальная функция на рынке.'
  },
  {
    question: 'Можно ли использовать несколько проектов?',
    answer:
      'Да. Basic — 1 проект, Pro — 3 проекта, Enterprise — без ограничений.'
  },
  {
    question: 'Как работает Telegram бот?',
    answer:
      'Для каждого проекта создается уникальный бот. Пользователи привязывают аккаунт по телефону или email, проверяют баланс и историю операций.'
  },
  {
    question: 'Какие способы оплаты доступны?',
    answer:
      'Ежемесячная, полугодовая и годовая подписка. При оплате за год — скидка 20%.'
  },
  {
    question: 'Есть ли ограничения по количеству пользователей?',
    answer: 'Basic — до 1 000, Pro — до 10 000, Enterprise — без ограничений.'
  },
  {
    question: 'Как получить поддержку?',
    answer:
      'Telegram-чат с живыми людьми. Быстрые ответы от создателя и комьюнити специалистов.'
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className='relative overflow-hidden py-24 lg:py-32'>
      {/* Background */}
      <div className='absolute inset-0 bg-zinc-950' />

      <div className='relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-16 text-center'>
          <p className='mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase'>
            FAQ
          </p>
          <h2 className='mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl'>
            Частые вопросы
          </h2>
          <p className='text-lg text-zinc-400'>
            Ответы на популярные вопросы о системе
          </p>
        </div>

        {/* FAQ items */}
        <div className='space-y-3'>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className='overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]'
            >
              <button
                className='flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]'
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className='pr-4 font-medium text-white'>
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className='px-5 pb-5 leading-relaxed text-zinc-400'>
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
