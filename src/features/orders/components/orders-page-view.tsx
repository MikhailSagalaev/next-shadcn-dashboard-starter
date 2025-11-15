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
import { Package, Plus, Search, Filter, Download } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import type { OrderWithRelations, OrderStatus } from '@/types/orders';

interface OrdersPageViewProps {
  projectId: string;
}

export function OrdersPageView({ projectId }: OrdersPageViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await fetch(`/api/projects/${projectId}/orders?${params}`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки заказов');
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalCount(data.total || 0);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить заказы',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, search, statusFilter, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderClick = (order: OrderWithRelations) => {
    router.push(`/dashboard/projects/${projectId}/orders/${order.id}`);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          comment: 'Изменение статуса из списка заказов',
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка изменения статуса');
      }

      toast({
        title: 'Успешно',
        description: 'Статус заказа изменен',
      });

      fetchOrders();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось изменить статус',
        variant: 'destructive'
      });
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
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
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
            onOrderClick={handleOrderClick}
            onStatusChange={handleStatusChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

