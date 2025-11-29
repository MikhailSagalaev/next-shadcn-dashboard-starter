/**
 * @file: src/features/mailings/components/mailing-analytics-view-new.tsx
 * @description: Полностью переработанная страница аналитики рассылки
 * @project: SaaS Bonus System
 * @created: 2025-01-31
 * @author: AI Assistant
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Eye,
  MousePointerClick,
  XCircle,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Download,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface MailingAnalyticsViewProps {
  params: Promise<{ id: string; mailingId: string }>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export function MailingAnalyticsViewNew({ params }: MailingAnalyticsViewProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [mailingId, setMailingId] = useState('');
  const [mailing, setMailing] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    params.then((resolved) => {
      setProjectId(resolved.id);
      setMailingId(resolved.mailingId);
    });
  }, [params]);

  useEffect(() => {
    if (projectId && mailingId) {
      loadData();
    }
  }, [projectId, mailingId]);

  const loadData = async () => {
    try {
      const [mailingRes, statsRes, historyRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/mailings/${mailingId}`),
        fetch(`/api/projects/${projectId}/mailings/${mailingId}/analytics`),
        fetch(
          `/api/projects/${projectId}/mailings/${mailingId}/history?limit=100`
        )
      ]);

      if (mailingRes.ok) {
        const mailingData = await mailingRes.json();
        setMailing(mailingData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className='flex h-[600px] items-center justify-center'>
        <div className='text-center'>
          <RefreshCw className='text-muted-foreground mx-auto mb-4 h-8 w-8 animate-spin' />
          <p className='text-muted-foreground'>Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  if (!mailing) {
    return (
      <div className='flex h-[600px] items-center justify-center'>
        <div className='text-center'>
          <XCircle className='text-destructive mx-auto mb-4 h-16 w-16' />
          <h3 className='mb-2 text-lg font-semibold'>Рассылка не найдена</h3>
          <Button
            variant='outline'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/mailings`)
            }
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Вернуться к списку
          </Button>
        </div>
      </div>
    );
  }

  const total = stats?.total || 0;
  const sent = stats?.sent || mailing.sentCount || 0;
  const opened = stats?.opened || mailing.openedCount || 0;
  const clicked = stats?.clicked || mailing.clickedCount || 0;
  const failed = stats?.failed || mailing.failedCount || 0;

  const openRate = total > 0 ? (opened / total) * 100 : 0;
  const clickRate = total > 0 ? (clicked / total) * 100 : 0;
  const failRate = total > 0 ? (failed / total) * 100 : 0;
  const successRate = total > 0 ? (sent / total) * 100 : 0;

  // Данные для круговой диаграммы
  const pieData = [
    { name: 'Отправлено', value: sent, color: COLORS[0] },
    { name: 'Открыто', value: opened, color: COLORS[1] },
    { name: 'Кликов', value: clicked, color: COLORS[2] },
    { name: 'Ошибок', value: failed, color: COLORS[3] }
  ].filter((item) => item.value > 0);

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/mailings`)
            }
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {mailing.name}
            </h1>
            <p className='text-muted-foreground mt-1'>
              Детальная аналитика рассылки
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Обновить
          </Button>
          <Button variant='outline' size='sm'>
            <Download className='mr-2 h-4 w-4' />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Основные метрики */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Отправлено</CardTitle>
            <Send className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{sent.toLocaleString()}</div>
            <div className='mt-2'>
              <Progress value={successRate} className='h-2' />
            </div>
            <p className='text-muted-foreground mt-2 text-xs'>
              {successRate.toFixed(1)}% из {total.toLocaleString()} получателей
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Открыто</CardTitle>
            <Eye className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{opened.toLocaleString()}</div>
            <div className='mt-2'>
              <Progress value={openRate} className='h-2' />
            </div>
            <p className='text-muted-foreground mt-2 flex items-center gap-1 text-xs'>
              {openRate > 0 ? (
                <TrendingUp className='h-3 w-3 text-green-500' />
              ) : (
                <TrendingDown className='h-3 w-3 text-red-500' />
              )}
              {openRate.toFixed(1)}% открытий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Кликов</CardTitle>
            <MousePointerClick className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{clicked.toLocaleString()}</div>
            <div className='mt-2'>
              <Progress value={clickRate} className='h-2' />
            </div>
            <p className='text-muted-foreground mt-2 flex items-center gap-1 text-xs'>
              {clickRate > 0 ? (
                <TrendingUp className='h-3 w-3 text-green-500' />
              ) : (
                <TrendingDown className='h-3 w-3 text-red-500' />
              )}
              {clickRate.toFixed(1)}% кликов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Ошибок</CardTitle>
            <XCircle className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-destructive text-2xl font-bold'>
              {failed.toLocaleString()}
            </div>
            <div className='mt-2'>
              <Progress value={failRate} className='h-2 bg-red-100' />
            </div>
            <p className='text-muted-foreground mt-2 text-xs'>
              {failRate.toFixed(1)}% ошибок
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Информация о рассылке */}
      <Card>
        <CardHeader>
          <CardTitle>Информация о рассылке</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-3'>
            <div className='flex items-center gap-3'>
              <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-lg'>
                <Calendar className='h-5 w-5' />
              </div>
              <div>
                <p className='text-muted-foreground text-sm'>Создано</p>
                <p className='font-medium'>
                  {mailing.createdAt
                    ? format(
                        new Date(mailing.createdAt),
                        'dd MMM yyyy, HH:mm',
                        {
                          locale: ru
                        }
                      )
                    : '—'}
                </p>
              </div>
            </div>

            {mailing.sentAt && (
              <div className='flex items-center gap-3'>
                <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-lg'>
                  <Clock className='h-5 w-5' />
                </div>
                <div>
                  <p className='text-muted-foreground text-sm'>Отправлено</p>
                  <p className='font-medium'>
                    {format(new Date(mailing.sentAt), 'dd MMM yyyy, HH:mm', {
                      locale: ru
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className='flex items-center gap-3'>
              <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-lg'>
                <Users className='h-5 w-5' />
              </div>
              <div>
                <p className='text-muted-foreground text-sm'>Получателей</p>
                <p className='font-medium'>{total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Табы с детальной информацией */}
      <Tabs defaultValue='overview' className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='overview'>Обзор</TabsTrigger>
          <TabsTrigger value='recipients'>
            Получатели ({mailing.recipients?.length || 0})
          </TabsTrigger>
          <TabsTrigger value='history'>История ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-6 space-y-6'>
          <div className='grid gap-6 md:grid-cols-2'>
            {/* Круговая диаграмма */}
            <Card>
              <CardHeader>
                <CardTitle>Распределение</CardTitle>
                <CardDescription>Визуализация основных метрик</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill='#8884d8'
                      dataKey='value'
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Ключевые показатели */}
            <Card>
              <CardHeader>
                <CardTitle>Ключевые показатели</CardTitle>
                <CardDescription>Эффективность рассылки</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Доставляемость</span>
                  <span className='text-2xl font-bold'>
                    {successRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={successRate} className='h-2' />

                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Open Rate</span>
                  <span className='text-2xl font-bold'>
                    {openRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={openRate} className='h-2' />

                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Click Rate</span>
                  <span className='text-2xl font-bold'>
                    {clickRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={clickRate} className='h-2' />

                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Error Rate</span>
                  <span className='text-destructive text-2xl font-bold'>
                    {failRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={failRate} className='h-2 bg-red-100' />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='recipients' className='mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Получатели</CardTitle>
              <CardDescription>
                Детальная статистика по каждому получателю
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mailing.recipients && mailing.recipients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Получатель</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Отправлено</TableHead>
                      <TableHead>Открыто</TableHead>
                      <TableHead>Кликов</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mailing.recipients.slice(0, 50).map((recipient: any) => (
                      <TableRow key={recipient.id}>
                        <TableCell className='font-medium'>
                          {recipient.user?.email ||
                            recipient.email ||
                            recipient.phone ||
                            recipient.telegramId ||
                            '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              recipient.status === 'SENT'
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            {recipient.status === 'SENT' ? (
                              <CheckCircle2 className='mr-1 h-3 w-3' />
                            ) : (
                              <XCircle className='mr-1 h-3 w-3' />
                            )}
                            {recipient.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {recipient.sentAt
                            ? format(
                                new Date(recipient.sentAt),
                                'dd.MM.yyyy HH:mm',
                                { locale: ru }
                              )
                            : '—'}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {recipient.openedAt
                            ? format(
                                new Date(recipient.openedAt),
                                'dd.MM.yyyy HH:mm',
                                { locale: ru }
                              )
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>
                            {recipient.clickCount || 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className='text-muted-foreground py-8 text-center'>
                  Нет получателей
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='history' className='mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>История событий</CardTitle>
              <CardDescription>
                Все события рассылки в хронологическом порядке
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Событие</TableHead>
                      <TableHead>Получатель</TableHead>
                      <TableHead>Время</TableHead>
                      <TableHead>Детали</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge>{event.type}</Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {event.user?.email || event.recipient?.email || '—'}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {format(
                            new Date(event.timestamp),
                            'dd.MM.yyyy HH:mm:ss',
                            { locale: ru }
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {event.metadata
                            ? JSON.stringify(event.metadata).substring(0, 50) +
                              '...'
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className='text-muted-foreground py-8 text-center'>
                  Нет событий в истории
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
