'use client';

/**
 * @file: src/components/super-admin/admin-users-table.tsx
 * @description: Таблица администраторов для супер-админки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { useState, useEffect } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { Search, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, CreditCard } from 'lucide-react';
import { SubscriptionDialog } from './subscription-dialog';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  projectsCount: number;
}

export function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
  }, 400);

  useEffect(() => {
    debouncedSetSearch(search);
  }, [search, debouncedSetSearch]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(roleFilter && roleFilter !== 'all' && { role: roleFilter }),
        ...(activeFilter &&
          activeFilter !== 'all' && { isActive: activeFilter })
      });

      const res = await fetch(`/api/super-admin/users?${params}`);
      const data = await res.json();

      setUsers(data.users || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, limit, debouncedSearch, roleFilter, activeFilter]);

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className='font-medium'>{row.getValue('email')}</div>
      )
    },
    {
      accessorKey: 'role',
      header: 'Роль',
      cell: ({ row }) => {
        const role = row.getValue('role') as string;
        return (
          <Badge variant={role === 'SUPERADMIN' ? 'destructive' : 'default'}>
            {role}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'isActive',
      header: 'Статус',
      cell: ({ row }) => {
        const isActive = row.getValue('isActive') as boolean;
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Активен' : 'Неактивен'}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'emailVerified',
      header: 'Статус Email',
      cell: ({ row }) => {
        const verified = row.getValue('emailVerified') as boolean;
        return (
          <Badge variant={verified ? 'default' : 'outline'}>
            {verified ? 'Подтвержден' : 'Не подтвержден'}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'projectsCount',
      header: 'Проектов',
      cell: ({ row }) => (
        <div className='text-center'>{row.getValue('projectsCount')}</div>
      )
    },
    {
      accessorKey: 'createdAt',
      header: 'Дата создания',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return <div>{date.toLocaleDateString('ru-RU')}</div>;
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original;
        return <UserActions user={user} />;
      }
    }
  ];

  function UserActions({ user }: { user: AdminUser }) {
    const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Действия</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setShowSubscriptionDialog(true)}>
              <CreditCard className='mr-2 h-4 w-4' />
              Выдать подписку
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className='text-muted-foreground' disabled>
              Редактировать
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showSubscriptionDialog && (
          <SubscriptionDialog
            open={showSubscriptionDialog}
            onOpenChange={setShowSubscriptionDialog}
            onSuccess={() => {
              toast.success('Подписка успешно выдана');
              fetchUsers();
            }}
            initialAdminId={user.id}
          />
        )}
      </>
    );
  }

  const [pagination, setPagination] = useState({
    pageIndex: page - 1,
    pageSize: limit
  });

  useEffect(() => {
    setPagination({
      pageIndex: page - 1,
      pageSize: limit
    });
  }, [page, limit]);

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting, pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: Math.ceil(total / limit)
  });

  return (
    <div className='space-y-4'>
      {/* Фильтры */}
      <div className='flex items-center gap-2'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Поиск по email...'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Сбрасываем на первую страницу при поиске
            }}
            className='pl-9'
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Все роли' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Все роли</SelectItem>
            <SelectItem value='SUPERADMIN'>SUPERADMIN</SelectItem>
            <SelectItem value='ADMIN'>ADMIN</SelectItem>
            <SelectItem value='MANAGER'>MANAGER</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(value) => {
            setActiveFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Все статусы' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Все статусы</SelectItem>
            <SelectItem value='true'>Активные</SelectItem>
            <SelectItem value='false'>Неактивные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Таблица */}
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
                  <Loader2 className='mx-auto h-6 w-6 animate-spin' />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Пагинация */}
      <DataTablePagination
        table={table}
        totalCount={total}
        onPageChange={(newPage) => {
          setPage(newPage);
          setPagination({ pageIndex: newPage - 1, pageSize: limit });
        }}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
          setPagination({ pageIndex: 0, pageSize: newLimit });
        }}
      />
    </div>
  );
}
