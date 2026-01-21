/**
 * @file: src/components/composite/stats-card.tsx
 * @description: Универсальная карточка статистики с иконкой и изменением
 * @project: SaaS Bonus System
 * @dependencies: lucide-react, shadcn/ui
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { ReactNode } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  // Content
  title: string;
  value: string | number;
  description?: string;

  // Icon
  icon?: LucideIcon | ReactNode;
  iconClassName?: string;

  // Change indicator
  change?: number;
  changeLabel?: string;
  showTrend?: boolean;

  // Styling
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';

  // Loading
  loading?: boolean;
}

const variantClasses = {
  default: 'text-primary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600'
};

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  change,
  changeLabel,
  showTrend = true,
  className,
  variant = 'default',
  loading = false
}: StatsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card className={cn('', className)}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        {Icon && (
          <div className={cn('text-muted-foreground', iconClassName)}>
            {typeof Icon === 'function' ? <Icon className='h-4 w-4' /> : Icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className='space-y-2'>
            <div className='bg-muted h-8 w-24 animate-pulse rounded' />
            <div className='bg-muted h-4 w-32 animate-pulse rounded' />
          </div>
        ) : (
          <>
            <div className={cn('text-2xl font-bold', variantClasses[variant])}>
              {value}
            </div>

            {(description || change !== undefined) && (
              <div className='text-muted-foreground mt-1 flex items-center gap-2 text-xs'>
                {change !== undefined && showTrend && (
                  <span
                    className={cn(
                      'flex items-center gap-1 font-medium',
                      isPositive && 'text-green-600',
                      isNegative && 'text-red-600'
                    )}
                  >
                    {isPositive && <TrendingUp className='h-3 w-3' />}
                    {isNegative && <TrendingDown className='h-3 w-3' />}
                    {isPositive && '+'}
                    {change}%
                  </span>
                )}

                {changeLabel && <span>{changeLabel}</span>}

                {description && !changeLabel && <span>{description}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
