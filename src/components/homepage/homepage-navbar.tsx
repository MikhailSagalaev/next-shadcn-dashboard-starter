/**
 * @file: homepage-navbar.tsx
 * @description: Навбар в стиле Meridian
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const navLinks = [
  { name: 'Главная', href: '/homepage' },
  { name: 'Тарифы', href: '#pricing' },
  { name: 'Блог', href: '#' },
  { name: 'Контакты', href: '#' },
  { name: 'Документация', href: '/docs' }
];

export function HomepageNavbar() {
  return (
    <header className='fixed top-0 right-0 left-0 z-50'>
      <div className='mx-auto max-w-[1200px] px-6'>
        <nav className='flex h-20 items-center justify-between'>
          {/* Logo */}
          <Link href='/homepage' className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4D00]'>
              <span className='text-lg font-bold text-white'>G</span>
            </div>
            <span className='text-xl font-semibold text-[#1A1A1A]'>Gupil</span>
          </Link>

          {/* Nav Links */}
          <div className='hidden items-center gap-8 md:flex'>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className='text-[15px] font-medium text-[#666666] transition-colors hover:text-[#1A1A1A]'
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className='flex items-center gap-3'>
            <Button
              asChild
              variant='ghost'
              className='h-10 px-4 text-[15px] font-medium text-[#666666] hover:bg-transparent hover:text-[#1A1A1A]'
            >
              <Link href='/auth/sign-in'>Login</Link>
            </Button>
            <Button
              asChild
              className='h-10 rounded-full bg-[#FF4D00] px-5 text-[15px] font-medium text-white hover:bg-[#E64500]'
            >
              <Link href='/auth/sign-up'>Get a demo</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
