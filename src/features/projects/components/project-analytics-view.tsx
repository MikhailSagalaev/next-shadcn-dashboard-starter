/**
 * @file: src/features/projects/components/project-analytics-view.tsx
 * @description: Компонент аналитики и статистики проекта
 * @project: SaaS Bonus System
 * @dependencies: React, Framer Motion, Charts, UI components
 * @created: 2024-12-31
 * @updated: 2026-01-21 - Стиль как на главной странице дашборда
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Gift,
  TrendingUp,
  Activity,
  AlertTriangle,
  BarChart3,
  PieChart,
  Award,
  Target,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { Project } from '@/types/bonus';
import type { ProjectAnalytics } from '@/types/analytics';
import { SalesAnalyticsSection } from './sales-analytics-section';

interface ProjectAnalyticsViewProps {
  projectId: string;
}

const chartColors = {
  primary: '#0ea5e9',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
};

export function ProjectAnalyticsView({ projectId }: ProjectAnalyticsViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем проект и аналитику параллельно
      const [projectResponse, analyticsResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/analytics`)
      ]);

      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProject(projectData);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      // TODO: логгер
      console.error('Ошибка загрузки аналитики:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные аналитики',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Форматирование чисел
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Number(num).toFixed(2);
  };

  // Данные для pie chart транзакций
  const transactionPieData =
    analytics?.charts.transactionTypes.map((type, index) => ({
      name: type.type === 'EARN' ? 'Начисления' : 'Списания',
      value: type.count,
      amount: type.amount,
      fill: index === 0 ? chartColors.success : chartColors.danger
    })) || [];

  useEffect(() => {
    loadData();
  }, [projectId]); // Добавляем projectId в зависимости вместо loadData

  if (loading) {
    return (
      <div className='flex flex-1 flex-col space-y-6'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-1/3 rounded bg-gray-200'></div>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='h-32 rounded bg-gray-200'></div>
            ))}
          </div>
          <div className='h-64 rounded bg-gray-200'></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
          <h3 className='mb-2 text-lg font-semibold'>
            Нет данных для аналитики
          </h3>
          <p className='text-muted-foreground'>
            Данные аналитики появятся после активности пользователей
          </p>
        </div>
      </div>
    );
  }

  const { overview } = analytics;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <Heading
            title={`Аналитика: ${project?.name || 'Проект'}`}
            description='Статистика и аналитические данные проекта'
          />
        </div>
      </div>

      <Separator />

      {/* Main Metrics */}
      <motion.div
        variants={container}
        initial='hidden'
        animate='show'
        className='grid gap-4 md:grid-cols-2 lg:grid-cols-6'
      >
        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-blue-500/10 p-2.5 text-blue-500'>
              <Users className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Пользователи
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {overview.totalUsers}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                Активных: {overview.activeUsers}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-purple-500/10 p-2.5 text-purple-500'>
              <Gift className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Всего бонусов
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {formatNumber(Number(overview.totalBonuses))}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                Активных: {formatNumber(Number(overview.activeBonuses))}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-emerald-500/10 p-2.5 text-emerald-500'>
              <Activity className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Транзакции
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {overview.totalTransactions}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                +{overview.transactionsLast7Days} за неделю
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-indigo-500/10 p-2.5 text-indigo-500'>
              <Target className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Уровни
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {analytics.userLevels?.length || 0}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                активных уровней
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-cyan-500/10 p-2.5 text-cyan-500'>
              <UserCheck className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Рефералы
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {analytics.referralStats?.totalReferrals || 0}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {formatNumber(
                  Number(analytics.referralStats?.totalBonusPaid || 0)
                )}{' '}
                выплачено
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className='absolute top-4 right-4 rounded-full bg-amber-500/10 p-2.5 text-amber-500'>
              <AlertTriangle className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                Истекающие
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {formatNumber(Number(overview.expiringBonuses.amount))}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {overview.expiringBonuses.count} бонусов
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Charts Section */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Daily Activity Chart */}
        <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2 text-xl font-semibold'>
              <BarChart3 className='h-5 w-5' />
              <span>Активность по дням</span>
            </CardTitle>
            <CardDescription>
              Количество транзакций за последние 30 дней
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                earned: {
                  label: 'Начисления',
                  color: chartColors.success
                },
                spent: {
                  label: 'Списания',
                  color: chartColors.danger
                }
              }}
              className='h-[300px]'
            >
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={analytics.charts.dailyActivity}>
                  <XAxis
                    dataKey='date'
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('ru-RU', {
                        month: 'short',
                        day: 'numeric'
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString('ru-RU')
                    }
                  />
                  <Area
                    type='monotone'
                    dataKey='earnedTransactions'
                    stackId='1'
                    stroke={chartColors.success}
                    fill={chartColors.success}
                    fillOpacity={0.6}
                    name='Начисления'
                  />
                  <Area
                    type='monotone'
                    dataKey='spentTransactions'
                    stackId='1'
                    stroke={chartColors.danger}
                    fill={chartColors.danger}
                    fillOpacity={0.6}
                    name='Списания'
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* User Levels Distribution Pie Chart */}
        <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2 text-xl font-semibold'>
              <Target className='h-5 w-5' />
              <span>Распределение по уровням</span>
            </CardTitle>
            <CardDescription>
              Количество пользователей на каждом уровне
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                users: {
                  label: 'Пользователи',
                  color: chartColors.primary
                }
              }}
              className='h-[300px]'
            >
              <ResponsiveContainer width='100%' height='100%'>
                <RechartsPieChart>
                  <Pie
                    data={
                      analytics.userLevels?.map((level, index) => ({
                        name: level.level || 'Базовый',
                        value: level.userCount,
                        avgPurchases: level.avgPurchases,
                        fill: [
                          chartColors.primary,
                          chartColors.secondary,
                          chartColors.success,
                          chartColors.warning,
                          chartColors.danger
                        ][index % 5]
                      })) || []
                    }
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey='value'
                  >
                    {(analytics.userLevels || []).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          [
                            chartColors.primary,
                            chartColors.secondary,
                            chartColors.success,
                            chartColors.warning,
                            chartColors.danger
                          ][index % 5]
                        }
                      />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className='bg-background rounded-lg border p-3 shadow-lg'>
                            <div className='font-medium'>{data.name}</div>
                            <div className='text-muted-foreground text-sm'>
                              Пользователей: {data.value}
                            </div>
                            <div className='text-muted-foreground text-sm'>
                              Ср. покупки: {formatNumber(data.avgPurchases)}{' '}
                              руб.
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Transaction Types Pie Chart */}
        <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2 text-xl font-semibold'>
              <PieChart className='h-5 w-5' />
              <span>Распределение транзакций</span>
            </CardTitle>
            <CardDescription>Соотношение начислений и списаний</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                earned: {
                  label: 'Начисления',
                  color: chartColors.success
                },
                spent: {
                  label: 'Списания',
                  color: chartColors.danger
                }
              }}
              className='h-[300px]'
            >
              <ResponsiveContainer width='100%' height='100%'>
                <RechartsPieChart>
                  <Pie
                    data={transactionPieData}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey='value'
                  >
                    {transactionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className='bg-background rounded-lg border p-3 shadow-lg'>
                            <div className='font-medium'>{data.name}</div>
                            <div className='text-muted-foreground text-sm'>
                              Количество: {data.value}
                            </div>
                            <div className='text-muted-foreground text-sm'>
                              Сумма: {formatNumber(data.amount)} бонусов
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Referral Stats Card */}
        <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2 text-xl font-semibold'>
              <UserCheck className='h-5 w-5' />
              <span>Реферальная программа</span>
            </CardTitle>
            <CardDescription>Статистика приглашений и бонусов</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {analytics.referralStats ? (
              <>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='rounded-lg border p-3 text-center'>
                    <div className='text-2xl font-bold text-blue-600'>
                      {analytics.referralStats.totalReferrals}
                    </div>
                    <div className='text-muted-foreground text-sm'>
                      Всего приглашений
                    </div>
                  </div>
                  <div className='rounded-lg border p-3 text-center'>
                    <div className='text-2xl font-bold text-green-600'>
                      {analytics.referralStats.activeReferrers}
                    </div>
                    <div className='text-muted-foreground text-sm'>
                      Активных рефереров
                    </div>
                  </div>
                </div>
                <div className='bg-muted/50 rounded-lg border p-3 text-center'>
                  <div className='text-lg font-semibold'>
                    {formatNumber(analytics.referralStats.totalBonusPaid)}{' '}
                    бонусов
                  </div>
                  <div className='text-muted-foreground text-sm'>
                    Выплачено реферальных бонусов
                  </div>
                </div>
                {analytics.referralStats.topReferrers &&
                  analytics.referralStats.topReferrers.length > 0 && (
                    <div className='space-y-2'>
                      <h4 className='text-sm font-medium'>Топ рефереры:</h4>
                      {analytics.referralStats.topReferrers
                        .slice(0, 3)
                        .map((referrer, index) => (
                          <div
                            key={referrer.id}
                            className='flex items-center justify-between text-sm'
                          >
                            <span>
                              {referrer.firstName || referrer.lastName
                                ? `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim()
                                : referrer.email ||
                                  referrer.phone ||
                                  'Без имени'}
                            </span>
                            <Badge variant='outline'>
                              {referrer.referralCount} приглашений
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}
              </>
            ) : (
              <div className='text-muted-foreground py-8 text-center'>
                Реферальная программа не активна
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Users Table */}
      <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2 text-xl font-semibold'>
            <Award className='h-5 w-5' />
            <span>Топ активных пользователей</span>
          </CardTitle>
          <CardDescription>
            Самые активные пользователи за последние 30 дней
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {analytics.topUsers.length === 0 ? (
              <div className='text-muted-foreground py-8 text-center'>
                Пока нет активных пользователей
              </div>
            ) : (
              analytics.topUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className='group cursor-pointer rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
                >
                  <div className='flex items-center space-x-3'>
                    <div className='flex-shrink-0'>
                      <div className='flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500'>
                        <span className='font-semibold'>#{index + 1}</span>
                      </div>
                    </div>
                    <div>
                      <div className='font-medium text-zinc-900 dark:text-zinc-100'>
                        {user.name}
                      </div>
                      <div className='text-sm text-zinc-500 dark:text-zinc-400'>
                        {user.contact}
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='flex items-center space-x-4 text-sm'>
                      <div>
                        <div className='font-medium text-zinc-900 dark:text-zinc-100'>
                          {user.transactionCount}
                        </div>
                        <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                          транзакций
                        </div>
                      </div>
                      <div>
                        <div className='font-medium text-emerald-600'>
                          +{formatNumber(user.totalEarned)}
                        </div>
                        <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                          начислено
                        </div>
                      </div>
                      <div>
                        <div className='font-medium text-red-600'>
                          -{formatNumber(user.totalSpent)}
                        </div>
                        <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                          потрачено
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Analytics Section */}
      <Separator />
      <SalesAnalyticsSection projectId={projectId} />
    </div>
  );
}
