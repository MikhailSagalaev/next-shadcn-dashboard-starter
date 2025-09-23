/**
 * @file: logo.tsx
 * @description: Компонент логотипа системы
 * @project: SaaS Bonus System
 * @created: 2025-09-23
 * @author: AI Assistant + User
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className, width = 32, height = 32 }: LogoProps) {
  const aspectRatio = 608 / 557; // оригинальное соотношение сторон
  const calculatedHeight = width / aspectRatio;

  return (
    <svg
      width={width}
      height={height || calculatedHeight}
      viewBox='0 0 608 557'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={cn('flex-shrink-0', className)}
    >
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M607.098 0C608.529 9.91298 608.296 20.4475 606.206 31.6123C565.6 248.544 365.926 311.307 303.191 556.447C244.779 310.795 12.7848 227.551 0.178447 31.6123C-0.405048 22.543 0.451806 13.8486 2.61106 5.53516C64.1474 47.6326 174.77 75.7109 301.007 75.7109C432.697 75.7109 547.393 45.1525 607.098 0Z'
        fill='currentColor'
      />
    </svg>
  );
}

export default Logo;
