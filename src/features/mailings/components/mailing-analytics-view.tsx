/**
 * @file: src/features/mailings/components/mailing-analytics-view.tsx
 * @description: Достоверная аналитика отправки и переходов Telegram/MAX без фиктивного Open Rate
 * @project: SaaS Bonus System
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Send,
  XCircle,
  RefreshCw,
  CheckCircle2,
  Trash2,
  MousePointerClick,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';

interface MailingAnalyticsViewProps {
  params: Promise<{ id: string; mailingId: string }>;
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280'];

export function MailingAnalyticsView({ params }: MailingAnalyticsViewProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [mailingId, setMailingId] = useState('');
  const [mailing, setMailing] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Состояние таблицы получателей
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientsTotalPages, setRecipientsTotalPages] = useState(1);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('all');
  const [recipientSearch, setRecipientSearch] = useState('');

  useEffect(() => {
    params.then((resolved) => {
      setProjectId(resolved.id);
      setMailingId(resolved.mailingId);
    });
  }, [params]);

  const loadData = useCallback(async () => {
    if (!projectId || !mailingId) return;

    try {
      const [mailingRes, statsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/mailings/${mailingId}`),
        fetch(`/api/projects/${projectId}/mailings/${mailingId}/analytics`)
      ]);

      if (mailingRes.ok) {
        const mailingData = await mailingRes.json();
        setMailing(mailingData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      toast.error('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, mailingId]);

  const loadRecipients = useCallback(async () => {
    if (!projectId || !mailingId) return;

    setRecipientsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: recipientsPage.toString(),
        limit: '25',
        status: recipientStatusFilter,
        search: recipientSearch
      });

      const res = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}/recipients?${queryParams}`
      );
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
        setRecipientsTotalPages(data.pagination?.totalPages || 1);
        setRecipientsTotal(data.pagination?.total || 0);
      }
    } catch {
      toast.error('Ошибка загрузки получателей');
    } finally {
      setRecipientsLoading(false);
    }
  }, [
    projectId,
    mailingId,
    recipientsPage,
    recipientStatusFilter,
    recipientSearch
  ]);

  useEffect(() => {
    if (projectId && mailingId) {
      loadData();
    }
  }, [projectId, mailingId, loadData]);

  useEffect(() => {
    if (projectId && mailingId) {
      loadRecipients();
    }
  }, [projectId, mailingId, loadRecipients]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    loadRecipients();
  };

  const handleCleanUnavailable = async () => {
    if (
      !confirm(
        'Отвязать Telegram у контактов, которые заблокировали бота или удалили аккаунт? Это очистит базу от неактивных профилей.'
      )
    ) {
      return;
    }

    setCleaning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}/clean-unavailable`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Очищено недействительных контактов: ${data.cleanedCount}`
        );
        loadData();
        loadRecipients();
      } else {
        toast.error(data.error || 'Ошибка очистки контактов');
      }
    } catch {
      toast.error('Не удалось выполнить очистку контактов');
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className='flex h-[450px] items-center justify-center'>
        <div className='text-center'>
          <RefreshCw className='text-muted-foreground mx-auto mb-3 h-8 w-8 animate-spin' />
          <p className='text-muted-foreground text-sm'>Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  if (!mailing) {
    return (
      <div className='flex h-[450px] items-center justify-center'>
        <div className='text-center'>
          <XCircle className='text-destructive mx-auto mb-4 h-14 w-14' />
          <h3 className='mb-2 text-lg font-semibold'>Рассылка не найдена</h3>
          <p className='text-muted-foreground mb-4 text-sm'>
            Возможно, рассылка была удалена или у вас нет к ней доступа
          </p>
          <Button
            variant='outline'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/mailings`)
            }
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Вернуться к списку рассылок
          </Button>
        </div>
      </div>
    );
  }

  const total =
    stats?.total || mailing.recipientCount || mailing._count?.recipients || 0;
  const sent = stats?.sent || mailing.sentCount || 0;
  const failed = stats?.failed || mailing.failedCount || 0;
  const pending = stats?.pending || 0;
  const clicked = stats?.clicked || mailing.clickedCount || 0;

  const successRate = total > 0 ? (sent / total) * 100 : 0;
  const failRate = total > 0 ? (failed / total) * 100 : 0;
  const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

  const errorsBreakdown = stats?.errorsBreakdown || {};
  const linksAnalytics =
    stats?.linksAnalytics || mailing.statistics?.linksAnalytics || [];
  const totalClicks = linksAnalytics.reduce(
    (sum: number, linkItem: any) => sum + Number(linkItem.totalClicks || 0),
    0
  );

  const pieData = [
    { name: 'Отправлено', value: sent, color: PIE_COLORS[0] },
    { name: 'Ошибок', value: failed, color: PIE_COLORS[1] },
    ...(pending > 0
      ? [{ name: 'В процессе', value: pending, color: PIE_COLORS[2] }]
      : [])
  ].filter((item) => item.value > 0);

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
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
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {mailing.name}
              </h1>
              <Badge variant='outline' className='text-xs font-normal'>
                {mailing.type === 'TELEGRAM' ? 'Telegram' : mailing.type}
              </Badge>
              <Badge
                variant={
                  mailing.status === 'COMPLETED'
                    ? 'default'
                    : mailing.status === 'SENDING'
                      ? 'secondary'
                      : 'outline'
                }
                className='text-xs font-normal'
              >
                {mailing.status === 'COMPLETED'
                  ? 'Завершена'
                  : mailing.status === 'SENDING'
                    ? 'Отправляется'
                    : mailing.status === 'FAILED'
                      ? 'Ошибка'
                      : 'Черновик'}
              </Badge>
            </div>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              Проверяемые статусы отправки, ошибки и переходы по ссылкам
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {failed > 0 && mailing.type === 'TELEGRAM' && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleCleanUnavailable}
              disabled={cleaning}
              className='text-destructive hover:bg-destructive/10'
            >
              <Trash2 className='mr-1.5 h-3.5 w-3.5' />
              {cleaning ? 'Очистка…' : 'Очистить недействительные контакты'}
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            Обновить
          </Button>
        </div>
      </div>

      {/* Карточки ключевых показателей */}
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {/* Карточка 1: отправлено */}
        <Card className='border-green-200/80 bg-green-50/30 p-4 shadow-sm dark:bg-green-950/20'>
          <div className='flex items-center justify-between pb-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              Принято каналом
            </span>
            <Send className='h-4 w-4 text-green-600 dark:text-green-400' />
          </div>
          <div className='flex items-baseline justify-between'>
            <div className='text-2xl font-bold tracking-tight text-green-600 dark:text-green-400'>
              {sent.toLocaleString('ru-RU')}
            </div>
            <Badge variant='default' className='text-[10px] font-normal'>
              {successRate.toFixed(1)}%
            </Badge>
          </div>
          <div className='mt-2'>
            <Progress value={successRate} className='h-1.5' />
          </div>
          <p className='text-muted-foreground mt-1 text-[11px]'>
            из {total.toLocaleString('ru-RU')} контактов
          </p>
        </Card>

        {/* Карточка 2: уникальные переходы */}
        <Card className='border-blue-200/80 bg-blue-50/30 p-4 shadow-sm dark:bg-blue-950/20'>
          <div className='flex items-center justify-between pb-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              Перешли по ссылке
            </span>
            <MousePointerClick className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          </div>
          <div className='flex items-baseline justify-between'>
            <div className='text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400'>
              {clicked.toLocaleString('ru-RU')}
            </div>
            <Badge variant='secondary' className='text-[10px] font-normal'>
              CTR: {clickRate.toFixed(1)}%
            </Badge>
          </div>
          <div className='mt-2'>
            <Progress
              value={clickRate}
              className='h-1.5 bg-blue-100 dark:bg-blue-950'
            />
          </div>
          <p className='text-muted-foreground mt-1 text-[11px]'>
            уникальных получателей
          </p>
        </Card>

        {/* Карточка 3: все клики */}
        <Card className='border-purple-200/80 bg-purple-50/30 p-4 shadow-sm dark:bg-purple-950/20'>
          <div className='flex items-center justify-between pb-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              Всего кликов
            </span>
            <TrendingUp className='h-4 w-4 text-purple-600 dark:text-purple-400' />
          </div>
          <div className='flex items-baseline justify-between'>
            <div className='text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400'>
              {totalClicks.toLocaleString('ru-RU')}
            </div>
            <Badge
              variant='outline'
              className='border-purple-300 text-[10px] font-normal text-purple-700 dark:text-purple-300'
            >
              включая повторные
            </Badge>
          </div>
          <div className='mt-2'>
            <Progress
              value={clickRate}
              className='h-1.5 bg-purple-100 dark:bg-purple-950'
            />
          </div>
          <p className='text-muted-foreground mt-1 text-[11px]'>
            по всем отслеживаемым ссылкам
          </p>
        </Card>

        {/* Карточка 4: ошибки отправки */}
        <Card className='border-red-200/80 bg-red-50/30 p-4 shadow-sm dark:bg-red-950/20'>
          <div className='flex items-center justify-between pb-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              Ошибок отправки
            </span>
            <XCircle className='h-4 w-4 text-red-600 dark:text-red-400' />
          </div>
          <div className='flex items-baseline justify-between'>
            <div className='text-2xl font-bold tracking-tight text-red-600 dark:text-red-400'>
              {failed.toLocaleString('ru-RU')}
            </div>
            <Badge variant='destructive' className='text-[10px] font-normal'>
              {failRate.toFixed(1)}%
            </Badge>
          </div>
          <div className='mt-2'>
            <Progress
              value={failRate}
              className='h-1.5 bg-red-100 dark:bg-red-900/30'
            />
          </div>
          <p className='text-muted-foreground mt-1 text-[11px]'>
            постоянные и исчерпанные временные ошибки
          </p>
        </Card>
      </div>

      <div className='bg-muted/40 rounded-lg border p-3 text-xs'>
        <p className='font-medium'>Ограничение каналов</p>
        <p className='text-muted-foreground mt-1'>
          Telegram и MAX не передают боту персональный факт открытия или
          прочтения сообщения. Поэтому экран не рисует фиктивный Open Rate:
          подтверждёнными считаются отправка через API и действия по
          отслеживаемым ссылкам.
        </p>
      </div>

      {/* Вкладки аналитики */}
      <Tabs defaultValue='overview' className='w-full'>
        <TabsList className='grid w-full max-w-[560px] grid-cols-4'>
          <TabsTrigger value='overview'>Обзор</TabsTrigger>
          <TabsTrigger value='links'>
            Ссылки ({linksAnalytics.length})
          </TabsTrigger>
          <TabsTrigger value='recipients'>
            Получатели ({total.toLocaleString('ru-RU')})
          </TabsTrigger>
          <TabsTrigger value='content'>Содержимое</TabsTrigger>
        </TabsList>

        {/* Вкладка 1: Обзор и Воронка */}
        <TabsContent value='overview' className='mt-4 space-y-4'>
          {/* Воронка конверсии */}
          <Card>
            <CardHeader className='p-4 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Воронка эффективности кампании
              </CardTitle>
              <CardDescription className='text-xs'>
                Этапы прохождения аудитории от отправки до целевого действия
              </CardDescription>
            </CardHeader>
            <CardContent className='p-4 pt-2'>
              <div className='grid gap-3 sm:grid-cols-3'>
                <div className='bg-muted/20 rounded-lg border p-3'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    1. База получателей
                  </span>
                  <div className='mt-1 text-xl font-bold'>
                    {total.toLocaleString('ru-RU')}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-[11px]'>
                    100% охвата
                  </div>
                </div>

                <div className='rounded-lg border bg-green-50/40 p-3 dark:bg-green-950/20'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    2. Отправлено
                  </span>
                  <div className='mt-1 text-xl font-bold text-green-600 dark:text-green-400'>
                    {sent.toLocaleString('ru-RU')}
                  </div>
                  <div className='mt-0.5 text-[11px] font-medium text-green-600 dark:text-green-400'>
                    {successRate.toFixed(1)}% от базы
                  </div>
                </div>

                <div className='rounded-lg border bg-purple-50/40 p-3 dark:bg-purple-950/20'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    3. Перешли (CTR)
                  </span>
                  <div className='mt-1 text-xl font-bold text-purple-600 dark:text-purple-400'>
                    {clicked.toLocaleString('ru-RU')}
                  </div>
                  <div className='mt-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400'>
                    {clickRate.toFixed(1)}% от отправленных
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className='grid gap-4 md:grid-cols-2'>
            {/* Круговая диаграмма */}
            <Card>
              <CardHeader className='p-4 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Результаты отправки
                </CardTitle>
                <CardDescription className='text-xs'>
                  Соотношение принятых каналом сообщений и ошибок
                </CardDescription>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                {pieData.length > 0 ? (
                  <div className='h-[220px]'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx='50%'
                          cy='50%'
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey='value'
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign='bottom' height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className='text-muted-foreground flex h-[220px] items-center justify-center text-xs'>
                    Нет данных для диаграммы
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Детализация причин ошибок */}
            <Card>
              <CardHeader className='p-4 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Причины ошибок отправки
                </CardTitle>
                <CardDescription className='text-xs'>
                  Ответы API канала по неотправленным контактам
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3 p-4 pt-0'>
                {Object.keys(errorsBreakdown).length > 0 ? (
                  <div className='space-y-2.5'>
                    {Object.entries(errorsBreakdown).map(([reason, count]) => {
                      const countNum = Number(count);
                      const pct =
                        failed > 0 ? Math.round((countNum / failed) * 100) : 0;
                      return (
                        <div key={reason} className='space-y-1'>
                          <div className='flex items-center justify-between text-xs'>
                            <span className='text-muted-foreground max-w-[260px] truncate font-medium'>
                              {reason}
                            </span>
                            <span className='font-semibold'>
                              {countNum.toLocaleString('ru-RU')} ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} className='bg-muted h-1.5' />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className='text-muted-foreground flex h-[180px] flex-col items-center justify-center text-center text-xs'>
                    <CheckCircle2 className='mb-2 h-8 w-8 text-green-500' />
                    Ошибок отправки не зафиксировано
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Вкладка 2: Ссылки и клики */}
        <TabsContent value='links' className='mt-4 space-y-4'>
          <Card>
            <CardHeader className='p-4 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Эффективность ссылок рассылки
              </CardTitle>
              <CardDescription className='text-xs'>
                Статистика переходов по каждой ссылке и кнопке из сообщения
              </CardDescription>
            </CardHeader>
            <CardContent className='p-4 pt-2'>
              {linksAnalytics.length === 0 ? (
                <div className='text-muted-foreground py-10 text-center text-xs'>
                  <LinkIcon className='text-muted-foreground/50 mx-auto mb-2 h-8 w-8' />
                  В этой рассылке не было ссылок или данные еще собираются
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Целевой URL</TableHead>
                      <TableHead>Трекинг-код</TableHead>
                      <TableHead>Всего кликов</TableHead>
                      <TableHead>Уникальных переходов</TableHead>
                      <TableHead className='text-right'>CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linksAnalytics.map((linkItem: any) => (
                      <TableRow key={linkItem.id}>
                        <TableCell className='max-w-[340px] truncate text-xs font-medium'>
                          <a
                            href={linkItem.originalUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary flex items-center gap-1.5 hover:underline'
                          >
                            <span className='truncate'>
                              {linkItem.originalUrl}
                            </span>
                            <ExternalLink className='h-3 w-3 flex-shrink-0' />
                          </a>
                        </TableCell>
                        <TableCell className='text-muted-foreground font-mono text-xs'>
                          /r/{linkItem.shortCode}
                        </TableCell>
                        <TableCell className='text-xs font-semibold'>
                          {linkItem.totalClicks?.toLocaleString('ru-RU') || 0}
                        </TableCell>
                        <TableCell className='text-xs font-semibold text-purple-600 dark:text-purple-400'>
                          {linkItem.uniqueClicks?.toLocaleString('ru-RU') || 0}
                        </TableCell>
                        <TableCell className='text-right text-xs'>
                          <Badge
                            variant='outline'
                            className='text-[10px] font-normal'
                          >
                            {linkItem.ctr || 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка 3: Получатели */}
        <TabsContent value='recipients' className='mt-4 space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex max-w-[360px] flex-1 items-center gap-2'>
              <Input
                placeholder='Поиск по имени, телефону, @username...'
                value={recipientSearch}
                onChange={(e) => {
                  setRecipientSearch(e.target.value);
                  setRecipientsPage(1);
                }}
                className='h-8 text-xs'
              />
            </div>
            <div className='flex items-center gap-2'>
              <Select
                value={recipientStatusFilter}
                onValueChange={(val) => {
                  setRecipientStatusFilter(val);
                  setRecipientsPage(1);
                }}
              >
                <SelectTrigger className='h-8 w-[160px] text-xs'>
                  <SelectValue placeholder='Все статусы' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Все статусы</SelectItem>
                  <SelectItem value='sent'>Отправлено</SelectItem>
                  <SelectItem value='failed'>Ошибка</SelectItem>
                  <SelectItem value='pending'>В очереди</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Получатель</TableHead>
                  <TableHead>
                    {mailing.type === 'MAX' ? 'MAX ID' : 'Telegram ID'}
                  </TableHead>
                  <TableHead>Отправка</TableHead>
                  <TableHead>Первый переход</TableHead>
                  <TableHead>Всего кликов</TableHead>
                  <TableHead className='text-right'>Время</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipientsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='text-muted-foreground h-24 text-center text-xs'
                    >
                      Загрузка получателей...
                    </TableCell>
                  </TableRow>
                ) : recipients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='text-muted-foreground h-24 text-center text-xs'
                    >
                      Получатели не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  recipients.map((r) => {
                    const isSuccess = r.status === 'SENT';
                    const isPending = r.status === 'PENDING';
                    const user = r.user;
                    const displayName = user
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                        user.telegramUsername ||
                        user.maxUsername ||
                        user.phone ||
                        'Пользователь'
                      : 'Пользователь';

                    const hasClicked = Boolean(r.clickedAt || r.clickCount > 0);

                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className='text-xs font-medium'>
                            {displayName}
                          </div>
                          {(user?.telegramUsername || user?.maxUsername) && (
                            <div className='text-muted-foreground text-[11px]'>
                              @
                              {mailing.type === 'MAX'
                                ? user.maxUsername || user.telegramUsername
                                : user.telegramUsername || user.maxUsername}
                            </div>
                          )}
                          {!user?.telegramUsername &&
                            !user?.maxUsername &&
                            user?.phone && (
                              <div className='text-muted-foreground text-[11px]'>
                                {user.phone}
                              </div>
                            )}
                        </TableCell>
                        <TableCell className='text-muted-foreground font-mono text-xs'>
                          {(mailing.type === 'MAX' ? r.maxId : r.telegramId) ||
                            '—'}
                        </TableCell>
                        <TableCell>
                          {isSuccess ? (
                            <Badge
                              variant='default'
                              className='bg-green-600 px-2 py-0.5 text-[10px] font-normal hover:bg-green-700'
                            >
                              Отправлено
                            </Badge>
                          ) : isPending ? (
                            <Badge variant='secondary'>В очереди</Badge>
                          ) : (
                            <div className='space-y-0.5'>
                              <Badge
                                variant='destructive'
                                className='px-2 py-0.5 text-[10px] font-normal'
                              >
                                Ошибка
                              </Badge>
                              {r.error && (
                                <div className='text-muted-foreground max-w-[180px] truncate text-[10px]'>
                                  {r.error}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasClicked ? (
                            <div className='flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400'>
                              <MousePointerClick className='h-3.5 w-3.5' />
                              <span>
                                {r.clickedAt
                                  ? format(
                                      new Date(r.clickedAt),
                                      'dd.MM HH:mm',
                                      { locale: ru }
                                    )
                                  : 'Зафиксирован'}
                              </span>
                            </div>
                          ) : (
                            <span className='text-muted-foreground text-xs'>
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasClicked ? (
                            <div className='flex items-center gap-1.5'>
                              <Badge
                                variant='outline'
                                className='border-purple-300 text-[10px] font-medium text-purple-700 dark:text-purple-300'
                              >
                                <MousePointerClick className='mr-1 h-3 w-3' />
                                {r.clickCount || 1} клик(ов)
                              </Badge>
                            </div>
                          ) : (
                            <span className='text-muted-foreground text-xs'>
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-right text-xs'>
                          {r.sentAt
                            ? format(new Date(r.sentAt), 'dd.MM HH:mm', {
                                locale: ru
                              })
                            : r.createdAt
                              ? format(new Date(r.createdAt), 'dd.MM HH:mm', {
                                  locale: ru
                                })
                              : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Пагинация */}
          {recipientsTotalPages > 1 && (
            <div className='text-muted-foreground flex items-center justify-between text-xs'>
              <div>
                Показано {recipients.length} из{' '}
                {recipientsTotal.toLocaleString('ru-RU')}
              </div>
              <div className='flex items-center gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setRecipientsPage((p) => Math.max(1, p - 1))}
                  disabled={recipientsPage <= 1 || recipientsLoading}
                  className='h-7 w-7 p-0'
                >
                  <ChevronLeft className='h-3.5 w-3.5' />
                </Button>
                <span className='px-2'>
                  {recipientsPage} / {recipientsTotalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setRecipientsPage((p) =>
                      Math.min(recipientsTotalPages, p + 1)
                    )
                  }
                  disabled={
                    recipientsPage >= recipientsTotalPages || recipientsLoading
                  }
                  className='h-7 w-7 p-0'
                >
                  <ChevronRight className='h-3.5 w-3.5' />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Вкладка 4: Содержимое */}
        <TabsContent value='content' className='mt-4'>
          <Card>
            <CardHeader className='p-4 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Текст и медиа рассылки
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4 p-4 text-xs'>
              {/* Превью изображения */}
              {mailing.statistics?.imageUrl && (
                <div>
                  <p className='text-muted-foreground mb-1.5 font-medium'>
                    Прикрепленное изображение:
                  </p>
                  <Image
                    src={mailing.statistics.imageUrl}
                    alt='Медиа рассылки'
                    width={640}
                    height={360}
                    unoptimized
                    className='max-h-64 rounded-lg border object-contain'
                  />
                </div>
              )}

              {/* Текст */}
              <div>
                <p className='text-muted-foreground mb-1.5 font-medium'>
                  Текст сообщения:
                </p>
                <div className='bg-muted/50 rounded-lg border p-3 font-sans text-sm whitespace-pre-wrap'>
                  {mailing.messageText || 'Текст не указан'}
                </div>
              </div>

              {/* Кнопки */}
              {Array.isArray(mailing.statistics?.buttons) &&
                mailing.statistics.buttons.length > 0 && (
                  <div>
                    <p className='text-muted-foreground mb-1.5 font-medium'>
                      Инлайн-кнопки:
                    </p>
                    <div className='flex flex-wrap gap-2'>
                      {mailing.statistics.buttons.map(
                        (btn: any, idx: number) => (
                          <Button
                            key={idx}
                            variant='secondary'
                            size='sm'
                            className='text-xs'
                            asChild={Boolean(btn.url)}
                          >
                            {btn.url ? (
                              <a
                                href={btn.url}
                                target='_blank'
                                rel='noopener noreferrer'
                              >
                                {btn.text}
                                <ExternalLink className='ml-1 h-3 w-3' />
                              </a>
                            ) : (
                              <span>{btn.text}</span>
                            )}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
