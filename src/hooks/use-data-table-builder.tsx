/**
 * @file: src/hooks/use-data-table-builder.ts
 * @description: Универсальный хук для построения таблиц с автоматической настройкой
 * @project: SaaS Bonus System
 * @dependencies: @tanstack/react-table, react
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { useApiQuery } from './use-api-query';

export interface DataTableColumn<TData = any> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'number' | 'date' | 'badge' | 'boolean' | 'custom';
  render?: (value: any, row: TData) => React.ReactNode;
  width?: string;
}

export interface DataTableFilter {
  key: string;
  label: string;
  type?: 'select' | 'boolean' | 'date';
  options?: Array<{ label: string; value: string }>;
}

export interface DataTableAction<TData = any> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: TData) => void;
  variant?: 'default' | 'destructive';
  show?: (row: TData) => boolean;
}

export interface UseDataTableBuilderOptions<TData = any> {
  // Data source
  data?: TData[];
  endpoint?: string;
  enabled?: boolean;

  // Columns
  columns: DataTableColumn<TData>[];

  // Search
  searchKey?: string;
  searchPlaceholder?: string;

  // Filters
  filters?: DataTableFilter[];

  // Actions
  actions?: DataTableAction<TData>[];

  // Pagination
  pageSize?: number;

  // Callbacks
  onRowClick?: (row: TData) => void;
}

export function useDataTableBuilder<TData = any>({
  data: initialData,
  endpoint,
  enabled = true,
  columns: columnDefs,
  searchKey,
  searchPlaceholder = 'Поиск...',
  filters = [],
  actions = [],
  pageSize = 10,
  onRowClick
}: UseDataTableBuilderOptions<TData>) {
  // Fetch data if endpoint provided
  const {
    data: fetchedData,
    loading,
    refetch
  } = useApiQuery<TData[]>({
    endpoint: endpoint || '',
    enabled: !!endpoint && enabled,
    showErrorToast: true
  });

  const data = endpoint ? fetchedData || [] : initialData || [];

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Build columns
  const columns = useMemo<ColumnDef<TData>[]>(() => {
    const cols: ColumnDef<TData>[] = columnDefs.map((col) => ({
      accessorKey: col.key,
      header: col.label,
      cell: ({ row }) => {
        const value = row.getValue(col.key);

        if (col.render) {
          return col.render(value, row.original);
        }

        // Default renderers based on type
        switch (col.type) {
          case 'date':
            return value
              ? new Date(value as string).toLocaleDateString('ru-RU')
              : '-';
          case 'number':
            return typeof value === 'number'
              ? value.toLocaleString('ru-RU')
              : '-';
          case 'boolean':
            return value ? 'Да' : 'Нет';
          case 'badge':
            return (
              <span className='bg-primary/10 rounded-full px-2 py-1 text-xs'>
                {String(value)}
              </span>
            );
          default:
            return value || '-';
        }
      },
      enableSorting: col.sortable !== false,
      enableColumnFilter: col.filterable !== false
    }));

    // Add actions column if actions provided
    if (actions.length > 0) {
      cols.push({
        id: 'actions',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            {actions
              .filter((action) => !action.show || action.show(row.original))
              .map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => action.onClick(row.original)}
                  className={`text-sm ${
                    action.variant === 'destructive'
                      ? 'text-destructive hover:text-destructive/80'
                      : 'text-primary hover:text-primary/80'
                  }`}
                >
                  {action.icon && <action.icon className='h-4 w-4' />}
                  {action.label}
                </button>
              ))}
          </div>
        )
      });
    }

    return cols;
  }, [columnDefs, actions]);

  // Create table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    initialState: {
      pagination: {
        pageSize
      }
    }
  });

  return {
    table,
    loading,
    refetch,
    searchKey,
    searchPlaceholder,
    filters,
    onRowClick
  };
}
