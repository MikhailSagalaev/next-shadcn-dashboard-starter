/**
 * @file: user-referrals-section.tsx
 * @description: Компонент для отображения реферальной сети пользователя
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-12-05
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { ReferralTree } from './referral-tree';
import type { ReferralUser } from '@/lib/utils/referral-utils';

interface UserReferralsSectionProps {
  userId: string;
  projectId: string;
}

interface ReferralStats {
  totalReferrals: number;
  totalBonusesEarned: number;
  referralsByLevel: { level: number; count: number }[];
}

interface ReferralsResponse {
  referrals: ReferralUser[];
  stats: ReferralStats | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export function UserReferralsSection({
  userId,
  projectId
}: UserReferralsSectionProps) {
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [pagination, setPagination] = useState<
    ReferralsResponse['pagination'] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [childReferrals, setChildReferrals] = useState<
    Map<string, ReferralUser[]>
  >(new Map());

  const loadReferrals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${userId}/referrals?level=1`
      );

      if (!response.ok) {
        throw new Error('Failed to load referrals');
      }

      const data: ReferralsResponse = await response.json();
      setReferrals(data.referrals);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError('Ошибка загрузки рефералов');
      console.error('Failed to load referrals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const handleExpand = async (referralId: string, level: number) => {
    if (expandedIds.has(referralId)) {
      // Collapse
      const newExpanded = new Set(expandedIds);
      newExpanded.delete(referralId);
      setExpandedIds(newExpanded);
      return;
    }

    // Load children if not already loaded
    if (!childReferrals.has(referralId)) {
      setLoadingIds((prev) => new Set(prev).add(referralId));

      try {
        const response = await fetch(
          `/api/projects/${projectId}/users/${userId}/referrals?parentId=${referralId}&level=${level + 1}`
        );

        if (response.ok) {
          const result: ReferralsResponse = await response.json();
          setChildReferrals((prev) =>
            new Map(prev).set(referralId, result.referrals)
          );
        }
      } catch (err) {
        console.error('Failed to load child referrals:', err);
      } finally {
        setLoadingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(referralId);
          return newSet;
        });
      }
    }

    // Expand
    setExpandedIds((prev) => new Set(prev).add(referralId));
  };

  const handleLoadMore = async (
    parentId: string,
    level: number,
    page: number
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/users/${userId}/referrals?parentId=${parentId}&level=${level}&page=${page}`
      );

      if (response.ok) {
        const result: ReferralsResponse = await response.json();
        if (parentId === userId) {
          setReferrals((prev) => [...prev, ...result.referrals]);
          setPagination(result.pagination);
        } else {
          setChildReferrals((prev) => {
            const existing = prev.get(parentId) || [];
            return new Map(prev).set(parentId, [
              ...existing,
              ...result.referrals
            ]);
          });
        }
      }
    } catch (err) {
      console.error('Failed to load more referrals:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-4'>
        <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        <span className='text-muted-foreground ml-2 text-sm'>
          Загрузка рефералов...
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex flex-col items-center justify-center py-4'>
        <AlertCircle className='text-destructive h-8 w-8' />
        <p className='text-destructive mt-2 text-sm'>{error}</p>
        <Button
          variant='outline'
          size='sm'
          className='mt-2'
          onClick={loadReferrals}
        >
          <RefreshCw className='mr-2 h-4 w-4' />
          Повторить
        </Button>
      </div>
    );
  }

  // Empty state
  if (referrals.length === 0) {
    return (
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-medium'>Рефералы</Label>
        </div>
        <div className='text-muted-foreground flex flex-col items-center py-6'>
          <Users className='h-10 w-10 opacity-50' />
          <p className='mt-2 text-sm'>У пользователя нет рефералов</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Header with stats */}
      <div className='flex items-center justify-between'>
        <Label className='text-sm font-medium'>Рефералы</Label>
        <div className='flex items-center gap-2'>
          {stats && (
            <>
              <Badge variant='secondary'>{stats.totalReferrals} всего</Badge>
              {stats.totalBonusesEarned > 0 && (
                <Badge variant='outline'>
                  +{stats.totalBonusesEarned.toLocaleString('ru-RU')} бонусов
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats by level */}
      {stats && stats.referralsByLevel.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {stats.referralsByLevel.map(({ level, count }) => (
            <Badge key={level} variant='outline' className='text-xs'>
              Уровень {level}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Referral tree */}
      <ReferralTree
        referrals={referrals}
        expandedIds={expandedIds}
        loadingIds={loadingIds}
        childReferrals={childReferrals}
        onExpand={handleExpand}
        onLoadMore={handleLoadMore}
        pagination={pagination || undefined}
        rootUserId={userId}
      />
    </div>
  );
}
