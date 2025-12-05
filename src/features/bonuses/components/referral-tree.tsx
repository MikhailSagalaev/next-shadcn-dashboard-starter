/**
 * @file: referral-tree.tsx
 * @description: Компонент дерева рефералов с иерархической структурой
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-12-05
 * @author: AI Assistant + User
 */

'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ReferralItem } from './referral-item';
import type { ReferralUser } from '@/lib/utils/referral-utils';

interface ReferralTreeProps {
  referrals: ReferralUser[];
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  childReferrals: Map<string, ReferralUser[]>;
  onExpand: (referralId: string, level: number) => void;
  onLoadMore: (parentId: string, level: number, page: number) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  rootUserId: string;
}

export function ReferralTree({
  referrals,
  expandedIds,
  loadingIds,
  childReferrals,
  onExpand,
  onLoadMore,
  pagination,
  rootUserId
}: ReferralTreeProps) {
  const renderReferralWithChildren = (
    referral: ReferralUser,
    depth: number = 0
  ): React.ReactNode => {
    const isExpanded = expandedIds.has(referral.id);
    const isLoading = loadingIds.has(referral.id);
    const children = childReferrals.get(referral.id) || [];
    const hasChildren = referral.referralCount > 0;

    return (
      <div key={referral.id} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
        <ReferralItem
          referral={referral}
          isExpanded={isExpanded}
          isLoading={isLoading}
          hasChildren={hasChildren}
          onExpand={() => onExpand(referral.id, referral.level)}
        />

        {/* Render children if expanded */}
        {isExpanded && children.length > 0 && (
          <div className='border-muted ml-4 border-l-2 pl-2'>
            {children.map((child) =>
              renderReferralWithChildren(child, depth + 1)
            )}
          </div>
        )}

        {/* Loading indicator for children */}
        {isExpanded && isLoading && (
          <div className='ml-6 flex items-center py-2'>
            <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
            <span className='text-muted-foreground ml-2 text-sm'>
              Загрузка...
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='space-y-1'>
      {referrals.map((referral) => renderReferralWithChildren(referral))}

      {/* Load more button for root level */}
      {pagination?.hasMore && (
        <div className='pt-2'>
          <Button
            variant='outline'
            size='sm'
            className='w-full'
            onClick={() => onLoadMore(rootUserId, 1, pagination.page + 1)}
          >
            Загрузить ещё ({pagination.total - referrals.length} осталось)
          </Button>
        </div>
      )}
    </div>
  );
}
