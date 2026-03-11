/**
 * @file: bonus-mode-card.tsx
 * @description: Карточка выбора режима начисления бонусов
 * @project: SaaS Bonus System
 * @created: 2026-03-09
 * @author: AI Assistant + User
 */

'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BonusModeCardProps {
  mode: 'SIMPLE' | 'LEVELS';
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  disabled?: boolean;
}

export function BonusModeCard({
  mode,
  selected,
  onClick,
  title,
  description,
  icon: Icon,
  features,
  disabled = false
}: BonusModeCardProps) {
  return (
    <motion.button
      type='button'
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        'group relative flex flex-col items-start gap-4 rounded-xl border-2 p-6 text-left transition-all',
        selected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {/* Radio indicator */}
      <div className='absolute top-4 right-4'>
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
            selected
              ? 'border-indigo-500 bg-indigo-500'
              : 'border-zinc-300 dark:border-zinc-600'
          )}
        >
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className='h-2 w-2 rounded-full bg-white'
            />
          )}
        </div>
      </div>

      {/* Icon */}
      <div
        className={cn(
          'rounded-lg p-3 transition-colors',
          selected
            ? 'bg-indigo-500 text-white'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
        )}
      >
        <Icon className='h-6 w-6' />
      </div>

      {/* Content */}
      <div className='flex-1 space-y-2'>
        <h3
          className={cn(
            'text-lg font-semibold transition-colors',
            selected
              ? 'text-indigo-900 dark:text-indigo-100'
              : 'text-zinc-900 dark:text-zinc-100'
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'text-sm transition-colors',
            selected
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-zinc-600 dark:text-zinc-400'
          )}
        >
          {description}
        </p>

        {/* Features */}
        <ul className='mt-4 space-y-2'>
          {features.map((feature, index) => (
            <li
              key={index}
              className={cn(
                'flex items-start gap-2 text-xs transition-colors',
                selected
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-500 dark:text-zinc-500'
              )}
            >
              <span className='mt-0.5'>•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.button>
  );
}
