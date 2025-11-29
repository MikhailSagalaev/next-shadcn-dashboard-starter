/**
 * @file: src/features/mailings/components/mailings-page-view.tsx
 * @description: Компонент страницы управления рассылками
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  Plus,
  BarChart3,
  Edit,
  Trash2,
  Send,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MailingFormDialog } from './mailing-form-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface MailingsPageViewProps {
  projectId: string;
}

const statusColors: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  SCHEDULED: 'default',
  SENDING: 'default',
  COMPLETED: 'default',
  CANCELLED: 'outline',
  FAILED: 'destructive'
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Черновик',
  SCHEDULED: 'Запланировано',
  SENDING: 'Отправляется',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
  FAILED: 'Ошибка'
};

const typeLabels: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  TELEGRAM: 'Telegram',
  WHATSAPP: 'WhatsApp',
  VIBER: 'Viber'
};

export function MailingsPageView({ projectId }: MailingsPageViewProps) {
  const router = useRouter();
  const [mailings, setMailings] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMailing, setEditingMailing] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadMailings = async (type?: string) => {
    try {
      const url =
        type && type !== 'all'
          ? `/api/projects/${projectId}/mailings?type=${type}`
          : `/api/projects/${projectId}/mailings`;
      const response = await fetch(url);
      const data = await response.json();
      setMailings(data.mailings || []);
    } catch (error) {
      console.error('Ошибка загрузки рассылок:', error);
      setMailings([]);
    }
  };

  useEffect(() => {
    // Загрузка рассылок и сегментов
    Promise.all([
      loadMailings(typeFilter !== 'all' ? typeFilter : undefined),
      fetch(`/api/projects/${projectId}/segments`).then((res) => res.json())
    ])
      .then(([, segmentsData]) => {
        setSegments(segmentsData.segments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, typeFilter]);

  const handleCreate = () => {
    setEditingMailing(null);
    setFormOpen(true);
  };

  const handleEdit = (mailing: any) => {
    setEditingMailing(mailing);
    setFormOpen(true);
  };

  const handleDelete = async (mailingId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту рассылку?')) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success('Рассылка удалена');
        loadMailings(typeFilter !== 'all' ? typeFilter : undefined);
      } else {
        throw new Error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Не удалось удалить рассылку');
    }
  };

  const handleStart = async (mailingId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/mailings/${mailingId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'SENDING' })
        }
      );

      if (response.ok) {
        // Запускаем рассылку через сервис
        const startResponse = await fetch(
          `/api/projects/${projectId}/mailings/${mailingId}/start`,
          {
            method: 'POST'
          }
        );

        if (startResponse.ok) {
          toast.success('Рассылка запущена');
          loadMailings(typeFilter !== 'all' ? typeFilter : undefined);
        } else {
          throw new Error('Ошибка запуска');
        }
      } else {
        throw new Error('Ошибка обновления статуса');
      }
    } catch (error) {
      toast.error('Не удалось запустить рассылку');
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingMailing(null);
    loadMailings(typeFilter !== 'all' ? typeFilter : undefined);
  };

  const filteredMailings =
    typeFilter === 'all'
      ? mailings
      : mailings.filter((m) => m.type === typeFilter);

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex items-center justify-between'>
        <Heading
          title='Рассылки'
          description='Управление рассылками в Telegram'
        />
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Создать рассылку
        </Button>
      </div>
      <Separator />

      {/* Фильтр по типу */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Рассылки</CardTitle>
              <CardDescription>
                Всего: {filteredMailings.length}{' '}
                {typeFilter !== 'all' && `(${typeLabels[typeFilter]})`}
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Filter className='text-muted-foreground h-4 w-4' />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder='Фильтр по типу' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Все типы</SelectItem>
                  <SelectItem value='TELEGRAM'>Telegram</SelectItem>
                  <SelectItem value='EMAIL'>Email</SelectItem>
                  <SelectItem value='SMS'>SMS</SelectItem>
                  <SelectItem value='WHATSAPP'>WhatsApp</SelectItem>
                  <SelectItem value='VIBER'>Viber</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='text-muted-foreground py-8 text-center'>
              Загрузка...
            </div>
          ) : filteredMailings.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center'>
              Нет рассылок
              {typeFilter !== 'all' && ` типа ${typeLabels[typeFilter]}`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Статистика</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead className='text-right'>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMailings.map((mailing) => {
                  const stats = mailing.statistics || {};
                  const totalRecipients = mailing._count?.recipients || 0;

                  return (
                    <TableRow key={mailing.id}>
                      <TableCell className='font-medium'>
                        {mailing.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {typeLabels[mailing.type] || mailing.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusColors[mailing.status] || 'default'}
                        >
                          {statusLabels[mailing.status] || mailing.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col gap-1 text-sm'>
                          <div className='text-muted-foreground'>
                            Отправлено:{' '}
                            <span className='font-medium'>
                              {mailing.sentCount || 0}
                            </span>
                          </div>
                          {mailing.openedCount > 0 && (
                            <div className='text-muted-foreground'>
                              Открыто:{' '}
                              <span className='font-medium'>
                                {mailing.openedCount}
                              </span>
                            </div>
                          )}
                          {mailing.clickedCount > 0 && (
                            <div className='text-muted-foreground'>
                              Кликов:{' '}
                              <span className='font-medium'>
                                {mailing.clickedCount}
                              </span>
                            </div>
                          )}
                          {mailing.failedCount > 0 && (
                            <div className='text-destructive'>
                              Ошибок:{' '}
                              <span className='font-medium'>
                                {mailing.failedCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='text-muted-foreground text-sm'>
                        {mailing.createdAt
                          ? format(
                              new Date(mailing.createdAt),
                              'dd.MM.yyyy HH:mm',
                              { locale: ru }
                            )
                          : '—'}
                      </TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' className='h-8 w-8 p-0'>
                              <span className='sr-only'>Открыть меню</span>
                              <Mail className='h-4 w-4' />
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
                              Статистика
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(mailing)}
                            >
                              <Edit className='mr-2 h-4 w-4' />
                              Редактировать
                            </DropdownMenuItem>
                            {mailing.status === 'DRAFT' && (
                              <DropdownMenuItem
                                onClick={() => handleStart(mailing.id)}
                              >
                                <Send className='mr-2 h-4 w-4' />
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
