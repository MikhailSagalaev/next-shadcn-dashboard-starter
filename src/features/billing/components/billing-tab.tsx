/**
 * @file: src/features/billing/components/billing-tab.tsx
 * @description: Компонент таба "Биллинг" для объединенной страницы настроек
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  TrendingUp,
  Users,
  Bot,
  Calendar,
  Download,
  CheckCircle,
  Crown,
  Zap,
  Star
} from 'lucide-react';
import { toast } from 'sonner';

type PlanLimits = {
  projects: number;
  users: number;
  bots: number;
  notifications: number;
};

type BillingPlan = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: PlanLimits;
  popular?: boolean;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nextPaymentDate?: string | null;
};

type UsageMetric = { used: number; limit: number };

type UsageStats = {
  projects: UsageMetric;
  users: UsageMetric;
  bots: UsageMetric;
  notifications: UsageMetric;
};

type PaymentHistoryEntry = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

const renderLimit = (limit: number) => (limit === -1 ? '∞' : limit);

const getUsagePercentage = (used: number, limit: number) => {
  if (limit === -1 || limit === 0) return 0;
  return Math.min((used / limit) * 100, 100);
};

export function BillingTab() {
  const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
  const [planCatalog, setPlanCatalog] = useState<BillingPlan[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/billing');
      if (!response.ok) {
        toast.error('Ошибка загрузки данных биллинга');
        return;
      }
      const data = await response.json();
      setCurrentPlan(data.currentPlan);
      setUsageStats(data.usageStats);
      setPaymentHistory(data.paymentHistory || []);
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Ошибка загрузки данных биллинга');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlanCatalog = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/billing/plans?isActive=true&isPublic=true'
      );
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setPlanCatalog(data.plans || []);
    } catch (error) {
      console.error('Error loading plan catalog:', error);
    }
  }, []);

  useEffect(() => {
    loadBillingData();
    loadPlanCatalog();
  }, [loadBillingData, loadPlanCatalog]);

  const handleUpgradePlan = async (plan: BillingPlan) => {
    if (plan.slug === currentPlan?.slug) {
      toast.info('Этот тариф уже активен');
      return;
    }

    try {
      setChangingPlanId(plan.id);
      const response = await fetch('/api/billing/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Ошибка обновления тарифного плана');
        return;
      }

      const data = await response.json();
      setCurrentPlan(data.plan);
      toast.success(data.message);
      await loadBillingData();
    } catch (error) {
      console.error('Error upgrading plan:', error);
      toast.error('Ошибка обновления тарифного плана');
    } finally {
      setChangingPlanId(null);
    }
  };

  if (loading || !currentPlan || !usageStats) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <div className='border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Загрузка данных биллинга...</p>
        </div>
      </div>
    );
  }

  const plansToRender = planCatalog.length ? planCatalog : [currentPlan];

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Crown className='h-5 w-5' />
            Текущий тарифный план
          </CardTitle>
          <CardDescription>
            {currentPlan.startDate
              ? `Активирован: ${formatDate(currentPlan.startDate)}`
              : 'Активная подписка'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h3 className='text-2xl font-bold'>{currentPlan.name}</h3>
              <p className='text-muted-foreground'>
                {currentPlan.price === 0
                  ? 'Бесплатно'
                  : `${formatCurrency(currentPlan.price, currentPlan.currency)}/${currentPlan.interval === 'month' ? 'месяц' : 'год'}`}
              </p>
            </div>
            <Badge variant={currentPlan.popular ? 'default' : 'secondary'}>
              {currentPlan.status === 'trial'
                ? 'Пробный период'
                : currentPlan.popular
                  ? 'Популярный'
                  : 'Активный'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Использование ресурсов
          </CardTitle>
          <CardDescription>
            Текущее потребление лимитов в рамках подписки
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            {[
              {
                label: 'Проекты',
                icon: Users,
                metric: usageStats.projects
              },
              {
                label: 'Пользователи',
                icon: Users,
                metric: usageStats.users
              },
              {
                label: 'Telegram боты',
                icon: Bot,
                metric: usageStats.bots
              },
              {
                label: 'Уведомления',
                icon: Zap,
                metric: usageStats.notifications
              }
            ].map(({ label, icon: Icon, metric }) => (
              <div key={label} className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Icon className='h-4 w-4' />
                    <span className='text-sm font-medium'>{label}</span>
                  </div>
                  <span className='text-muted-foreground text-sm'>
                    {metric.used} / {renderLimit(metric.limit)}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(metric.used, metric.limit)}
                  className='h-2'
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue='plans' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='plans'>
            <Star className='mr-2 h-4 w-4' />
            Тарифные планы
          </TabsTrigger>
          <TabsTrigger value='history'>
            <Calendar className='mr-2 h-4 w-4' />
            История платежей
          </TabsTrigger>
        </TabsList>

        <TabsContent value='plans'>
          <div className='grid gap-6 md:grid-cols-3'>
            {plansToRender.map((plan) => (
              <Card
                key={plan.id}
                className={`relative border-2 ${plan.popular ? 'border-primary' : 'border-border'}`}
              >
                {plan.popular && (
                  <Badge className='bg-primary text-primary-foreground absolute top-4 right-4 flex items-center gap-1'>
                    <Star className='h-3 w-3' />
                    Популярный
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <div className='text-2xl font-bold'>
                      {plan.price === 0
                        ? 'Бесплатно'
                        : formatCurrency(plan.price, plan.currency)}
                    </div>
                    {plan.price > 0 && (
                      <p className='text-muted-foreground text-sm'>
                        за {plan.interval === 'month' ? 'месяц' : 'год'}
                      </p>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {plan.description && (
                    <>
                      <p className='text-muted-foreground text-sm'>
                        {plan.description}
                      </p>
                      <Separator />
                    </>
                  )}
                  <ul className='text-muted-foreground space-y-2 text-sm'>
                    {plan.features.map((feature) => (
                      <li key={feature} className='flex items-center gap-2'>
                        <CheckCircle className='h-4 w-4 text-green-500' />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  <ul className='text-muted-foreground space-y-2 text-sm'>
                    <li className='flex items-center justify-between'>
                      <span>Проекты</span>
                      <span>{renderLimit(plan.limits.projects)}</span>
                    </li>
                    <li className='flex items-center justify-between'>
                      <span>Пользователи</span>
                      <span>{renderLimit(plan.limits.users)}</span>
                    </li>
                    <li className='flex items-center justify-between'>
                      <span>Telegram боты</span>
                      <span>{renderLimit(plan.limits.bots)}</span>
                    </li>
                    <li className='flex items-center justify-between'>
                      <span>Уведомления</span>
                      <span>{renderLimit(plan.limits.notifications)}</span>
                    </li>
                  </ul>
                  <Button
                    className='mt-2 w-full'
                    variant={
                      plan.slug === currentPlan.slug ? 'outline' : 'default'
                    }
                    disabled={
                      plan.slug === currentPlan.slug ||
                      changingPlanId === plan.id
                    }
                    onClick={() => handleUpgradePlan(plan)}
                  >
                    {changingPlanId === plan.id
                      ? 'Обновление...'
                      : plan.slug === currentPlan.slug
                        ? 'Текущий план'
                        : 'Выбрать план'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value='history'>
          <Card>
            <CardHeader>
              <CardTitle>История платежей</CardTitle>
              <CardDescription>Последние операции по подписке</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentHistory.length === 0 ? (
                <div className='py-8 text-center'>
                  <CreditCard className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
                  <p className='text-muted-foreground'>
                    История платежей пока пуста
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className='flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between'
                    >
                      <div className='space-y-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>
                            {payment.description}
                          </span>
                          <Badge
                            variant={
                              payment.status === 'paid'
                                ? 'default'
                                : payment.status === 'pending'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {payment.status === 'paid'
                              ? 'Оплачено'
                              : payment.status === 'pending'
                                ? 'В ожидании'
                                : 'Ошибка'}
                          </Badge>
                        </div>
                        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                          <Calendar className='h-3 w-3' />
                          {formatDate(payment.date)}
                        </div>
                      </div>
                      <div className='flex items-center gap-4'>
                        <div className='text-right font-semibold'>
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                        <Button variant='ghost' size='sm' disabled>
                          <Download className='mr-2 h-3 w-3' />
                          Счет недоступен
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
