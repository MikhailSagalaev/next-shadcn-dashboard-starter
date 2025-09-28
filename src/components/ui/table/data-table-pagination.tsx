import type { Table } from '@tanstack/react-table';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  totalCount,
  onPageChange,
  onPageSizeChange,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageSize = table.getState().pagination.pageSize;
  const totalPages = totalCount
    ? Math.ceil(totalCount / pageSize)
    : table.getPageCount();
  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
        className
      )}
      {...props}
    >
      <div className='text-muted-foreground flex-1 text-sm whitespace-nowrap'>
        {table.getFilteredSelectedRowModel().rows.length > 0 ? (
          <>
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </>
        ) : (
          <>{table.getFilteredRowModel().rows.length} row(s) total.</>
        )}
      </div>
      <div className='flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8'>
        <div className='flex items-center space-x-2'>
          <p className='text-sm font-medium whitespace-nowrap'>Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              const newPageSize = Number(value);
              table.setPageSize(newPageSize);
              onPageSizeChange?.(newPageSize);
            }}
          >
            <SelectTrigger className='h-8 w-[4.5rem] [&[data-size]]:h-8'>
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center justify-center text-sm font-medium'>
          Page {currentPage} of {totalPages}
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            aria-label='Go to first page'
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => onPageChange?.(1)}
            disabled={currentPage <= 1}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label='Go to previous page'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label='Go to next page'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            aria-label='Go to last page'
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => onPageChange?.(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
