/**
 * @file: referral-item.tsx
 * @description: Компонент отображения одного реферала
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-12-05
 * @author: AI Assistant + User
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Loader2, User, Users } from 'lucide-react';
import {
  formatReferralUser,
  type ReferralUser
} from '@/lib/utils/referral-utils';

interface ReferralItemProps {
  referral: ReferralUser;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  onExpand: () => void;
}

export function ReferralItem({
  referral,
  isExpanded,
  isLoading,
  hasChildren,
  onExpand
}: ReferralItemProps) {
  const formatted = formatReferralUser(referral);

  return (
    <div className='bg-card hover:bg-accent/50 flex items-center gap-2 rounded-md border p-2 transition-colors'>
      {/* Expand/collapse button */}
      <div className='w-6'>
        {hasChildren ? (
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={onExpand}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : isExpanded ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </Button>
        ) : (
          <div className='flex h-6 w-6 items-center justify-center'>
            <User className='text-muted-foreground h-3 w-3' />
          </div>
        )}
      </div>

      {/* User info */}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate text-sm font-medium'>
            {formatted.displayName}
          </span>
          <Badge variant='outline' className='shrink-0 text-xs'>
            Ур. {referral.level}
          </Badge>
        </div>
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          {formatted.email && (
            <span className='truncate'>{formatted.email}</span>
          )}
          {formatted.email && formatted.phone && <span>•</span>}
          {formatted.phone && <span>{formatted.phone}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className='flex shrink-0 items-center gap-2'>
        <div className='text-right'>
          <div className='text-sm font-medium'>{formatted.bonusBalance} ₽</div>
          <div className='text-muted-foreground text-xs'>
            {formatted.formattedDate}
          </div>
        </div>

        {/* Referral count indicator */}
        {hasChildren && (
          <Badge variant='secondary' className='text-xs'>
            <Users className='mr-1 h-3 w-3' />
            {referral.referralCount}
          </Badge>
        )}
      </div>
    </div>
  );
}
