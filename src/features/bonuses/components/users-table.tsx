/**
 * @file: users-table.tsx
 * @description: Таблица пользователей с фильтрами и пагинацией
 * @project: SaaS Bonus System
 * @dependencies: TanStack Table, shadcn/ui, React
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect } from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  History,
  Eye,
  Coins
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import type { DisplayUser as User } from '../types';

interface UsersTableProps {
  data: User[];
  onExport: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onProfileClick?: (user: User) => void;
  onHistoryClick?: (userId: string) => void;
  loading?: boolean;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  currentPage?: number;
  pageSize?: number;
}

export function UsersTable({
  data,
  onExport,
  onSelectionChange,
  onProfileClick,
  onHistoryClick,
  loading = false,
  totalCount = data.length,
  onPageChange,
  onPageSizeChange,
  currentPage = 1,
  pageSize = 50
}: UsersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: currentPage - 1,
    pageSize
  });

  // Синхронизируем внутреннюю пагинацию с внешней
  useEffect(() => {
    setPagination({
      pageIndex: currentPage - 1,
      pageSize
    });
  }, [currentPage, pageSize]);

  // Обработчик изменений пагинации
  useEffect(() => {
    const newPage = pagination.pageIndex + 1;
    const newPageSize = pagination.pageSize;

    // Вызываем внешние обработчики только если значения изменились
    // и только если это изменение от пользовательского взаимодействия, а не от синхронизации
    if (
      newPage !== currentPage &&
      onPageChange &&
      Math.abs(newPage - currentPage) === 1
    ) {
      onPageChange(newPage);
    }
    if (newPageSize !== pageSize && onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    currentPage,
    pageSize,
    onPageChange,
    onPageSizeChange
  ]);

  const columns: ColumnDef<User>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40
    },
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Пользователь
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const user = row.original;
        const initials =
          `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
          'U';

        return (
          <div className='flex items-center space-x-3'>
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src={`https://api.slingacademy.com/public/sample-users/${(parseInt(user.id.slice(-2), 16) % 10) + 1}.png`}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className='font-medium'>{user.name}</div>
              <div className='text-muted-foreground text-sm'>
                ID: {user.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'email',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Email
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className='font-mono text-sm'>{row.getValue('email') || '-'}</div>
      )
    },
    {
      accessorKey: 'phone',
      header: 'Телефон',
      cell: ({ row }) => (
        <div className='font-mono text-sm'>{row.getValue('phone') || '-'}</div>
      )
    },
    {
      accessorKey: 'bonusBalance',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Активные бонусы
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const balance = row.getValue('bonusBalance') as number;
        return (
          <Badge variant={balance > 0 ? 'default' : 'secondary'}>
            {balance.toFixed(0)} ₽
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        const balance = row.getValue(id) as number;
        return balance >= (value as number);
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
            Регистрация
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.getValue('createdAt') as Date;
        return (
          <div className='text-muted-foreground text-sm'>
            {date.toLocaleDateString('ru-RU')}
          </div>
        );
      }
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const user = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Open menu</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onHistoryClick(user.id)}>
                <Coins className='mr-2 h-4 w-4' />
                История бонусов
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onProfileClick?.(user)}>
                <Eye className='mr-2 h-4 w-4' />
                Просмотреть профиль
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
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination
    },
    manualPagination: true, // Отключаем внутреннюю пагинацию
    pageCount: Math.ceil(totalCount / pageSize) // Указываем общее количество страниц
  });

  // Обработчик изменений выбора
  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows;
      const selectedIds = selectedRows.map((row) => row.original.id);
      onSelectionChange(selectedIds);
    }
  }, [rowSelection, table, onSelectionChange]);

  return (
    <div className='space-y-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Поиск пользователей...'
        searchColumn='name'
        onExport={onExport}
      />

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
              // Loading state
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className='bg-muted h-4 w-4 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center space-x-3'>
                      <div className='bg-muted h-8 w-8 animate-pulse rounded-full' />
                      <div className='space-y-1'>
                        <div className='bg-muted h-4 w-32 animate-pulse rounded' />
                        <div className='bg-muted h-3 w-20 animate-pulse rounded' />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-48 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-32 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-16 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-4 w-24 animate-pulse rounded' />
                  </TableCell>
                  <TableCell>
                    <div className='bg-muted h-6 w-6 animate-pulse rounded' />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
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
                  Пользователи не найдены.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        table={table}
        totalCount={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
