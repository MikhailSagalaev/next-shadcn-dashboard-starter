'use client';

/**
 * @file: src/components/super-admin/errors-table.tsx
 * @description: Таблица системных ошибок для супер-админки
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { useState, useEffect } from 'react';
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
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  source: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  } | null;
}

export function ErrorsTable() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stats, setStats] = useState<Record<string, number>>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
                  ...(levelFilter && levelFilter !== 'all' && { level: levelFilter }),
          ...(sourceFilter && sourceFilter !== 'all' && { source: sourceFilter })
      });

      const res = await fetch(`/api/super-admin/errors?${params}`);
      const data = await res.json();

      setLogs(data.logs || []);
      setTotal(data.pagination?.total || 0);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh каждые 30 секунд
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [page, limit, levelFilter, sourceFilter]);

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const columns: ColumnDef<ErrorLog>[] = [
    {
      accessorKey: 'level',
      header: 'Уровень',
      cell: ({ row }) => {
        const level = row.getValue('level') as string;
        return (
          <Badge variant={getLevelBadgeVariant(level)}>
            {level.toUpperCase()}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'message',
      header: 'Сообщение',
      cell: ({ row }) => {
        const message = row.getValue('message') as string;
        return (
          <div className='max-w-md truncate' title={message}>
            {message}
          </div>
        );
      }
    },
    {
      accessorKey: 'source',
      header: 'Источник',
      cell: ({ row }) => (
        <Badge variant='outline'>{row.getValue('source')}</Badge>
      )
    },
    {
      accessorKey: 'project.name',
      header: 'Проект',
      cell: ({ row }) => (
        <div className='text-sm'>
          {row.original.project?.name || 'Система'}
        </div>
      )
    },
    {
      accessorKey: 'createdAt',
      header: 'Дата',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return (
          <div className='text-sm'>
            {date.toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        );
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
    data: logs,
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
      {/* Статистика */}
      {Object.keys(stats).length > 0 && (
        <div className='grid gap-4 md:grid-cols-4'>
          {Object.entries(stats).map(([level, count]) => (
            <Card key={level}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  {level.toUpperCase()}
                </CardTitle>
                <AlertTriangle className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{count}</div>
                <p className='text-xs text-muted-foreground'>
                  За последние 24 часа
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Фильтры */}
      <div className='flex items-center gap-2'>
        <Select
          value={levelFilter}
          onValueChange={(value) => {
            setLevelFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Все уровни' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Все уровни</SelectItem>
            <SelectItem value='error'>Error</SelectItem>
            <SelectItem value='warn'>Warning</SelectItem>
            <SelectItem value='info'>Info</SelectItem>
            <SelectItem value='debug'>Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Все источники' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Все источники</SelectItem>
            <SelectItem value='bot'>Bot</SelectItem>
            <SelectItem value='webhook'>Webhook</SelectItem>
            <SelectItem value='api'>API</SelectItem>
            <SelectItem value='workflow'>Workflow</SelectItem>
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
                  Нет ошибок
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
        pageSizeOptions={[25, 50, 100]}
      />
    </div>
  );
}
