/**
 * @file: src/components/composite/data-table-builder.tsx
 * @description: Универсальный компонент таблицы с автоматической настройкой
 * @project: SaaS Bonus System
 * @dependencies: @tanstack/react-table, shadcn/ui
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { flexRender, Table as TableType } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './empty-state';
import { Database } from 'lucide-react';
import { DataTableFilter } from '@/hooks/use-data-table-builder';

export interface DataTableBuilderProps<TData> {
  table: TableType<TData>;
  loading?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function DataTableBuilder<TData>({
  table,
  loading = false,
  searchKey,
  searchPlaceholder = 'Поиск...',
  filters = [],
  onRowClick,
  emptyMessage = 'Нет данных',
  emptyDescription = 'Данные отсутствуют или не найдены'
}: DataTableBuilderProps<TData>) {
  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      {(searchKey || filters.length > 0) && (
        <div className='flex items-center gap-2'>
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={
                (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
              }
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className='max-w-sm'
            />
          )}

          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={
                (table.getColumn(filter.key)?.getFilterValue() as string) ?? ''
              }
              onValueChange={(value) =>
                table.getColumn(filter.key)?.setFilterValue(value)
              }
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      {/* Table */}
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
              // Loading skeleton
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  {table.getAllColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className='h-4 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              // Data rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer' : ''}
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
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className='h-24'
                >
                  <EmptyState
                    icon={Database}
                    title={emptyMessage}
                    description={emptyDescription}
                    size='sm'
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground text-sm'>
          {table.getFilteredSelectedRowModel().rows.length} из{' '}
          {table.getFilteredRowModel().rows.length} строк выбрано
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Назад
          </Button>
          <div className='text-sm'>
            Страница {table.getState().pagination.pageIndex + 1} из{' '}
            {table.getPageCount()}
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Вперед
          </Button>
        </div>
      </div>
    </div>
  );
}
