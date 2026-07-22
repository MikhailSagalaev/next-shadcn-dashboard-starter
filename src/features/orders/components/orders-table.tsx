'use client';

import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { OrderWithRelations } from '@/types/orders';
import {
  FISCAL_STATE_LABELS,
  MARKING_STATE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  orderNeedsAttention
} from './order-workflow-ui';

interface OrdersTableProps {
  data: OrderWithRelations[];
  loading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOrderClick: (order: OrderWithRelations) => void;
}

export function OrdersTable({
  data,
  loading,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onOrderClick
}: OrdersTableProps) {
  if (loading) return <OrdersSkeleton />;

  if (!data.length) {
    return (
      <div className='text-muted-foreground px-6 py-16 text-center text-sm'>
        Заказы по выбранным условиям не найдены.
      </div>
    );
  }

  const first = (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, totalCount);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='pl-6'>Заказ</TableHead>
            <TableHead>Покупатель</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Оплата</TableHead>
            <TableHead>Маркировка</TableHead>
            <TableHead>Чек</TableHead>
            <TableHead className='pr-6 text-right'>Действие</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((order) => {
            const attention = orderNeedsAttention(order);
            return (
              <TableRow
                key={order.id}
                className='cursor-pointer'
                onClick={() => onOrderClick(order)}
              >
                <TableCell className='py-3 pl-6'>
                  <div className='font-medium'>№ {order.orderNumber}</div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    {formatDate(order.createdAt)} · {order.items?.length ?? 0}{' '}
                    поз.
                  </div>
                  <Badge
                    variant={attention ? 'destructive' : 'outline'}
                    className='mt-2'
                  >
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className='max-w-56 truncate font-medium'>
                    {customerName(order)}
                  </div>
                  <div className='text-muted-foreground mt-1 max-w-56 truncate text-xs'>
                    {order.user?.email || order.user?.phone || 'Без контакта'}
                  </div>
                </TableCell>
                <TableCell className='font-medium tabular-nums'>
                  {formatMoney(order.totalAmount)}
                </TableCell>
                <TableCell>
                  <StateBadge
                    state={order.paymentStatus}
                    label={
                      PAYMENT_STATUS_LABELS[order.paymentStatus] ||
                      order.paymentStatus
                    }
                    success={order.paymentStatus === 'PAID'}
                  />
                </TableCell>
                <TableCell>
                  <StateBadge
                    state={order.markingState}
                    label={
                      MARKING_STATE_LABELS[order.markingState] ||
                      order.markingState
                    }
                    success={['COMPLETE', 'NOT_REQUIRED'].includes(
                      order.markingState
                    )}
                  />
                </TableCell>
                <TableCell>
                  <StateBadge
                    state={order.fiscalState}
                    label={
                      FISCAL_STATE_LABELS[order.fiscalState] ||
                      order.fiscalState
                    }
                    success={order.fiscalState === 'SETTLED'}
                  />
                </TableCell>
                <TableCell className='pr-6 text-right'>
                  <Button
                    size='sm'
                    variant={attention ? 'default' : 'outline'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOrderClick(order);
                    }}
                  >
                    <ExternalLink /> {attention ? 'Исправить' : 'Открыть'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className='flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='text-muted-foreground text-sm'>
          Показано {first}–{last} из {totalCount}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft /> Назад
          </Button>
          <span className='min-w-20 text-center text-sm'>
            {currentPage} из {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Далее <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}

function StateBadge({
  state,
  label,
  success
}: {
  state: string;
  label: string;
  success: boolean;
}) {
  const failed = ['FAILED', 'UNCONFIGURED'].includes(state);
  return (
    <Badge
      variant={failed ? 'destructive' : success ? 'secondary' : 'outline'}
      className='max-w-44 text-left whitespace-normal'
    >
      {label}
    </Badge>
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
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function OrdersSkeleton() {
  return (
    <div className='space-y-1 px-6 py-2'>
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className='flex items-center gap-5 border-b py-4'>
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-36' />
            <Skeleton className='h-3 w-24' />
          </div>
          <Skeleton className='h-6 w-24' />
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-8 w-20' />
        </div>
      ))}
    </div>
  );
}
