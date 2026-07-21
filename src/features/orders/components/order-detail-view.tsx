/**
 * @file: src/features/orders/components/order-detail-view.tsx
 * @description: Компонент детальной страницы заказа
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { OrderWithRelations } from '@/types/orders';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { OrderMarkingCard } from './order-marking-card';

interface OrderDetailViewProps {
  projectId: string;
  orderId: string;
}

const statusColors: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  PROCESSING: 'default',
  SHIPPED: 'default',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
  REFUNDED: 'outline'
};

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтвержден',
  PROCESSING: 'Обрабатывается',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
  REFUNDED: 'Возврат'
};

const accountingStateLabels: Record<string, string> = {
  LEGACY: 'Исторический заказ',
  NOT_APPLIED: 'Не применен',
  APPLYING: 'Применяется',
  APPLIED: 'Применен',
  REVERSING: 'Отменяется',
  REVERSED: 'Отменен',
  PARTIALLY_REVERSED: 'Частично отменен'
};

export function OrderDetailView({ projectId, orderId }: OrderDetailViewProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState<string>('');
  const [comment, setComment] = useState('');
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}`
      );
      if (!response.ok) {
        throw new Error('Ошибка загрузки заказа');
      }

      const data = (await response.json()) as OrderWithRelations;
      setOrder(data);
      setNewStatus(data.status);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить заказ'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const handleStatusChange = async () => {
    if (!order || newStatus === order.status) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus,
            comment: comment || 'Изменение статуса'
          })
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || 'Ошибка изменения статуса');
      }

      toast.success('Статус заказа изменен');
      setConfirmStatusChange(false);
      await fetchOrder();
      setComment('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось изменить статус'
      );
    }
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!order) {
    return <div>Заказ не найден</div>;
  }

  const isCashPending =
    order.status === 'PENDING' &&
    String(order.paymentMethod ?? '')
      .trim()
      .toLocaleLowerCase('ru-RU') === 'наличные';

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/orders`)
            }
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Назад
          </Button>
          <div>
            <h2 className='text-3xl font-bold tracking-tight'>
              Заказ {order.orderNumber}
            </h2>
            <p className='text-muted-foreground'>
              Детальная информация о заказе
            </p>
          </div>
        </div>
        <Badge
          variant={statusColors[order.status] || 'secondary'}
          className='px-4 py-2 text-lg'
        >
          {statusLabels[order.status] || order.status}
        </Badge>
      </div>

      {isCashPending && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Наличный заказ ожидает подтверждения</AlertTitle>
          <AlertDescription>
            Бонусы, сумма покупок и реферальные начисления будут применены
            только после ручного перевода заказа в статус «Подтвержден».
          </AlertDescription>
        </Alert>
      )}

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Информация о заказе</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label className='text-muted-foreground'>Номер заказа</Label>
              <div className='font-mono font-medium'>{order.orderNumber}</div>
            </div>
            <div>
              <Label className='text-muted-foreground'>Дата создания</Label>
              <div>
                {new Intl.DateTimeFormat('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }).format(new Date(order.createdAt))}
              </div>
            </div>
            <div>
              <Label className='text-muted-foreground'>Общая сумма</Label>
              <div className='text-2xl font-bold'>
                {new Intl.NumberFormat('ru-RU', {
                  style: 'currency',
                  currency: 'RUB'
                }).format(Number(order.totalAmount))}
              </div>
            </div>
            {Number(order.bonusAmount ?? 0) > 0 && (
              <div>
                <Label className='text-muted-foreground'>
                  Бонусы использованы
                </Label>
                <div className='font-medium'>
                  {new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  }).format(Number(order.bonusAmount))}
                </div>
              </div>
            )}
            <div>
              <Label className='text-muted-foreground'>Состояние учета</Label>
              <div className='flex items-center gap-2'>
                <Badge
                  variant={
                    order.accountingState === 'PARTIALLY_REVERSED'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {accountingStateLabels[order.accountingState] ||
                    order.accountingState}
                </Badge>
                {Number(order.reversalShortfall) > 0 && (
                  <span className='text-destructive text-sm'>
                    Недостача:{' '}
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'RUB'
                    }).format(Number(order.reversalShortfall))}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Клиент</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {order.user ? (
              <>
                <div>
                  <Label className='text-muted-foreground'>Имя</Label>
                  <div className='font-medium'>
                    {order.user.firstName || order.user.lastName
                      ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
                      : 'Без имени'}
                  </div>
                </div>
                {order.user.email && (
                  <div>
                    <Label className='text-muted-foreground'>Email</Label>
                    <div>{order.user.email}</div>
                  </div>
                )}
                {order.user.phone && (
                  <div>
                    <Label className='text-muted-foreground'>Телефон</Label>
                    <div>{order.user.phone}</div>
                  </div>
                )}
              </>
            ) : (
              <div className='text-muted-foreground'>Гостевой заказ</div>
            )}
          </CardContent>
        </Card>

        {order.deliveryAddress && (
          <Card>
            <CardHeader>
              <CardTitle>Доставка</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className='text-muted-foreground'>Адрес доставки</Label>
                <div>{order.deliveryAddress}</div>
              </div>
              {order.deliveryMethod && (
                <div className='mt-4'>
                  <Label className='text-muted-foreground'>
                    Способ доставки
                  </Label>
                  <div>{order.deliveryMethod}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {order.paymentMethod && (
          <Card>
            <CardHeader>
              <CardTitle>Оплата</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className='text-muted-foreground'>Способ оплаты</Label>
                <div>{order.paymentMethod}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Товары</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {order.items.map((item) => (
              <div
                key={item.id}
                className='flex items-center justify-between border-b pb-4'
              >
                <div>
                  <div className='font-medium'>{item.name}</div>
                  <div className='text-muted-foreground text-sm'>
                    Количество: {item.quantity} ×{' '}
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'RUB'
                    }).format(Number(item.price))}
                  </div>
                </div>
                <div className='font-medium'>
                  {new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  }).format(Number(item.total))}
                </div>
              </div>
            ))}
          </div>
          <Separator className='my-4' />
          <div className='flex items-center justify-between'>
            <div className='text-lg font-medium'>Итого</div>
            <div className='text-2xl font-bold'>
              {new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB'
              }).format(Number(order.totalAmount))}
            </div>
          </div>
        </CardContent>
      </Card>

      <OrderMarkingCard
        projectId={projectId}
        orderId={orderId}
        order={order}
        onChanged={fetchOrder}
      />

      <Card>
        <CardHeader>
          <CardTitle>Изменение статуса</CardTitle>
          <CardDescription>
            Измените статус заказа и добавьте комментарий
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label>Новый статус</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PENDING'>Ожидает</SelectItem>
                <SelectItem value='CONFIRMED'>Подтвержден</SelectItem>
                <SelectItem value='PROCESSING'>Обрабатывается</SelectItem>
                <SelectItem value='SHIPPED'>Отправлен</SelectItem>
                <SelectItem value='DELIVERED'>Доставлен</SelectItem>
                <SelectItem value='CANCELLED'>Отменен</SelectItem>
                <SelectItem value='REFUNDED'>Возврат</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder='Введите комментарий к изменению статуса...'
            />
          </div>
          <Button
            onClick={() => setConfirmStatusChange(true)}
            disabled={newStatus === order.status}
          >
            Изменить статус
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История изменений</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {order.history && order.history.length > 0 ? (
              order.history.map((historyItem) => (
                <div
                  key={historyItem.id}
                  className='flex items-start gap-4 border-b pb-4'
                >
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <Badge
                        variant={
                          statusColors[historyItem.status] || 'secondary'
                        }
                      >
                        {statusLabels[historyItem.status] || historyItem.status}
                      </Badge>
                      <span className='text-muted-foreground text-sm'>
                        {new Intl.DateTimeFormat('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(historyItem.createdAt))}
                      </span>
                    </div>
                    {historyItem.comment && (
                      <div className='mt-2 text-sm'>{historyItem.comment}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className='text-muted-foreground py-8 text-center'>
                История изменений отсутствует
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmStatusChange}
        onOpenChange={setConfirmStatusChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить изменение статуса?</AlertDialogTitle>
            <AlertDialogDescription>
              Статус заказа изменится с «{statusLabels[order.status]}» на «
              {statusLabels[newStatus] || newStatus}». Экономические эффекты
              заказа могут быть применены или отменены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
