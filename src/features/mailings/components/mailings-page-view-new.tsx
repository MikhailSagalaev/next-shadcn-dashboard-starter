/**
 * @file: src/features/mailings/components/mailings-page-view-new.tsx
 * @description: Полностью переработанная страница управления рассылками Telegram
 * @project: SaaS Bonus System
 * @created: 2025-01-31
 * @author: AI Assistant
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Plus,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Play,
  Pause,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MailingFormDialog } from './mailing-form-dialog';

interface MailingsPageViewProps {
  projectId: string;
}

export function MailingsPageViewNew({ projectId }: MailingsPageViewProps) {
  const router = useRouter();
  const [mailings, setMailings] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMailing, setEditingMailing] = useState<any>(null);

  // Статистика
  const stats = {
    total: mailings.length,
    active: mailings.filter((m) => m.status === 'SENDING').length,
    completed: mailings.filter((m) => m.status === 'COMPLETED').length,
    draft: mailings.filter((m) => m.status === 'DRAFT').length,
    totalSent: mailings.reduce((sum, m) => sum + (m.sentCount || 0), 0),
    totalOpened: mailings.reduce((sum, m) => sum + (m.openedCount || 0), 0),
    totalClicked: mailings.reduce((sum, m) => sum + (m.clickedCount || 0), 0)
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [mailingsRes, segmentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/mailings`),
        fetch(`/api/projects/${projectId}/segments`)
      ]);

      const mailingsData = await mailingsRes.json();
      const segmentsData = await segmentsRes.json();

      setMailings(mailingsData.mailings || []);
      setSegments(segmentsData.segments || []);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const filteredMailings = mailings.filter((mailing) => {
    const matchesSearch =
      mailing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mailing.messageText?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || mailing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    setEditingMailing(null);
    setFormOpen(true);
  };

  const handleEdit = (mailing: any) => {
    setEditingMailing(mailing);
    setFormOpen(true);
  };

  const handleDelete = async (mailingId: string) => {
    if (!confirm('Удалить рассылку? Это действие нельзя отменить.')) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Рассылка удалена');
        loadData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Ошибка удаления рассылки');
    }
  };

  const handleStart = async (mailingId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}/start`,
        { method: 'POST' }
      );

      if (response.ok) {
        toast.success('Рассылка запущена');
        loadData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Ошибка запуска рассылки');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: any; icon: any }> = {
      DRAFT: {
        label: 'Черновик',
        variant: 'secondary',
        icon: Edit
      },
      SCHEDULED: {
        label: 'Запланировано',
        variant: 'default',
        icon: Clock
      },
      SENDING: {
        label: 'Отправляется',
        variant: 'default',
        icon: Loader2
      },
      COMPLETED: {
        label: 'Завершено',
        variant: 'default',
        icon: CheckCircle2
      },
      FAILED: {
        label: 'Ошибка',
        variant: 'destructive',
        icon: XCircle
      }
    };

    const { label, variant, icon: Icon } = config[status] || config.DRAFT;

    return (
      <Badge variant={variant} className='flex items-center gap-1'>
        <Icon className='h-3 w-3' />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className='flex h-[600px] items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Заголовок и действия */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Рассылки Telegram
          </h1>
          <p className='text-muted-foreground mt-1'>
            Управление массовыми рассылками и аналитика
          </p>
        </div>
        <Button onClick={handleCreate} size='lg'>
          <Plus className='mr-2 h-5 w-5' />
          Создать рассылку
        </Button>
      </div>

      {/* Статистика */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Всего рассылок
            </CardTitle>
            <MessageSquare className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
            <p className='text-muted-foreground text-xs'>
              {stats.active} активных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Отправлено</CardTitle>
            <Send className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.totalSent.toLocaleString()}
            </div>
            <p className='text-muted-foreground text-xs'>сообщений</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Открыто</CardTitle>
            <Eye className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.totalOpened.toLocaleString()}
            </div>
            <p className='text-muted-foreground text-xs'>
              {stats.totalSent > 0
                ? `${((stats.totalOpened / stats.totalSent) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Кликов</CardTitle>
            <BarChart3 className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.totalClicked.toLocaleString()}
            </div>
            <p className='text-muted-foreground text-xs'>
              {stats.totalSent > 0
                ? `${((stats.totalClicked / stats.totalSent) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры и поиск */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex flex-1 items-center gap-2'>
              <Search className='text-muted-foreground h-4 w-4' />
              <Input
                placeholder='Поиск по названию или тексту...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='max-w-sm'
              />
            </div>
            <div className='flex items-center gap-2'>
              <Filter className='text-muted-foreground h-4 w-4' />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Все статусы</SelectItem>
                  <SelectItem value='DRAFT'>Черновики</SelectItem>
                  <SelectItem value='SCHEDULED'>Запланированные</SelectItem>
                  <SelectItem value='SENDING'>Отправляются</SelectItem>
                  <SelectItem value='COMPLETED'>Завершенные</SelectItem>
                  <SelectItem value='FAILED'>С ошибками</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Список рассылок */}
      <Tabs defaultValue='grid' className='w-full'>
        <TabsList>
          <TabsTrigger value='grid'>Карточки</TabsTrigger>
          <TabsTrigger value='list'>Список</TabsTrigger>
        </TabsList>

        <TabsContent value='grid' className='mt-6'>
          {filteredMailings.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-16'>
                <MessageSquare className='text-muted-foreground mb-4 h-16 w-16' />
                <h3 className='mb-2 text-lg font-semibold'>
                  {searchQuery || statusFilter !== 'all'
                    ? 'Ничего не найдено'
                    : 'Нет рассылок'}
                </h3>
                <p className='text-muted-foreground mb-4 text-center'>
                  {searchQuery || statusFilter !== 'all'
                    ? 'Попробуйте изменить фильтры'
                    : 'Создайте первую рассылку для ваших пользователей'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button onClick={handleCreate}>
                    <Plus className='mr-2 h-4 w-4' />
                    Создать рассылку
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {filteredMailings.map((mailing) => (
                <Card
                  key={mailing.id}
                  className='group relative overflow-hidden transition-all hover:shadow-lg'
                >
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <CardTitle className='line-clamp-1 text-lg'>
                          {mailing.name}
                        </CardTitle>
                        <CardDescription className='mt-1'>
                          {getStatusBadge(mailing.status)}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                          >
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Действия</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/dashboard/projects/${projectId}/mailings/${mailing.id}/analytics`
                              )
                            }
                          >
                            <BarChart3 className='mr-2 h-4 w-4' />
                            Аналитика
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(mailing)}>
                            <Edit className='mr-2 h-4 w-4' />
                            Редактировать
                          </DropdownMenuItem>
                          {mailing.status === 'DRAFT' && (
                            <DropdownMenuItem
                              onClick={() => handleStart(mailing.id)}
                            >
                              <Play className='mr-2 h-4 w-4' />
                              Запустить
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(mailing.id)}
                            className='text-destructive'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {/* Превью текста */}
                    <div className='text-muted-foreground line-clamp-2 text-sm'>
                      {mailing.messageText?.replace(/<[^>]*>/g, '') ||
                        'Нет текста'}
                    </div>

                    {/* Статистика */}
                    <div className='grid grid-cols-2 gap-2 text-sm'>
                      <div className='flex items-center gap-2'>
                        <Send className='text-muted-foreground h-4 w-4' />
                        <span className='font-medium'>
                          {mailing.sentCount || 0}
                        </span>
                        <span className='text-muted-foreground'>
                          отправлено
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Users className='text-muted-foreground h-4 w-4' />
                        <span className='font-medium'>
                          {mailing._count?.recipients || 0}
                        </span>
                        <span className='text-muted-foreground'>
                          получателей
                        </span>
                      </div>
                      {mailing.openedCount > 0 && (
                        <div className='flex items-center gap-2'>
                          <Eye className='text-muted-foreground h-4 w-4' />
                          <span className='font-medium'>
                            {mailing.openedCount}
                          </span>
                          <span className='text-muted-foreground'>открыто</span>
                        </div>
                      )}
                      {mailing.clickedCount > 0 && (
                        <div className='flex items-center gap-2'>
                          <BarChart3 className='text-muted-foreground h-4 w-4' />
                          <span className='font-medium'>
                            {mailing.clickedCount}
                          </span>
                          <span className='text-muted-foreground'>кликов</span>
                        </div>
                      )}
                    </div>

                    {/* Дата */}
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                      <Calendar className='h-3 w-3' />
                      {mailing.createdAt
                        ? format(
                            new Date(mailing.createdAt),
                            'dd MMM yyyy, HH:mm',
                            { locale: ru }
                          )
                        : '—'}
                    </div>

                    {/* Кнопка просмотра */}
                    <Button
                      variant='outline'
                      className='w-full'
                      onClick={() =>
                        router.push(
                          `/dashboard/projects/${projectId}/mailings/${mailing.id}/analytics`
                        )
                      }
                    >
                      <BarChart3 className='mr-2 h-4 w-4' />
                      Подробная аналитика
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='list' className='mt-6'>
          {/* Компактный список - можно добавить позже */}
          <Card>
            <CardContent className='text-muted-foreground py-8 text-center'>
              Список в разработке
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог создания/редактирования */}
      <MailingFormDialog
        projectId={projectId}
        open={formOpen}
        onOpenChange={setFormOpen}
        mailing={editingMailing}
        segments={segments}
      />
    </div>
  );
}
