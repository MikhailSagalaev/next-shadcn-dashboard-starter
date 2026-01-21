/**
 * @file: src/components/composite/page-header.tsx
 * @description: Универсальный заголовок страницы с действиями и breadcrumbs
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Heading } from '@/components/ui/heading';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  // Content
  title: string;
  description?: string;

  // Navigation
  backButton?: boolean;
  backHref?: string;
  breadcrumbs?: ReactNode;

  // Actions
  actions?: ReactNode;

  // Styling
  className?: string;
  showSeparator?: boolean;
}

export function PageHeader({
  title,
  description,
  backButton = false,
  backHref,
  breadcrumbs,
  actions,
  className,
  showSeparator = true
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {breadcrumbs && <div className='mb-2'>{breadcrumbs}</div>}

      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          {backButton && (
            <Button
              variant='ghost'
              size='icon'
              onClick={handleBack}
              className='h-8 w-8'
            >
              <ArrowLeft className='h-4 w-4' />
            </Button>
          )}

          <div>
            <Heading title={title} description={description} />
          </div>
        </div>

        {actions && <div className='flex items-center gap-2'>{actions}</div>}
      </div>

      {showSeparator && <Separator />}
    </div>
  );
}
