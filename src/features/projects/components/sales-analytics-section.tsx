/**
 * @file: src/features/projects/components/sales-analytics-section.tsx
 * @description: Компонент расширенной аналитики продаж (воронка, RFM, ABC/XYZ, динамика)
 * @project: SaaS Bonus System
 * @dependencies: React, Recharts, AnalyticsService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TrendingUp, Users, Package, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface SalesAnalyticsSectionProps {
  projectId: string;
}

const chartColors = {
  primary: '#0ea5e9',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6'
};

export function SalesAnalyticsSection({ projectId }: SalesAnalyticsSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [rfm, setRfm] = useState<any>(null);
  const [abcxyz, setAbcxyz] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate,
        endDate
      });

      const [kpiRes, funnelRes, rfmRes, abcxyzRes, trendsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/analytics/kpi?${params}`),
        fetch(`/api/projects/${projectId}/analytics/funnel?${params}`),
        fetch(`/api/projects/${projectId}/analytics/rfm?endDate=${endDate}`),
        fetch(`/api/projects/${projectId}/analytics/abcxyz?${params}`),
        fetch(`/api/projects/${projectId}/analytics/trends?period=${period}&${params}`)
      ]);

      if (kpiRes.ok) {
        const data = await kpiRes.json();
        setKpi(data);
      }
      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setFunnel(data);
      }
      if (rfmRes.ok) {
        const data = await rfmRes.json();
        setRfm(data);
      }
      if (abcxyzRes.ok) {
        const data = await abcxyzRes.json();
        setAbcxyz(data);
      }
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки аналитики продаж:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные аналитики продаж',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, period, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-1/3 rounded bg-gray-200'></div>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='h-32 rounded bg-gray-200'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Данные для воронки
  const funnelData = funnel
    ? [
        {
          name: 'Просмотры',
          value: funnel.views,
          fill: chartColors.primary
        },
        {
          name: 'Корзины',
          value: funnel.carts,
          fill: chartColors.info
        },
        {
          name: 'Оформления',
          value: funnel.checkouts,
          fill: chartColors.warning
        },
        {
          name: 'Покупки',
          value: funnel.purchases,
          fill: chartColors.success
        }
      ]
    : [];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-2xl font-bold tracking-tight'>Аналитика продаж</h3>
          <p className='text-muted-foreground text-sm'>
            Расширенная аналитика продаж, воронка, RFM и ABC/XYZ анализ
          </p>
        </div>
        <div className='flex items-center space-x-2'>
          <input
            type='date'
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className='rounded border px-2 py-1 text-sm'
          />
          <span className='text-muted-foreground'>—</span>
          <input
            type='date'
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className='rounded border px-2 py-1 text-sm'
          />
          <Select value={period} onValueChange={(v: 'day' | 'week' | 'month') => setPeriod(v)}>
            <SelectTrigger className='w-[120px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='day'>День</SelectItem>
              <SelectItem value='week'>Неделя</SelectItem>
              <SelectItem value='month'>Месяц</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* KPI Cards */}
      {kpi && (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Выручка</CardTitle>
              <TrendingUp className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatCurrency(kpi.revenue)}</div>
              <p className='text-muted-foreground text-xs'>
                {kpi.orderCount} заказов
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Средний чек</CardTitle>
              <Package className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {formatCurrency(kpi.averageOrderValue)}
              </div>
              <p className='text-muted-foreground text-xs'>На заказ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Пользователи</CardTitle>
              <Users className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatNumber(kpi.totalUsers)}</div>
              <p className='text-muted-foreground text-xs'>
                Активных: {formatNumber(kpi.activeUsers)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Конверсия</CardTitle>
              <BarChart3 className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{kpi.conversionRate.toFixed(1)}%</div>
              <p className='text-muted-foreground text-xs'>Пользователей с заказами</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue='funnel' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='funnel'>Воронка продаж</TabsTrigger>
          <TabsTrigger value='trends'>Динамика продаж</TabsTrigger>
          <TabsTrigger value='rfm'>RFM-анализ</TabsTrigger>
          <TabsTrigger value='abcxyz'>ABC/XYZ-анализ</TabsTrigger>
        </TabsList>

        {/* Воронка продаж */}
        <TabsContent value='funnel' className='space-y-4'>
          {funnel && (
            <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Воронка продаж</CardTitle>
                  <CardDescription>
                    Конверсия на каждом этапе покупки
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      views: { label: 'Просмотры', color: chartColors.primary },
                      carts: { label: 'Корзины', color: chartColors.info },
                      checkouts: { label: 'Оформления', color: chartColors.warning },
                      purchases: { label: 'Покупки', color: chartColors.success }
                    }}
                    className='h-[400px]'
                  >
                    <ResponsiveContainer width='100%' height='100%'>
                      <BarChart data={funnelData}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='name' />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey='value' fill={chartColors.primary}>
                          {funnelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Конверсии</CardTitle>
                  <CardDescription>
                    Процент конверсии между этапами
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm'>Просмотр → Корзина</span>
                      <span className='font-bold'>
                        {funnel.conversionRates.viewToCart.toFixed(2)}%
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-gray-200'>
                      <div
                        className='h-2 rounded-full bg-blue-500'
                        style={{ width: `${funnel.conversionRates.viewToCart}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm'>Корзина → Оформление</span>
                      <span className='font-bold'>
                        {funnel.conversionRates.cartToCheckout.toFixed(2)}%
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-gray-200'>
                      <div
                        className='h-2 rounded-full bg-purple-500'
                        style={{ width: `${funnel.conversionRates.cartToCheckout}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm'>Оформление → Покупка</span>
                      <span className='font-bold'>
                        {funnel.conversionRates.checkoutToPurchase.toFixed(2)}%
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-gray-200'>
                      <div
                        className='h-2 rounded-full bg-yellow-500'
                        style={{ width: `${funnel.conversionRates.checkoutToPurchase}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm'>Просмотр → Покупка</span>
                      <span className='font-bold'>
                        {funnel.conversionRates.viewToPurchase.toFixed(2)}%
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-gray-200'>
                      <div
                        className='h-2 rounded-full bg-green-500'
                        style={{ width: `${funnel.conversionRates.viewToPurchase}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Динамика продаж */}
        <TabsContent value='trends' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Динамика продаж</CardTitle>
              <CardDescription>
                Выручка и количество заказов по периодам
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  revenue: { label: 'Выручка', color: chartColors.success },
                  orderCount: { label: 'Заказы', color: chartColors.primary },
                  averageOrderValue: { label: 'Средний чек', color: chartColors.warning }
                }}
                className='h-[400px]'
              >
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='period' />
                    <YAxis yAxisId='left' />
                    <YAxis yAxisId='right' orientation='right' />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      yAxisId='left'
                      type='monotone'
                      dataKey='revenue'
                      stroke={chartColors.success}
                      strokeWidth={2}
                      name='Выручка'
                    />
                    <Line
                      yAxisId='right'
                      type='monotone'
                      dataKey='orderCount'
                      stroke={chartColors.primary}
                      strokeWidth={2}
                      name='Заказы'
                    />
                    <Line
                      yAxisId='left'
                      type='monotone'
                      dataKey='averageOrderValue'
                      stroke={chartColors.warning}
                      strokeWidth={2}
                      name='Средний чек'
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RFM-анализ */}
        <TabsContent value='rfm' className='space-y-4'>
          {rfm && rfm.segments && rfm.segments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>RFM-анализ</CardTitle>
                <CardDescription>
                  Сегментация клиентов по Recency, Frequency, Monetary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    users: { label: 'Пользователи', color: chartColors.primary }
                  }}
                  className='h-[400px]'
                >
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={rfm.segments}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='segment' />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey='users' fill={chartColors.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {rfm.segments.map((segment: any) => (
                    <div key={segment.segment} className='rounded-lg border p-4'>
                      <h4 className='font-semibold'>{segment.segment}</h4>
                      <p className='text-muted-foreground text-sm'>
                        Пользователей: {segment.users}
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        Средний Recency: {segment.avgRecency.toFixed(1)} дней
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        Средняя Frequency: {segment.avgFrequency.toFixed(1)}
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        Средний Monetary: {formatCurrency(segment.avgMonetary)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABC/XYZ-анализ */}
        <TabsContent value='abcxyz' className='space-y-4'>
          {abcxyz && abcxyz.products && abcxyz.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>ABC/XYZ-анализ товаров</CardTitle>
                <CardDescription>
                  Анализ товаров по выручке (ABC) и стабильности продаж (XYZ)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                    {abcxyz.products.slice(0, 12).map((product: any) => (
                      <div
                        key={product.productId}
                        className='rounded-lg border p-4'
                      >
                        <h4 className='font-semibold'>{product.productName}</h4>
                        <div className='mt-2 flex items-center space-x-2'>
                          <span
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              product.abcClass === 'A'
                                ? 'bg-green-100 text-green-800'
                                : product.abcClass === 'B'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            ABC: {product.abcClass}
                          </span>
                          <span
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              product.xyzClass === 'X'
                                ? 'bg-blue-100 text-blue-800'
                                : product.xyzClass === 'Y'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            XYZ: {product.xyzClass}
                          </span>
                        </div>
                        <p className='text-muted-foreground mt-2 text-sm'>
                          Выручка: {formatCurrency(product.revenue)}
                        </p>
                        <p className='text-muted-foreground text-sm'>
                          Количество: {product.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

