/**
 * @file: recent-transactions.tsx
 * @description: Таблица последних транзакций (Client Component)
 * @project: SaaS Bonus System
 * @created: 2026-01-21
 */

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Clock, XCircle } from 'lucide-react';
import type { BonusTransaction } from '../data-access';

interface RecentTransactionsProps {
  transactions: BonusTransaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
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

  if (transactions.length === 0) {
    return (
      <Card className='glass-card h-[400px] border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            Последние транзакции
          </CardTitle>
          <CardDescription>История операций с бонусами</CardDescription>
        </CardHeader>
        <CardContent className='flex h-[200px] items-center justify-center text-sm text-zinc-500'>
          Нет транзакций для отображения
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='glass-card h-[400px] border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Последние транзакции
        </CardTitle>
        <CardDescription>
          История операций с бонусами за последнее время
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='max-h-[280px] space-y-4 overflow-y-auto pr-2'>
          {transactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className='group flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-3 transition-all hover:border-indigo-100 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
            >
              <div className='flex items-center space-x-3'>
                <Avatar className='h-9 w-9'>
                  <AvatarFallback className='text-xs'>
                    {transaction.user.firstName?.[0] ||
                      transaction.user.email?.[0] ||
                      'U'}
                    {transaction.user.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>

                <div className='space-y-0.5'>
                  <p className='text-sm leading-none font-medium text-zinc-900 dark:text-zinc-100'>
                    {transaction.user.firstName && transaction.user.lastName
                      ? `${transaction.user.firstName} ${transaction.user.lastName}`
                      : transaction.user.email || 'Без имени'}
                  </p>
                  <div className='flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400'>
                    <span>{transaction.user.project.name}</span>
                    <span className='h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700' />
                    <span>
                      {formatDistanceToNow(new Date(transaction.createdAt), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-3'>
                <div className='text-right'>
                  <div className='flex items-center gap-1.5'>
                    {getTransactionIcon(transaction.type)}
                    <span
                      className={`text-sm font-semibold ${
                        transaction.type === 'EARNED' ||
                        transaction.type === 'REFUNDED'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {transaction.type === 'EARNED' ||
                      transaction.type === 'REFUNDED'
                        ? '+'
                        : '-'}
                      {Math.abs(transaction.amount)}
                    </span>
                  </div>
                  <p className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                    {transaction.description}
                  </p>
                </div>
                {getTransactionBadge(transaction.type)}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
