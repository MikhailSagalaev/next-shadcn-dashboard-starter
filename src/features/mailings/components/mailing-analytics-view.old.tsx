/**
 * @file: src/features/mailings/components/mailing-analytics-view.tsx
 * @description: Компонент отображения аналитики рассылки
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, recharts
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Mail,
  Eye,
  MousePointerClick,
  XCircle
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import PageContainer from '@/components/layout/page-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

interface MailingAnalyticsViewProps {
  params: Promise<{ id: string; mailingId: string }>;
}

export function MailingAnalyticsView({ params }: MailingAnalyticsViewProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>('');
  const [mailingId, setMailingId] = useState<string>('');
  const [mailing, setMailing] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((resolved) => {
      setProjectId(resolved.id);
      setMailingId(resolved.mailingId);
    });
  }, [params]);

  useEffect(() => {
    if (!projectId || !mailingId) return;

    const loadData = async () => {
      try {
        const [mailingResponse, statsResponse, historyResponse] =
          await Promise.all([
            fetch(`/api/projects/${projectId}/mailings/${mailingId}`),
            fetch(`/api/projects/${projectId}/mailings/${mailingId}/analytics`),
            fetch(
              `/api/projects/${projectId}/mailings/${mailingId}/history?limit=100`
            )
          ]);

        if (mailingResponse.ok) {
          const mailingData = await mailingResponse.json();
          setMailing(mailingData);
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setHistory(historyData.history || []);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, mailingId]);

  if (loading) {
    return (
      <PageContainer>
        <div className='text-muted-foreground py-8 text-center'>
          Загрузка...
        </div>
      </PageContainer>
    );
  }

  if (!mailing) {
    return (
      <PageContainer>
        <div className='text-destructive py-8 text-center'>
          Рассылка не найдена
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className='space-y-6'>
        {/* Заголовок */}
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/mailings`)
            }
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Назад
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {mailing.name}
            </h1>
            <p className='text-muted-foreground mt-1'>
              Аналитика и статистика рассылки
            </p>
          </div>
        </div>

        {/* Основные метрики */}
        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Отправлено</CardTitle>
              <Mail className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {stats?.sent || mailing.sentCount || 0}
              </div>
              <p className='text-muted-foreground text-xs'>
                из {stats?.total || 0} получателей
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Открыто</CardTitle>
              <Eye className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {stats?.opened || mailing.openedCount || 0}
              </div>
              <p className='text-muted-foreground text-xs'>
                {stats?.openRate ? `${stats.openRate.toFixed(1)}%` : '0%'}{' '}
                открытий
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Кликов</CardTitle>
              <MousePointerClick className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {stats?.clicked || mailing.clickedCount || 0}
              </div>
              <p className='text-muted-foreground text-xs'>
                {stats?.clickRate ? `${stats.clickRate.toFixed(1)}%` : '0%'}{' '}
                кликов
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
                {stats?.failed || mailing.failedCount || 0}
              </div>
              <p className='text-muted-foreground text-xs'>
                {stats?.total > 0
                  ? `${((stats.failed / stats.total) * 100).toFixed(1)}%`
                  : '0%'}{' '}
                ошибок
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Табы с детальной информацией */}
        <Tabs defaultValue='overview' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='overview'>Обзор</TabsTrigger>
            <TabsTrigger value='charts'>Графики</TabsTrigger>
            <TabsTrigger value='recipients'>Получатели</TabsTrigger>
            <TabsTrigger value='history'>История</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='mt-6 space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Информация о рассылке</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <div className='text-muted-foreground text-sm font-medium'>
                      Тип
                    </div>
                    <div className='mt-1'>
                      <Badge variant='outline'>{mailing.type}</Badge>
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-sm font-medium'>
                      Статус
                    </div>
                    <div className='mt-1'>
                      <Badge>{mailing.status}</Badge>
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-sm font-medium'>
                      Создано
                    </div>
                    <div className='mt-1 text-sm'>
                      {mailing.createdAt
                        ? format(
                            new Date(mailing.createdAt),
                            'dd.MM.yyyy HH:mm',
                            { locale: ru }
                          )
                        : '—'}
                    </div>
                  </div>
                  {mailing.sentAt && (
                    <div>
                      <div className='text-muted-foreground text-sm font-medium'>
                        Отправлено
                      </div>
                      <div className='mt-1 text-sm'>
                        {format(new Date(mailing.sentAt), 'dd.MM.yyyy HH:mm', {
                          locale: ru
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='charts' className='mt-6 space-y-4'>
            {stats?.timeline && stats.timeline.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Динамика событий</CardTitle>
                  <CardDescription>
                    График отправки, открытий и кликов по времени
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width='100%' height={300}>
                    <LineChart data={stats.timeline}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='date' />
                      <YAxis />
                      <ChartTooltip />
                      <Line
                        type='monotone'
                        dataKey='sent'
                        stroke='#8884d8'
                        name='Отправлено'
                      />
                      <Line
                        type='monotone'
                        dataKey='opened'
                        stroke='#82ca9d'
                        name='Открыто'
                      />
                      <Line
                        type='monotone'
                        dataKey='clicked'
                        stroke='#ffc658'
                        name='Кликов'
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className='text-muted-foreground py-8 text-center'>
                  Нет данных для графика
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value='recipients' className='mt-6 space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Получатели</CardTitle>
                <CardDescription>
                  Детальная статистика по получателям
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mailing.recipients && mailing.recipients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Получатель</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Открыто</TableHead>
                        <TableHead>Кликов</TableHead>
                        <TableHead>Отправлено</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mailing.recipients.slice(0, 50).map((recipient: any) => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            {recipient.user?.email ||
                              recipient.email ||
                              recipient.phone ||
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
                              {recipient.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {recipient.openedAt
                              ? format(
                                  new Date(recipient.openedAt),
                                  'dd.MM.yyyy HH:mm',
                                  { locale: ru }
                                )
                              : '—'}
                          </TableCell>
                          <TableCell>{recipient.clickCount || 0}</TableCell>
                          <TableCell>
                            {recipient.sentAt
                              ? format(
                                  new Date(recipient.sentAt),
                                  'dd.MM.yyyy HH:mm',
                                  { locale: ru }
                                )
                              : '—'}
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

          <TabsContent value='history' className='mt-6 space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>История событий</CardTitle>
                <CardDescription>Все события рассылки</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Тип события</TableHead>
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
                          <TableCell>
                            {event.user?.email || event.recipient?.email || '—'}
                          </TableCell>
                          <TableCell>
                            {format(
                              new Date(event.timestamp),
                              'dd.MM.yyyy HH:mm:ss',
                              { locale: ru }
                            )}
                          </TableCell>
                          <TableCell className='text-muted-foreground text-sm'>
                            {event.metadata
                              ? JSON.stringify(event.metadata).substring(
                                  0,
                                  50
                                ) + '...'
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
    </PageContainer>
  );
}
