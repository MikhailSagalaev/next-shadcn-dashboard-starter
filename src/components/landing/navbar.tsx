/**
 * @file: navbar.tsx
 * @description: Навигационное меню лэндинга - современный темный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, Next.js, Shadcn/ui
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { name: 'Возможности', href: '#features' },
  { name: 'Тарифы', href: '#pricing' },
  { name: 'Как это работает', href: '#how-it-works' },
  { name: 'FAQ', href: '#faq' }
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'border-b border-white/10 bg-[#0A0A0B]/90 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between lg:h-20'>
          {/* Логотип */}
          <Link href='/landing' className='group flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-pink-600'>
              <span className='text-lg font-bold text-white'>G</span>
            </div>
            <span className='text-xl font-semibold tracking-tight text-white'>
              GUPIL
            </span>
          </Link>

          {/* Desktop навигация */}
          <div className='hidden items-center gap-1 lg:flex'>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className='rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white'
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* CTA кнопки */}
          <div className='hidden items-center gap-3 lg:flex'>
            <Button
              asChild
              variant='ghost'
              className='text-zinc-400 hover:bg-white/5 hover:text-white'
            >
              <Link href='/auth/sign-in'>Войти</Link>
            </Button>
            <Button
              asChild
              className='bg-white px-5 font-medium text-black hover:bg-zinc-200'
            >
              <Link href='/auth/sign-up'>Начать бесплатно</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className='p-2 text-zinc-400 hover:text-white lg:hidden'
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className='border-t border-white/10 py-4 lg:hidden'>
            <div className='flex flex-col gap-2'>
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className='rounded-lg px-4 py-3 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white'
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className='mt-4 flex flex-col gap-2 border-t border-white/10 pt-4'>
                <Button
                  asChild
                  variant='ghost'
                  className='justify-start text-zinc-400 hover:bg-white/5 hover:text-white'
                >
                  <Link href='/auth/sign-in'>Войти</Link>
                </Button>
                <Button
                  asChild
                  className='bg-white font-medium text-black hover:bg-zinc-200'
                >
                  <Link href='/auth/sign-up'>Начать бесплатно</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
