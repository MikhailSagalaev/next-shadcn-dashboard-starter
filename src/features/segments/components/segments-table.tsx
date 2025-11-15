/**
 * @file: src/features/segments/components/segments-table.tsx
 * @description: Таблица сегментов с фильтрами и пагинацией
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
  Edit,
  Trash2,
  Users,
  Filter
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

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  type: 'MANUAL' | 'AUTO' | 'DYNAMIC';
  isActive: boolean;
  memberCount: number;
  createdAt: Date;
  _count?: {
    members: number;
  };
}

interface SegmentsTableProps {
  data: Segment[];
  loading?: boolean;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSegmentClick?: (segment: Segment) => void;
  onEdit?: (segment: Segment) => void;
  onDelete?: (segmentId: string) => void;
  currentPage?: number;
  pageSize?: number;
}

const typeLabels: Record<string, string> = {
  MANUAL: 'Ручной',
  AUTO: 'Автоматический',
  DYNAMIC: 'Динамический',
};

const typeColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  MANUAL: 'secondary',
  AUTO: 'default',
  DYNAMIC: 'outline',
};

export function SegmentsTable({
  data,
  loading = false,
  totalCount = data.length,
  onPageChange,
  onPageSizeChange,
  onSegmentClick,
  onEdit,
  onDelete,
  currentPage = 1,
  pageSize = 20
}: SegmentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<Segment>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Название
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const segment = row.original;
        return (
          <div className='flex flex-col'>
            <span className='font-medium'>{segment.name}</span>
            {segment.description && (
              <span className='text-muted-foreground text-sm'>
                {segment.description}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Тип',
      cell: ({ row }) => {
        const type = row.getValue('type') as string;
        return (
          <Badge variant={typeColors[type] || 'default'}>
            {typeLabels[type] || type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'memberCount',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Участников
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const count = row.getValue('memberCount') as number;
        return (
          <div className='flex items-center'>
            <Users className='mr-2 h-4 w-4' />
            {count}
          </div>
        );
      },
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
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const segment = row.original;

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
              <DropdownMenuItem
                onClick={() => onSegmentClick?.(segment)}
              >
                <Eye className='mr-2 h-4 w-4' />
                Просмотр
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit?.(segment)}
              >
                <Edit className='mr-2 h-4 w-4' />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(segment.id)}
                className='text-destructive'
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-muted-foreground'>Загрузка...</div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
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
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(onPageChange || onPageSizeChange) && (
        <DataTablePagination
          table={table}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}

