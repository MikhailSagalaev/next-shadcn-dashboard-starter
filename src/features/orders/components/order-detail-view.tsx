'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Circle,
  Package,
  RefreshCw,
  Save,
  UserRound
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { MarkingWorkspaceNav } from '@/features/marking/components/marking-workspace-nav';
import type { OrderWithRelations } from '@/types/orders';
import { OrderMarkingCard } from './order-marking-card';
import { ReturnReceiptCard } from './return-receipt-card';
import {
  FISCAL_STATE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS
} from './order-workflow-ui';

export function OrderDetailView({
  projectId,
  orderId
}: {
  projectId: string;
  orderId: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  const fetchOrder = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/orders/${orderId}`
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'Не удалось загрузить заказ');
        setOrder(data);
        setNewStatus(data.status);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить заказ'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, projectId]
  );

  useEffect(() => void fetchOrder(), [fetchOrder]);

  useEffect(() => {
    if (
      !order ||
      (order.fiscalState !== 'SETTLEMENT_PENDING' &&
        order.withdrawalState !== 'PENDING')
    )
      return;
    const timer = window.setInterval(() => void fetchOrder(true), 4000);
    return () => window.clearInterval(timer);
  }, [fetchOrder, order]);

  async function changeStatus() {
    if (!order || newStatus === order.status) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            comment: comment.trim() || 'Изменение статуса заказа'
          })
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Не удалось изменить статус');
      toast.success('Статус заказа изменён');
      setConfirmStatusChange(false);
      setComment('');
      await fetchOrder(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось изменить статус'
      );
    }
  }

  if (loading) return <OrderDetailSkeleton />;
  if (!order) return <div className='py-16 text-center'>Заказ не найден</div>;

  const readyToShip =
    order.fulfillmentState === 'READY_TO_SHIP' &&
    ['SUCCEEDED', 'NOT_REQUIRED'].includes(order.withdrawalState);
  const shippingBlocked =
    !readyToShip && ['SHIPPED', 'DELIVERED'].includes(newStatus);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <Button
            variant='ghost'
            className='mb-2 -ml-3'
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/orders`)
            }
          >
            <ArrowLeft /> К списку заказов
          </Button>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-3xl font-bold tracking-tight'>
              Заказ № {order.orderNumber}
            </h1>
            <Badge variant='secondary'>
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </Badge>
          </div>
          <p className='text-muted-foreground mt-1'>
            Создан {formatDate(order.createdAt)} ·{' '}
            {formatMoney(order.totalAmount)}
          </p>
        </div>
        <Button
          variant='outline'
          disabled={refreshing}
          onClick={() => void fetchOrder(true)}
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} /> Обновить
        </Button>
      </div>

      <MarkingWorkspaceNav projectId={projectId} active='orders' />
      <OrderWorkflow order={order} />

      {!readyToShip && ['PROCESSING', 'CONFIRMED'].includes(order.status) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Заказ пока нельзя отгружать</AlertTitle>
          <AlertDescription>
            {shippingBlockers(order).join(' ')} Ниже показано следующее
            доступное действие.
          </AlertDescription>
        </Alert>
      )}

      <OrderMarkingCard
        projectId={projectId}
        orderId={orderId}
        order={order}
        onChanged={() => fetchOrder(true)}
      />

      <ReturnReceiptCard
        projectId={projectId}
        orderId={orderId}
        order={order}
        onChanged={() => fetchOrder(true)}
      />

      <div className='grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]'>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Package className='h-5 w-5' /> Состав заказа
              </CardTitle>
              <CardDescription>
                Фискальные реквизиты зафиксированы в заказе и не меняются
                автоматически вместе с каталогом.
              </CardDescription>
            </CardHeader>
            <CardContent className='px-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='pl-6'>Товар</TableHead>
                    <TableHead>Маркировка</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead className='pr-6 text-right'>Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='max-w-lg py-3 pl-6'>
                        <div className='font-medium'>{item.name}</div>
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {item.sku && `SKU ${item.sku} · `}
                          {item.gtin ? `GTIN ${item.gtin}` : 'GTIN не указан'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.markingStatus === 'UNKNOWN'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {item.markingStatus === 'MARKED_REQUIRED'
                            ? `Отсканировано ${item.markedUnits?.length ?? 0}/${item.quantity}`
                            : item.markingStatus === 'UNKNOWN'
                              ? 'Не настроено'
                              : 'Код не требуется'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.quantity} × {formatMoney(item.price)}
                      </TableCell>
                      <TableCell className='pr-6 text-right font-medium'>
                        {formatMoney(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className='flex justify-between border-t px-6 py-4 text-lg font-semibold'>
                <span>Итого</span>
                <span>{formatMoney(order.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История заказа</CardTitle>
            </CardHeader>
            <CardContent>
              {order.history?.length ? (
                <div className='space-y-4'>
                  {order.history.map((entry, index) => (
                    <div key={entry.id} className='relative flex gap-3'>
                      <div className='flex flex-col items-center'>
                        <span className='bg-primary mt-1 h-2.5 w-2.5 rounded-full' />
                        {index < order.history.length - 1 && (
                          <span className='bg-border h-full w-px' />
                        )}
                      </div>
                      <div className='pb-4'>
                        <div className='font-medium'>
                          {ORDER_STATUS_LABELS[entry.status] || entry.status}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {formatDate(entry.createdAt)}
                        </div>
                        {entry.comment && (
                          <div className='mt-1 text-sm'>{entry.comment}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-muted-foreground text-sm'>
                  История пуста
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6 xl:sticky xl:top-6'>
          <Card>
            <CardHeader>
              <CardTitle>Покупатель и доставка</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4 text-sm'>
              <InfoRow
                icon={UserRound}
                label='Покупатель'
                value={customerName(order)}
              />
              {order.user?.email && (
                <InfoRow label='Email' value={order.user.email} />
              )}
              {order.user?.phone && (
                <InfoRow label='Телефон' value={order.user.phone} />
              )}
              {order.deliveryMethod && (
                <InfoRow label='Доставка' value={order.deliveryMethod} />
              )}
              {order.deliveryAddress && (
                <InfoRow label='Адрес' value={order.deliveryAddress} />
              )}
              <Separator />
              <InfoRow
                label='Оплата'
                value={`${PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}${
                  order.paymentMethod ? ` · ${order.paymentMethod}` : ''
                }`}
              />
              {order.providerPaymentId && (
                <InfoRow
                  label='Платёж ЮKassa'
                  value={order.providerPaymentId}
                  mono
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус заказа</CardTitle>
              <CardDescription>
                Отгрузка доступна только после оплаты, маркировки и регистрации
                чека.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Новый статус</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem
                          key={value}
                          value={value}
                          disabled={
                            !readyToShip &&
                            ['SHIPPED', 'DELIVERED'].includes(value)
                          }
                        >
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='status-comment'>Комментарий</Label>
                <Textarea
                  id='status-comment'
                  value={comment}
                  maxLength={500}
                  placeholder='Причина или примечание для истории'
                  onChange={(event) => setComment(event.target.value)}
                />
              </div>
              {shippingBlocked && (
                <p className='text-destructive text-sm'>
                  Сначала завершите обязательные шаги выше.
                </p>
              )}
              <Button
                className='w-full'
                disabled={newStatus === order.status || shippingBlocked}
                onClick={() => setConfirmStatusChange(true)}
              >
                <Save /> Изменить статус
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={confirmStatusChange}
        onOpenChange={setConfirmStatusChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить статус заказа?</AlertDialogTitle>
            <AlertDialogDescription>
              «{ORDER_STATUS_LABELS[order.status] || order.status}» → «
              {ORDER_STATUS_LABELS[newStatus] || newStatus}». Изменение может
              повлиять на бонусы и складской учёт.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void changeStatus()}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrderWorkflow({ order }: { order: OrderWithRelations }) {
  const scanned = order.items.reduce(
    (sum, item) => sum + (item.markedUnits?.length ?? 0),
    0
  );
  const expected = order.items
    .filter((item) => item.markingStatus === 'MARKED_REQUIRED')
    .reduce((sum, item) => sum + item.quantity, 0);
  const steps = [
    {
      label: 'Оплата',
      value: PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
      complete: order.paymentStatus === 'PAID',
      error: false
    },
    {
      label: 'Каталог',
      value:
        order.markingState === 'UNCONFIGURED'
          ? 'Нужно исправить товары'
          : 'Реквизиты готовы',
      complete: order.markingState !== 'UNCONFIGURED',
      error: order.markingState === 'UNCONFIGURED'
    },
    {
      label: 'Data Matrix',
      value: expected ? `${scanned} из ${expected}` : 'Не требуется',
      complete: ['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState),
      error: order.markingState === 'FAILED'
    },
    {
      label: 'Чек',
      value: FISCAL_STATE_LABELS[order.fiscalState] || order.fiscalState,
      complete: order.fiscalState === 'SETTLED',
      error: order.fiscalState === 'FAILED'
    },
    {
      label: 'Вывод из оборота',
      value:
        order.withdrawalState === 'NOT_REQUIRED'
          ? 'Не требуется'
          : order.withdrawalState === 'SUCCEEDED'
            ? order.withdrawalMode === 'GIS_MT_DISTANCE_SALE'
              ? 'ГИС МТ подтвердил'
              : 'Передан через чек'
            : order.withdrawalState === 'PENDING'
              ? 'Ожидает подтверждения'
              : order.withdrawalState === 'FAILED'
                ? 'Ошибка'
                : 'Не начат',
      complete: ['SUCCEEDED', 'NOT_REQUIRED'].includes(order.withdrawalState),
      error: order.withdrawalState === 'FAILED'
    },
    {
      label: 'Отгрузка',
      value:
        order.fulfillmentState === 'READY_TO_SHIP' &&
        ['SUCCEEDED', 'NOT_REQUIRED'].includes(order.withdrawalState)
          ? 'Можно отправлять'
          : 'Заблокирована',
      complete:
        order.fulfillmentState === 'READY_TO_SHIP' &&
        ['SUCCEEDED', 'NOT_REQUIRED'].includes(order.withdrawalState),
      error: false
    }
  ];

  return (
    <Card>
      <CardContent className='grid gap-2 pt-6 sm:grid-cols-6'>
        {steps.map((step, index) => (
          <div
            key={step.label}
            className='relative flex gap-3 rounded-lg p-3 sm:block'
          >
            <div className='flex items-center sm:mb-2'>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                  step.error
                    ? 'border-destructive bg-destructive text-white'
                    : step.complete
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'bg-background'
                }`}
              >
                {step.error ? (
                  <AlertTriangle className='h-4 w-4' />
                ) : step.complete ? (
                  <Check className='h-4 w-4' />
                ) : (
                  <Circle className='h-3 w-3' />
                )}
              </span>
              {index < steps.length - 1 && (
                <span className='bg-border ml-2 hidden h-px flex-1 sm:block' />
              )}
            </div>
            <div>
              <div className='text-sm font-medium'>{step.label}</div>
              <div className='text-muted-foreground mt-0.5 text-xs'>
                {step.value}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function shippingBlockers(order: OrderWithRelations) {
  const blockers: string[] = [];
  if (order.paymentStatus !== 'PAID') blockers.push('Оплата не подтверждена.');
  if (order.markingState === 'UNCONFIGURED')
    blockers.push('Не настроены товары в каталоге.');
  else if (!['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState))
    blockers.push('Не завершено сканирование Data Matrix.');
  if (order.fiscalState !== 'SETTLED') blockers.push('Чек не зарегистрирован.');
  if (!['SUCCEEDED', 'NOT_REQUIRED'].includes(order.withdrawalState))
    blockers.push('Вывод Data Matrix из оборота не подтверждён.');
  return blockers;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono
}: {
  icon?: typeof UserRound;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className='flex gap-3'>
      {Icon && <Icon className='text-muted-foreground mt-0.5 h-4 w-4' />}
      <div className='min-w-0'>
        <div className='text-muted-foreground text-xs'>{label}</div>
        <div
          className={`break-words ${mono ? 'font-mono text-xs' : 'font-medium'}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function customerName(order: OrderWithRelations) {
  if (!order.user) return 'Гостевой заказ';
  const name =
    `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim();
  return name || order.user.email || order.user.phone || 'Без имени';
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB'
  }).format(Number(value));
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function OrderDetailSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-10 w-80' />
      <Skeleton className='h-24 w-full' />
      <Skeleton className='h-56 w-full' />
      <div className='grid gap-6 lg:grid-cols-2'>
        <Skeleton className='h-80 w-full' />
        <Skeleton className='h-80 w-full' />
      </div>
    </div>
  );
}
