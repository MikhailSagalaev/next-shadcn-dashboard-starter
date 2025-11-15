/**
 * @file: src/features/orders/components/orders-table.tsx
 * @description: Таблица заказов с фильтрами и пагинацией
 * @project: SaaS Bonus System
 * @dependencies: TanStack Table, shadcn/ui, React
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import type { OrderWithRelations } from '@/types/orders';

interface OrdersTableProps {
  data: OrderWithRelations[];
  loading?: boolean;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onOrderClick?: (order: OrderWithRelations) => void;
  onStatusChange?: (orderId: string, status: string) => void;
  currentPage?: number;
  pageSize?: number;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  PROCESSING: 'default',
  SHIPPED: 'default',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
  REFUNDED: 'outline',
};

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
  REFUNDED: Archive,
};

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтвержден',
  PROCESSING: 'Обрабатывается',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
  REFUNDED: 'Возврат',
};

export function OrdersTable({
  data,
  loading = false,
  totalCount = data.length,
  onPageChange,
  onPageSizeChange,
  onOrderClick,
  onStatusChange,
  currentPage = 1,
  pageSize = 20
}: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ]);

  const columns: ColumnDef<OrderWithRelations>[] = [
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Номер заказа
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className='font-mono font-medium'>{order.orderNumber}</div>
        );
      }
    },
    {
      accessorKey: 'user',
      header: 'Клиент',
      cell: ({ row }) => {
        const user = row.original.user;
        if (!user) {
          return <span className='text-muted-foreground'>Гость</span>;
        }
        return (
          <div>
            <div className='font-medium'>
              {user.firstName || user.lastName
                ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                : user.email || user.phone || 'Без имени'}
            </div>
            {user.email && (
              <div className='text-muted-foreground text-sm'>{user.email}</div>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Статус
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const StatusIcon = statusIcons[status] || Clock;
        return (
          <Badge variant={statusColors[status] || 'secondary'}>
            <StatusIcon className='mr-1 h-3 w-3' />
            {statusLabels[status] || status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Сумма
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = row.getValue('totalAmount') as number;
        return (
          <div className='font-medium'>
            {new Intl.NumberFormat('ru-RU', {
              style: 'currency',
              currency: 'RUB'
            }).format(Number(amount))}
          </div>
        );
      }
    },
    {
      accessorKey: 'items',
      header: 'Товары',
      cell: ({ row }) => {
        const items = row.original.items || [];
        return (
          <div className='text-sm'>
            {items.length} {items.length === 1 ? 'товар' : 'товаров'}
          </div>
        );
      }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Дата
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.getValue('createdAt') as Date;
        return (
          <div className='text-sm'>
            {new Intl.DateTimeFormat('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(date))}
          </div>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const order = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Открыть меню</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onOrderClick?.(order)}>
                <Eye className='mr-2 h-4 w-4' />
                Просмотреть
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onStatusChange?.(order.id, 'CONFIRMED')}
                disabled={order.status === 'CONFIRMED'}
              >
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Подтвердить
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange?.(order.id, 'CANCELLED')}
                disabled={order.status === 'CANCELLED'}
              >
                <XCircle className='mr-2 h-4 w-4' />
                Отменить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
    initialState: {
      pagination: {
        pageIndex: currentPage - 1,
        pageSize
      }
    }
  });

  return (
    <div className='space-y-4'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='cursor-pointer'
                  onClick={() => onOrderClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Заказы не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}

