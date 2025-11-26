/**
 * @file: footer.tsx
 * @description: Footer лэндинга - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Lucide-react
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import Link from 'next/link';
import { MessageCircle, Mail, ExternalLink } from 'lucide-react';

const footerLinks = {
  product: [
    { name: 'Возможности', href: '#features' },
    { name: 'Тарифы', href: '#pricing' },
    { name: 'Как это работает', href: '#how-it-works' },
    { name: 'FAQ', href: '#faq' }
  ],
  resources: [
    { name: 'Документация', href: '/docs', external: true },
    { name: 'API Reference', href: '/docs/api', external: true },
    { name: 'Интеграция', href: '/docs/webhook-integration', external: true }
  ],
  support: [
    { name: 'Telegram', href: 'https://t.me/gupil_support', external: true },
    { name: 'Email', href: 'mailto:support@gupil.ru' }
  ]
};

export function Footer() {
  return (
    <footer className='relative border-t border-white/5 bg-[#0A0A0B]'>
      <div className='mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12'>
          {/* Brand */}
          <div className='col-span-2 md:col-span-1'>
            <Link href='/landing' className='mb-4 flex items-center gap-3'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-600'>
                <span className='text-sm font-bold text-white'>G</span>
              </div>
              <span className='text-lg font-semibold text-white'>GUPIL</span>
            </Link>
            <p className='mb-4 text-sm leading-relaxed text-zinc-500'>
              Система лояльности для Tilda. Бонусы, боты и аналитика в одном
              решении.
            </p>
            <div className='flex items-center gap-3'>
              <Link
                href='https://t.me/gupil_support'
                target='_blank'
                rel='noopener noreferrer'
                className='flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/10'
              >
                <MessageCircle className='h-4 w-4 text-zinc-400' />
              </Link>
              <Link
                href='mailto:support@gupil.ru'
                className='flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/10'
              >
                <Mail className='h-4 w-4 text-zinc-400' />
              </Link>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className='mb-4 text-sm font-semibold text-white'>Продукт</h3>
            <ul className='space-y-3'>
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className='text-sm text-zinc-500 transition-colors hover:text-white'
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className='mb-4 text-sm font-semibold text-white'>Ресурсы</h3>
            <ul className='space-y-3'>
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className='inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-white'
                  >
                    {link.name}
                    {link.external && <ExternalLink className='h-3 w-3' />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className='mb-4 text-sm font-semibold text-white'>Поддержка</h3>
            <ul className='space-y-3'>
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className='inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-white'
                  >
                    {link.name}
                    {link.external && <ExternalLink className='h-3 w-3' />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className='mt-12 border-t border-white/5 pt-8'>
          <div className='flex flex-col items-center justify-between gap-4 sm:flex-row'>
            <p className='text-sm text-zinc-600'>
              © {new Date().getFullYear()} GUPIL. Все права защищены.
            </p>
            <div className='flex items-center gap-6 text-sm text-zinc-600'>
              <Link href='#' className='transition-colors hover:text-white'>
                Политика конфиденциальности
              </Link>
              <Link href='#' className='transition-colors hover:text-white'>
                Условия использования
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
