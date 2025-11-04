'use client';

/**
 * @file: src/components/super-admin/bots-table.tsx
 * @description: Таблица ботов для супер-админки
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
import { Input } from '@/components/ui/input';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { Search, Loader2, Bot } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface BotData {
  id: string;
  botUsername: string;
  isActive: boolean;
  createdAt: string;
  project: {
    id: string;
    name: string;
    domain: string | null;
  };
}

export function BotsTable() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
  }, 400);

  useEffect(() => {
    debouncedSetSearch(search);
  }, [search, debouncedSetSearch]);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(activeFilter && activeFilter !== 'all' && { isActive: activeFilter })
      });

      const res = await fetch(`/api/super-admin/bots?${params}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('API error:', res.status, errorData);
        setBots([]);
        setTotal(0);
        return;
      }

      const data = await res.json();
      console.log('Bots API response:', { 
        botsCount: data.bots?.length || 0, 
        total: data.pagination?.total || 0,
        data 
      });

      setBots(data.bots || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching bots:', error);
      setBots([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, activeFilter]);

  const columns: ColumnDef<BotData>[] = [
          {
        accessorKey: 'botUsername',
        header: 'Бот',
        cell: ({ row }) => {
          const username = row.getValue('botUsername') as string;
          const displayUsername = username && username.trim() ? username : 'Не указан';
          return (
            <div className='flex items-center gap-2'>
              <Bot className='h-4 w-4' />
              <span className='font-medium'>
                {username && username.trim() ? `@${username}` : displayUsername}
              </span>
            </div>
          );
        }
      },
    {
      accessorKey: 'project.name',
      header: 'Проект',
      cell: ({ row }) => (
        <div className='font-medium'>{row.original.project.name}</div>
      )
    },
    {
      accessorKey: 'project.domain',
      header: 'Домен',
      cell: ({ row }) => (
        <div className='text-muted-foreground text-sm'>
          {row.original.project.domain || '-'}
        </div>
      )
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
      accessorKey: 'createdAt',
      header: 'Дата создания',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return <div>{date.toLocaleDateString('ru-RU')}</div>;
      }
    }
  ];

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
    data: bots,
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
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Поиск по боту или проекту...'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className='pl-9'
          />
        </div>
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
                <TableCell colSpan={columns.length} className='h-24 text-center'>
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
                  <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                    <Bot className='h-8 w-8' />
                    <div>
                      <p className='font-medium'>Боты не найдены</p>
                      <p className='text-sm mt-1'>
                        В системе нет настроенных ботов. Настройте ботов в настройках проектов.
                      </p>
                    </div>
                  </div>
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
