/**
 * @file: src/features/bot-analytics/components/bot-analytics-dashboard.tsx
 * @description: Дашборд аналитики для потоков бота
 * @project: SaaS Bonus System
 * @dependencies: React, Chart.js, shadcn/ui
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  Globe,
  Zap,
  Target,
  Activity
} from 'lucide-react';

import {
  botAnalytics,
  FlowAnalyticsMetrics,
  AnalyticsTimeRange
} from '@/lib/services/bot-analytics/bot-analytics.service';

interface AnalyticsDashboardProps {
  projectId: string;
  flowId?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
    purple: 'text-purple-600 bg-purple-100'
  };

  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-muted-foreground text-sm font-medium'>{title}</p>
            <p className='text-2xl font-bold'>{value}</p>
            {change !== undefined && (
              <p
                className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {change >= 0 ? '+' : ''}
                {change.toFixed(1)}%
              </p>
            )}
          </div>
          <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
            <Icon className='h-6 w-6' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface ChartProps {
  data: any[];
  title: string;
  type: 'line' | 'bar' | 'pie';
}

const SimpleChart: React.FC<ChartProps> = ({ data, title, type }) => {
  // Простая заглушка для графиков (в реальном проекте использовать Chart.js или Recharts)
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='bg-muted flex h-64 items-center justify-center rounded-lg'>
          <div className='text-center'>
            <BarChart3 className='text-muted-foreground mx-auto mb-2 h-12 w-12' />
            <p className='text-muted-foreground text-sm'>
              График будет отображаться здесь
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>
              Тип: {type} | Данных: {data.length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const BotAnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  projectId,
  flowId
}) => {
  const [metrics, setMetrics] = useState<FlowAnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 дней назад
    end: new Date(),
    granularity: 'day'
  });
  const [selectedFlow, setSelectedFlow] = useState(flowId || 'all');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, [projectId, flowId, timeRange, selectedFlow]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let analyticsData: FlowAnalyticsMetrics;

      if (selectedFlow === 'all') {
        // Аналитика по всему проекту
        const projectAnalytics = await botAnalytics.getProjectAnalytics(
          projectId,
          timeRange
        );
        analyticsData = projectAnalytics.summary;
      } else {
        // Аналитика по конкретному потоку
        analyticsData = await botAnalytics.getFlowAnalytics(
          selectedFlow,
          timeRange
        );
      }

      setMetrics(analyticsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (range: string) => {
    const now = new Date();
    let start: Date;

    switch (range) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    setTimeRange({
      start,
      end: now,
      granularity: range.includes('h') ? 'hour' : 'day'
    });
  };

  const handleExport = async (format: 'json' | 'csv' | 'xlsx') => {
    if (!selectedFlow || selectedFlow === 'all') return;

    try {
      const data = await botAnalytics.exportAnalytics(
        selectedFlow,
        timeRange,
        format
      );

      // Создаем и скачиваем файл
      const blobData = typeof data === 'string' ? data : new Uint8Array(data);
      const blob = new Blob([blobData], {
        type:
          format === 'json'
            ? 'application/json'
            : format === 'csv'
              ? 'text/csv'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${selectedFlow}_${timeRange.start.toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <RefreshCw className='mx-auto mb-4 h-8 w-8 animate-spin' />
          <p>Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertTriangle className='h-4 w-4' />
        <AlertDescription>
          Не удалось загрузить данные аналитики. Попробуйте обновить страницу.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Заголовок и контролы */}
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-3xl font-bold'>Аналитика бота</h1>
          <p className='text-muted-foreground'>
            Метрики выполнения потоков и пользовательской активности
          </p>
        </div>

        <div className='flex gap-2'>
          <Select value='7d' onValueChange={handleTimeRangeChange}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1h'>1 час</SelectItem>
              <SelectItem value='24h'>24 часа</SelectItem>
              <SelectItem value='7d'>7 дней</SelectItem>
              <SelectItem value='30d'>30 дней</SelectItem>
            </SelectContent>
          </Select>

          <Button variant='outline' onClick={loadAnalytics}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Обновить
          </Button>

          {selectedFlow !== 'all' && (
            <Select value='json' onValueChange={handleExport}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='json'>
                  <div className='flex items-center'>
                    <Download className='mr-2 h-4 w-4' />
                    JSON
                  </div>
                </SelectItem>
                <SelectItem value='csv'>
                  <div className='flex items-center'>
                    <Download className='mr-2 h-4 w-4' />
                    CSV
                  </div>
                </SelectItem>
                <SelectItem value='xlsx'>
                  <div className='flex items-center'>
                    <Download className='mr-2 h-4 w-4' />
                    XLSX
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Основные метрики */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='Всего выполнений'
          value={metrics.totalExecutions.toLocaleString()}
          icon={Activity}
          color='blue'
        />
        <MetricCard
          title='Успешность'
          value={`${metrics.successRate.toFixed(1)}%`}
          icon={Target}
          color='green'
        />
        <MetricCard
          title='Среднее время'
          value={`${(metrics.averageDuration / 1000).toFixed(1)}с`}
          icon={Clock}
          color='yellow'
        />
        <MetricCard
          title='Уникальных пользователей'
          value={metrics.uniqueUsers.toLocaleString()}
          icon={Users}
          color='purple'
        />
      </div>

      {/* Вкладки с детальной аналитикой */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='overview'>Обзор</TabsTrigger>
          <TabsTrigger value='performance'>Производительность</TabsTrigger>
          <TabsTrigger value='users'>Пользователи</TabsTrigger>
          <TabsTrigger value='errors'>Ошибки</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          {/* Графики активности */}
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <SimpleChart
              data={metrics.executionsByDay}
              title='Выполнения по дням'
              type='bar'
            />
            <SimpleChart
              data={metrics.executionsByHour}
              title='Выполнения по часам'
              type='line'
            />
          </div>

          {/* География и вовлеченность */}
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Globe className='h-5 w-5' />
                  Топ стран
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics.topCountries.slice(0, 5).map((country, index) => (
                    <div
                      key={country.country}
                      className='flex items-center justify-between'
                    >
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary'>{index + 1}</Badge>
                        <span>{country.country}</span>
                      </div>
                      <div className='text-right'>
                        <div className='font-medium'>{country.count}</div>
                        <div className='text-muted-foreground text-xs'>
                          {country.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Вовлеченность пользователей</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex justify-between'>
                    <span>Уникальные пользователи</span>
                    <span className='font-medium'>{metrics.uniqueUsers}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Возвращающиеся</span>
                    <span className='font-medium'>
                      {metrics.returningUsers}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Уровень удержания</span>
                    <span className='font-medium'>
                      {metrics.userRetentionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Средняя сессия</span>
                    <span className='font-medium'>
                      {(metrics.averageSessionLength / 1000).toFixed(1)}с
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='performance' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Метрики производительности</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex justify-between'>
                    <span>Среднее время выполнения</span>
                    <span className='font-medium'>
                      {(metrics.averageDuration / 1000).toFixed(2)}с
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Медиана времени</span>
                    <span className='font-medium'>
                      {(metrics.medianDuration / 1000).toFixed(2)}с
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>95-й перцентиль</span>
                    <span className='font-medium'>
                      {(metrics.p95Duration / 1000).toFixed(2)}с
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Среднее использование памяти</span>
                    <span className='font-medium'>
                      {(metrics.averageMemoryUsage / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API и внешние запросы</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex justify-between'>
                    <span>Среднее API вызовов</span>
                    <span className='font-medium'>
                      {metrics.averageApiCalls.toFixed(1)}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Среднее внешних запросов</span>
                    <span className='font-medium'>
                      {metrics.averageExternalRequests.toFixed(1)}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Среднее взаимодействий</span>
                    <span className='font-medium'>
                      {metrics.averageUserInteractions.toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <SimpleChart
            data={metrics.nodePerformance}
            title='Производительность нод'
            type='bar'
          />
        </TabsContent>

        <TabsContent value='users' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Топ пользователей</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics.topUsers.slice(0, 10).map((user, index) => (
                    <div
                      key={user.userId}
                      className='flex items-center justify-between'
                    >
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary'>{index + 1}</Badge>
                        <span className='font-mono text-sm'>
                          {user.userId.slice(0, 8)}...
                        </span>
                      </div>
                      <div className='text-right'>
                        <div className='font-medium'>
                          {user.executions} выполнений
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {user.lastExecution.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <SimpleChart
              data={metrics.executionsByWeekday}
              title='Активность по дням недели'
              type='bar'
            />
          </div>
        </TabsContent>

        <TabsContent value='errors' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <AlertTriangle className='h-5 w-5' />
                  Обзор ошибок
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex justify-between'>
                    <span>Всего ошибок</span>
                    <span className='font-medium text-red-600'>
                      {metrics.failedExecutions}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Уровень ошибок</span>
                    <span className='font-medium text-red-600'>
                      {metrics.errorRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Топ ошибок</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics.topErrors.slice(0, 5).map((error, index) => (
                    <div key={index} className='space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-red-600'>{error.count} раз</span>
                        <span className='text-muted-foreground'>
                          {error.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <p className='text-muted-foreground text-xs break-words'>
                        {error.error.length > 100
                          ? error.error.slice(0, 100) + '...'
                          : error.error}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <SimpleChart
            data={metrics.errorTrends}
            title='Тренды ошибок'
            type='line'
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
