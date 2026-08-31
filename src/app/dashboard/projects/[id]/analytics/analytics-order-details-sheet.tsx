'use client';

import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

type AnalyticsOrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
  total: number | string;
  sku?: string | null;
  metadata?: unknown;
};

export type AnalyticsOrderDetails = {
  id: string;
  orderNumber: string;
  externalOrderId?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  totalAmount: number | string;
  paidAmount: number | string;
  bonusAmount: number | string;
  accountingState?: string;
  accountedPurchaseAmount?: number | string;
  accountedAt?: string | null;
  deliveryMethod?: string | null;
  deliveryAddress?: string | null;
  createdAt: string;
  metadata?: unknown;
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  items: AnalyticsOrderItem[];
};

type AnalyticsOrderDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: AnalyticsOrderDetails | null;
  loading: boolean;
  error: string | null;
};

function formatMoney(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString('ru-RU')} ₽`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatPayload(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function customerName(order: AnalyticsOrderDetails): string {
  const fullName =
    `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim();
  return fullName || order.user?.email || order.user?.phone || 'Гость';
}

function DetailRow({
  label,
  value
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='text-right font-medium break-words'>
        {value || 'Не указано'}
      </dd>
    </div>
  );
}

export function AnalyticsOrderDetailsSheet({
  open,
  onOpenChange,
  order,
  loading,
  error
}: AnalyticsOrderDetailsSheetProps) {
  const metadata = asRecord(order?.metadata);
  const incomingPayload = metadata?.incomingPayload ?? metadata;
  const incomingPayloadText = formatPayload(incomingPayload);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>
            {order ? `Заказ №${order.orderNumber}` : 'Детали заказа'}
          </SheetTitle>
          <SheetDescription>
            Полная запись заказа и данные, полученные от интеграции.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='min-h-0 flex-1 px-4 pb-4'>
          {loading && (
            <div className='flex flex-col gap-4'>
              <Skeleton className='h-28 w-full' />
              <Skeleton className='h-44 w-full' />
              <Skeleton className='h-64 w-full' />
            </div>
          )}

          {!loading && error && (
            <Card>
              <CardHeader>
                <CardTitle>Не удалось загрузить заказ</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {!loading && order && (
            <div className='flex flex-col gap-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex flex-wrap items-center gap-2'>
                    {customerName(order)}
                    <Badge variant='secondary'>{order.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Создан {formatDate(order.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className='flex flex-col gap-3'>
                    <DetailRow
                      label='Сумма заказа'
                      value={formatMoney(order.totalAmount)}
                    />
                    <DetailRow
                      label='Оплачено'
                      value={formatMoney(order.paidAmount)}
                    />
                    <DetailRow
                      label='Использовано бонусов'
                      value={formatMoney(order.bonusAmount)}
                    />
                    <DetailRow
                      label='Статус оплаты'
                      value={order.paymentStatus}
                    />
                    <DetailRow
                      label='Способ оплаты'
                      value={order.paymentMethod}
                    />
                    <DetailRow
                      label='Платёжный провайдер'
                      value={order.paymentProvider}
                    />
                    <DetailRow
                      label='ID платежа'
                      value={order.providerPaymentId}
                    />
                    <DetailRow
                      label='Оплачен'
                      value={formatDate(order.paidAt)}
                    />
                    <DetailRow
                      label='Учёт заказа'
                      value={order.accountingState}
                    />
                    <DetailRow
                      label='Учтено в покупках'
                      value={formatMoney(order.accountedPurchaseAmount)}
                    />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Покупатель и доставка</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className='flex flex-col gap-3'>
                    <DetailRow label='Email' value={order.user?.email} />
                    <DetailRow label='Телефон' value={order.user?.phone} />
                    <DetailRow
                      label='Способ доставки'
                      value={order.deliveryMethod}
                    />
                    <DetailRow
                      label='Адрес доставки'
                      value={order.deliveryAddress}
                    />
                    <DetailRow
                      label='Внешний ID заказа'
                      value={order.externalOrderId}
                    />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Состав заказа</CardTitle>
                  <CardDescription>
                    {order.items.length} позиций
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='flex flex-col gap-3'>
                    {order.items.map((item) => (
                      <div key={item.id} className='rounded-md border p-3'>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='font-medium'>{item.name}</p>
                            {item.sku && (
                              <p className='text-muted-foreground mt-1 text-xs'>
                                SKU: {item.sku}
                              </p>
                            )}
                          </div>
                          <p className='shrink-0 font-medium'>
                            {formatMoney(item.total)}
                          </p>
                        </div>
                        <p className='text-muted-foreground mt-2 text-xs'>
                          {item.quantity} × {formatMoney(item.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex-row items-start justify-between gap-3'>
                  <div className='flex flex-col gap-1.5'>
                    <CardTitle>Входящие данные интеграции</CardTitle>
                    <CardDescription>
                      Полный сохранённый payload вебхука. Для старых заказов —
                      все данные, которые были сохранены на момент получения.
                    </CardDescription>
                  </div>
                  <CopyButton
                    value={incomingPayloadText}
                    label='Скопировать входящие данные'
                    toastTitle='Входящие данные скопированы'
                  />
                </CardHeader>
                <CardContent>
                  <ScrollArea className='h-80 rounded-md border'>
                    <pre className='p-3 text-xs break-all whitespace-pre-wrap'>
                      {incomingPayloadText}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
