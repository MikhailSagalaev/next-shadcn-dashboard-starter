/**
 * @file: src/features/orders/components/orders-page-view.tsx
 * @description: Компонент страницы управления заказами
 * @project: SaaS Bonus System
 * @dependencies: React, OrdersTable
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { OrdersTable } from './orders-table';
import { toast } from 'sonner';
import type { OrderWithRelations } from '@/types/orders';
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

interface OrdersPageViewProps {
  projectId: string;
}

export function OrdersPageView({ projectId }: OrdersPageViewProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: string;
    orderNumber: string;
    status: string;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(
        `/api/projects/${projectId}/orders?${params}`
      );
      if (!response.ok) {
        throw new Error('Ошибка загрузки заказов');
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalCount(data.total || 0);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить заказы'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, sortBy, sortOrder, search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderClick = (order: OrderWithRelations) => {
    router.push(`/dashboard/projects/${projectId}/orders/${order.id}`);
  };

  const requestStatusChange = (orderId: string, status: string) => {
    const selectedOrder = orders.find((order) => order.id === orderId);
    if (!selectedOrder) return;
    setPendingStatusChange({
      orderId,
      orderNumber: selectedOrder.orderNumber,
      status
    });
  };

  const handleStatusChange = async () => {
    if (!pendingStatusChange) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/orders/${pendingStatusChange.orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: pendingStatusChange.status,
            comment: 'Изменение статуса из списка заказов'
          })
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || 'Ошибка изменения статуса');
      }

      toast.success('Статус заказа изменен');
      setPendingStatusChange(null);
      await fetchOrders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось изменить статус'
      );
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Заказы</h2>
          <p className='text-muted-foreground'>
            Управление заказами и их статусами
          </p>
        </div>
        <Button>
          <Plus className='mr-2 h-4 w-4' />
          Создать заказ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список заказов</CardTitle>
          <CardDescription>
            Все заказы проекта. Всего: {totalCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='mb-4 flex items-center gap-4'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='Поиск по номеру заказа, клиенту...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Статус' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все статусы</SelectItem>
                <SelectItem value='PENDING'>Ожидает</SelectItem>
                <SelectItem value='CONFIRMED'>Подтвержден</SelectItem>
                <SelectItem value='PROCESSING'>Обрабатывается</SelectItem>
                <SelectItem value='SHIPPED'>Отправлен</SelectItem>
                <SelectItem value='DELIVERED'>Доставлен</SelectItem>
                <SelectItem value='CANCELLED'>Отменен</SelectItem>
                <SelectItem value='REFUNDED'>Возврат</SelectItem>
              </SelectContent>
            </Select>
            <Button variant='outline'>
              <Download className='mr-2 h-4 w-4' />
              Экспорт
            </Button>
          </div>

          <OrdersTable
            data={orders}
            loading={loading}
            totalCount={totalCount}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
              setPage(1);
            }}
            onOrderClick={handleOrderClick}
            onStatusChange={requestStatusChange}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingStatusChange)}
        onOpenChange={(open) => !open && setPendingStatusChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить изменение статуса?</AlertDialogTitle>
            <AlertDialogDescription>
              Заказ {pendingStatusChange?.orderNumber}: новый статус —{' '}
              {pendingStatusChange?.status}. Это действие может изменить бонусы
              и сумму покупок клиента.
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
