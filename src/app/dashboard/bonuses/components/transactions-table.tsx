/**
 * @file: transactions-table.tsx
 * @description: Таблица транзакций с пагинацией и фильтрами (Client Component)
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import type { BonusTransaction } from '../data-access';

interface TransactionsTableProps {
  transactions: BonusTransaction[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export function TransactionsTable({
  transactions,
  total,
  currentPage,
  pageSize,
  totalPages
}: TransactionsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('search') || ''
  );
  const [typeFilter, setTypeFilter] = useState(
    searchParams.get('type') || 'ALL'
  );

  const handleDebouncedSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('search', term);
    } else {
      params.delete('search');
    }
    params.set('page', '1'); // Reset to first page
    router.push(`?${params.toString()}`);
  }, 400);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      handleDebouncedSearch(value);
    },
    [handleDebouncedSearch]
  );

  const handleTypeFilter = useCallback(
    (value: string) => {
      setTypeFilter(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value !== 'ALL') {
        params.set('type', value);
      } else {
        params.delete('type');
      }
      params.set('page', '1');
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'EARN':
        return <ArrowUpCircle className='h-4 w-4 text-emerald-500' />;
      case 'SPEND':
        return <ArrowDownCircle className='h-4 w-4 text-rose-500' />;
      case 'EXPIRE':
        return <Clock className='h-4 w-4 text-amber-500' />;
      case 'REFUND':
        return <XCircle className='h-4 w-4 text-blue-500' />;
      default:
        return null;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'EARN':
        return (
          <Badge className='bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'>
            Начислено
          </Badge>
        );
      case 'SPEND':
        return (
          <Badge className='bg-rose-500/10 text-rose-700 dark:text-rose-400'>
            Списано
          </Badge>
        );
      case 'EXPIRE':
        return (
          <Badge className='bg-amber-500/10 text-amber-700 dark:text-amber-400'>
            Истекло
          </Badge>
        );
      case 'REFUND':
        return (
          <Badge className='bg-blue-500/10 text-blue-700 dark:text-blue-400'>
            Возврат
          </Badge>
        );
      default:
        return <Badge variant='secondary'>{type}</Badge>;
    }
  };

  return (
    <div className='space-y-4'>
      {/* Filters */}
      <div className='flex items-center gap-4'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            type='text'
            placeholder='Поиск по пользователю...'
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className='pl-10'
          />
        </div>

        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Тип транзакции' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>Все типы</SelectItem>
            <SelectItem value='EARN'>Начисление</SelectItem>
            <SelectItem value='SPEND'>Списание</SelectItem>
            <SelectItem value='EXPIRE'>Истечение</SelectItem>
            <SelectItem value='REFUND'>Возврат</SelectItem>
          </SelectContent>
        </Select>

        <div className='text-sm text-zinc-500 dark:text-zinc-400'>
          Всего: {total} транзакций
        </div>
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800'>
        <Table>
          <TableHeader className='bg-zinc-50 dark:bg-zinc-900'>
            <TableRow>
              <TableHead className='w-[250px]'>Пользователь</TableHead>
              <TableHead className='w-[200px]'>Проект</TableHead>
              <TableHead className='w-[120px]'>Тип</TableHead>
              <TableHead className='w-[120px] text-right'>Сумма</TableHead>
              <TableHead className='w-[180px]'>Дата</TableHead>
              <TableHead>Описание</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='h-24 text-center text-zinc-500'
                >
                  Транзакции не найдены
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className='hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                >
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <Avatar className='h-8 w-8'>
                        <AvatarFallback className='text-xs'>
                          {transaction.user.firstName?.[0] ||
                            transaction.user.email?.[0] ||
                            'U'}
                          {transaction.user.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className='text-sm font-medium'>
                          {transaction.user.firstName &&
                          transaction.user.lastName
                            ? `${transaction.user.firstName} ${transaction.user.lastName}`
                            : transaction.user.email || 'Без имени'}
                        </p>
                        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                          {transaction.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className='text-sm text-zinc-700 dark:text-zinc-300'>
                      {transaction.user.project.name}
                    </span>
                  </TableCell>
                  <TableCell>{getTransactionBadge(transaction.type)}</TableCell>
                  <TableCell className='text-right'>
                    <div className='flex items-center justify-end gap-1.5'>
                      {getTransactionIcon(transaction.type)}
                      <span
                        className={`text-sm font-semibold ${
                          transaction.type === 'EARN' ||
                          transaction.type === 'REFUND'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {transaction.type === 'EARN' ||
                        transaction.type === 'REFUND'
                          ? '+'
                          : '-'}
                        {Math.abs(transaction.amount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                      {formatDistanceToNow(new Date(transaction.createdAt), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                      {transaction.description}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <div className='text-sm text-zinc-500 dark:text-zinc-400'>
            Страница {currentPage} из {totalPages}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className='h-4 w-4' />
              Назад
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Вперед
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
