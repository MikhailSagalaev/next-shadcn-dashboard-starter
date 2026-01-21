/**
 * @file: homepage-footer.tsx
 * @description: Футер в стиле Meridian с CTA (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui
 * @created: 2026-01-06
 * @updated: 2026-01-21 - Оптимизация: Server Component (статичный контент)
 * @author: AI Assistant + User
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const footerLinks = {
  product: [
    { name: 'Возможности', href: '#features' },
    { name: 'Тарифы', href: '#pricing' },
    { name: 'Интеграции', href: '#' },
    { name: 'API', href: '/docs' }
  ],
  company: [
    { name: 'О нас', href: '#' },
    { name: 'Блог', href: '#' },
    { name: 'Контакты', href: '#' }
  ],
  resources: [
    { name: 'Документация', href: '/docs' },
    { name: 'Помощь', href: '#' },
    { name: 'Changelog', href: '#' }
  ]
};

export function HomepageFooter() {
  return (
    <footer className='bg-[#1A1A1A]'>
      {/* CTA Section */}
      <div className='border-b border-white/10'>
        <div className='mx-auto max-w-[1200px] px-6 py-24'>
          <div className='flex flex-col items-center text-center'>
            <h2 className='mb-4 text-[40px] leading-[1.15] font-semibold tracking-[-0.02em] text-white'>
              Готовы начать?
            </h2>
            <p className='mb-10 max-w-md text-lg text-[#999999]'>
              Запустите программу лояльности за 5 минут и увеличьте повторные
              продажи
            </p>
            <div className='flex flex-col gap-4 sm:flex-row'>
              <Button
                asChild
                className='h-12 rounded-full bg-[#FF4D00] px-8 text-[15px] font-medium text-white shadow-lg shadow-orange-500/25 hover:bg-[#E64500]'
              >
                <Link href='/auth/sign-up' className='flex items-center gap-2'>
                  Начать бесплатно
                  <ArrowRight className='h-4 w-4' />
                </Link>
              </Button>
              <Button
                asChild
                variant='outline'
                className='h-12 rounded-full border-white/20 bg-transparent px-8 text-[15px] font-medium text-white hover:bg-white/10'
              >
                <Link href='#'>Запросить демо</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Links Section */}
      <div className='mx-auto max-w-[1200px] px-6 py-16'>
        <div className='grid gap-12 md:grid-cols-2 lg:grid-cols-5'>
          {/* Brand */}
          <div className='lg:col-span-2'>
            <Link href='/homepage' className='flex items-center gap-2'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4D00]'>
                <span className='text-lg font-bold text-white'>G</span>
              </div>
              <span className='text-xl font-semibold text-white'>Gupil</span>
            </Link>
            <p className='mt-4 max-w-xs text-[15px] text-[#666666]'>
              Система лояльности для современного бизнеса. Бонусы, рефералки,
              аналитика — всё в одном месте.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className='mb-4 text-[13px] font-medium tracking-wider text-[#666666] uppercase'>
              Продукт
            </h4>
            <ul className='space-y-3'>
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className='text-[15px] text-[#999999] transition-colors hover:text-white'
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className='mb-4 text-[13px] font-medium tracking-wider text-[#666666] uppercase'>
              Компания
            </h4>
            <ul className='space-y-3'>
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className='text-[15px] text-[#999999] transition-colors hover:text-white'
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className='mb-4 text-[13px] font-medium tracking-wider text-[#666666] uppercase'>
              Ресурсы
            </h4>
            <ul className='space-y-3'>
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className='text-[15px] text-[#999999] transition-colors hover:text-white'
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className='mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row'>
          <p className='text-[13px] text-[#666666]'>
            © {new Date().getFullYear()} Gupil. Все права защищены.
          </p>
          <div className='flex gap-6'>
            <Link
              href='#'
              className='text-[#666666] transition-colors hover:text-white'
            >
              <span className='sr-only'>Telegram</span>
              <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
