/**
 * @file: bonus-stats-cards.tsx
 * @description: Компонент карточек статистики бонусной системы
 * @project: SaaS Bonus System
 * @dependencies: react, ui components, icons
 * @created: 2025-01-27
 * @author: AI Assistant + User
 */

'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Coins,
  TrendingUp,
  AlertTriangle,
  Activity,
  Send,
  MessageSquare,
  Smartphone
} from 'lucide-react';

export interface BonusStats {
  totalUsers: number;
  activeUsers: number;
  totalBonuses: number;
  telegramUsers?: number;
  telegramEligible?: number;
  maxUsers?: number;
  maxEligible?: number;
  noMessenger?: number;
  pendingBonuses?: number;
  expiringSoonBonuses?: number;
  averageBonusPerUser?: number;
  conversionRate?: number;
  monthlyGrowth?: number;
}

interface BonusStatsCardsProps {
  stats: BonusStats;
  isLoading?: boolean;
  error?: string | null;
}

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ElementType;
  variant: 'default' | 'success' | 'warning' | 'destructive';
  badge?: {
    text: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
}

export const BonusStatsCards = memo<BonusStatsCardsProps>(
  ({ stats, isLoading = false, error = null }) => {
    // Вычисляем производные метрики
    const conversionRate =
      stats.totalUsers > 0
        ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
        : 0;

    const averageBonusPerUser =
      stats.totalUsers > 0
        ? Number((stats.totalBonuses / stats.totalUsers).toFixed(2))
        : 0;

    const hasAudienceStats =
      stats.telegramUsers !== undefined || stats.telegramEligible !== undefined;

    // Определяем карточки статистики
    const statCards: StatCard[] = hasAudienceStats
      ? [
          {
            title: 'Всего контактов',
            value: stats.totalUsers.toLocaleString('ru-RU'),
            subtitle: `${stats.activeUsers.toLocaleString('ru-RU')} активных в системе`,
            icon: Users,
            variant: 'default',
            badge:
              stats.activeUsers > 0
                ? {
                    text: `${conversionRate}% активность`,
                    variant: conversionRate > 50 ? 'default' : 'secondary'
                  }
                : undefined
          },
          {
            title: 'Telegram для рассылок',
            value: (
              stats.telegramEligible ??
              stats.telegramUsers ??
              0
            ).toLocaleString('ru-RU'),
            subtitle: 'доступно для рассылок',
            icon: Send,
            variant:
              (stats.telegramEligible ?? stats.telegramUsers ?? 0) > 0
                ? 'success'
                : 'default',
            badge: {
              text: `${Math.round(((stats.telegramEligible ?? stats.telegramUsers ?? 0) / (stats.totalUsers || 1)) * 100)}% базы`,
              variant:
                (stats.telegramEligible ?? stats.telegramUsers ?? 0) > 0
                  ? 'default'
                  : 'secondary'
            }
          },
          {
            title: 'MAX для рассылок',
            value: (stats.maxEligible ?? stats.maxUsers ?? 0).toLocaleString(
              'ru-RU'
            ),
            subtitle: 'доступно для рассылок',
            icon: MessageSquare,
            variant:
              (stats.maxEligible ?? stats.maxUsers ?? 0) > 0
                ? 'success'
                : 'default',
            badge: {
              text: `${Math.round(((stats.maxEligible ?? stats.maxUsers ?? 0) / (stats.totalUsers || 1)) * 100)}% базы`,
              variant: 'outline'
            }
          },
          {
            title: 'Без мессенджера',
            value: (
              stats.noMessenger ??
              Math.max(
                0,
                stats.totalUsers -
                  (stats.telegramUsers ?? 0) -
                  (stats.maxUsers ?? 0)
              )
            ).toLocaleString('ru-RU'),
            subtitle: 'Только телефон или email в CRM',
            icon: Smartphone,
            variant: 'default',
            badge: {
              text: `${Math.round(((stats.noMessenger ?? stats.totalUsers - (stats.telegramUsers ?? 0)) / (stats.totalUsers || 1)) * 100)}% базы`,
              variant: 'secondary'
            }
          },
          {
            title: 'Общий баланс бонусов',
            value: `${Number(stats.totalBonuses).toFixed(2)} бонусов`,
            subtitle:
              averageBonusPerUser > 0
                ? `${averageBonusPerUser.toFixed(2)} на пользователя`
                : undefined,
            icon: Coins,
            variant: 'success'
          }
        ]
      : [
          {
            title: 'Всего пользователей',
            value: stats.totalUsers.toLocaleString('ru-RU'),
            subtitle: `${stats.activeUsers} активных`,
            trend: stats.monthlyGrowth
              ? {
                  value: stats.monthlyGrowth,
                  isPositive: stats.monthlyGrowth > 0
                }
              : undefined,
            icon: Users,
            variant: 'default',
            badge:
              stats.activeUsers > 0
                ? {
                    text: `${conversionRate}% активность`,
                    variant: conversionRate > 50 ? 'default' : 'secondary'
                  }
                : undefined
          },
          {
            title: 'Общий баланс бонусов',
            value: `${Number(stats.totalBonuses).toFixed(2)} бонусов`,
            subtitle:
              averageBonusPerUser > 0
                ? `${averageBonusPerUser.toFixed(2)} бонусов на пользователя`
                : undefined,
            icon: Coins,
            variant: 'success'
          },
          {
            title: 'Активные пользователи',
            value: stats.activeUsers.toLocaleString('ru-RU'),
            subtitle:
              stats.totalUsers > 0
                ? `${conversionRate}% от общего числа`
                : undefined,
            icon: Activity,
            variant: stats.activeUsers > 0 ? 'default' : 'warning',
            badge: {
              text:
                conversionRate > 70
                  ? 'Отлично'
                  : conversionRate > 40
                    ? 'Хорошо'
                    : 'Низкая активность',
              variant:
                conversionRate > 70
                  ? 'default'
                  : conversionRate > 40
                    ? 'secondary'
                    : 'destructive'
            }
          }
        ];

    if (error) {
      return (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <Card className='border-destructive'>
            <CardContent className='p-6'>
              <div className='text-destructive flex items-center space-x-2'>
                <AlertTriangle className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  Ошибка загрузки статистики
                </span>
              </div>
              <p className='text-muted-foreground mt-2 text-xs'>{error}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div
        className={`grid gap-3 ${hasAudienceStats ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}
      >
        {statCards.map((card, index) => (
          <StatCard key={`stat-${index}`} card={card} isLoading={isLoading} />
        ))}
      </div>
    );
  }
);

BonusStatsCards.displayName = 'BonusStatsCards';

/**
 * Компонент отдельной карточки статистики
 */
interface StatCardProps {
  card: StatCard;
  isLoading: boolean;
}

const StatCard = memo<StatCardProps>(({ card, isLoading }) => {
  const Icon = card.icon;

  const getCardClassName = (variant: StatCard['variant']) => {
    const baseClasses = 'relative overflow-hidden shadow-sm';

    switch (variant) {
      case 'success':
        return `${baseClasses} border-green-200/80 bg-green-50/40 dark:bg-green-950/20`;
      case 'warning':
        return `${baseClasses} border-yellow-200/80 bg-yellow-50/40 dark:bg-yellow-950/20`;
      case 'destructive':
        return `${baseClasses} border-red-200/80 bg-red-50/40 dark:bg-red-950/20`;
      default:
        return baseClasses;
    }
  };

  const getIconClassName = (variant: StatCard['variant']) => {
    const baseClasses = 'h-3.5 w-3.5 shrink-0';

    switch (variant) {
      case 'success':
        return `${baseClasses} text-green-600 dark:text-green-400`;
      case 'warning':
        return `${baseClasses} text-yellow-600 dark:text-yellow-400`;
      case 'destructive':
        return `${baseClasses} text-red-600 dark:text-red-400`;
      default:
        return `${baseClasses} text-muted-foreground`;
    }
  };

  if (isLoading) {
    return (
      <Card className='relative overflow-hidden'>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 p-3 pb-1'>
          <div className='bg-muted h-3 w-20 animate-pulse rounded' />
          <div className='bg-muted h-3.5 w-3.5 animate-pulse rounded' />
        </CardHeader>
        <CardContent className='p-3 pt-1'>
          <div className='bg-muted mb-1 h-6 w-16 animate-pulse rounded' />
          <div className='bg-muted h-2.5 w-24 animate-pulse rounded' />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getCardClassName(card.variant)}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 p-3.5 pb-1'>
        <CardTitle className='text-muted-foreground truncate pr-1 text-xs font-medium'>
          {card.title}
        </CardTitle>
        <Icon className={getIconClassName(card.variant)} />
      </CardHeader>
      <CardContent className='p-3.5 pt-0'>
        <div className='flex items-baseline justify-between gap-1'>
          <div className='text-lg leading-tight font-bold tracking-tight'>
            {card.value}
          </div>
          {card.badge && (
            <Badge
              variant={card.badge.variant}
              className='shrink-0 px-1.5 py-0 text-[10px] font-normal'
            >
              {card.badge.text}
            </Badge>
          )}
        </div>
        {card.subtitle && (
          <p className='text-muted-foreground mt-0.5 truncate text-[11px] leading-tight'>
            {card.subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

export default BonusStatsCards;
