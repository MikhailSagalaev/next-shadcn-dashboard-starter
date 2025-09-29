'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  User,
  Plus,
  Minus,
  Settings,
  Clock,
  Calendar
} from 'lucide-react';
import { useBonusStore } from '../stores/bonus-store';
import type { DisplayUser as UserType, BonusTransaction } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface UserTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType;
}

const getTransactionIcon = (type: BonusTransaction['type']) => {
  switch (type) {
    case 'EARN':
      return <Plus className='h-4 w-4 text-green-500' />;
    case 'SPEND':
      return <Minus className='h-4 w-4 text-red-500' />;
    case 'EXPIRE':
      return <Clock className='h-4 w-4 text-gray-500' />;
    case 'ADMIN_ADJUST':
      return <Settings className='h-4 w-4 text-blue-500' />;
    default:
      return <History className='h-4 w-4' />;
  }
};

const getTransactionColor = (type: BonusTransaction['type']) => {
  switch (type) {
    case 'EARN':
      return 'text-green-600';
    case 'SPEND':
      return 'text-red-600';
    case 'EXPIRE':
      return 'text-gray-600';
    case 'ADMIN_ADJUST':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

const getTransactionBadgeVariant = (type: BonusTransaction['type']) => {
  switch (type) {
    case 'EARN':
      return 'default';
    case 'SPEND':
      return 'destructive';
    case 'EXPIRE':
      return 'secondary';
    case 'ADMIN_ADJUST':
      return 'outline';
    default:
      return 'secondary';
  }
};

const getTransactionTypeLabel = (type: BonusTransaction['type']) => {
  switch (type) {
    case 'EARN':
      return 'Начисление';
    case 'SPEND':
      return 'Списание';
    case 'EXPIRE':
      return 'Истечение';
    case 'ADMIN_ADJUST':
      return 'Коррекция';
    default:
      return type;
  }
};

export function UserTransactionsDialog({
  open,
  onOpenChange,
  user
}: UserTransactionsDialogProps) {
  const { getUserTransactions } = useBonusStore();

  const userTransactions = getUserTransactions(user.id);
  const sortedTransactions = userTransactions.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Группировка транзакций по типам для статистики
  const stats = userTransactions.reduce(
    (acc, transaction) => {
      acc[transaction.type] = (acc[transaction.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] sm:max-w-[700px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <History className='h-5 w-5' />
            История транзакций
          </DialogTitle>
          <DialogDescription>
            Все операции с бонусами пользователя
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Информация о пользователе */}
          <div className='bg-muted/50 rounded-lg border p-4'>
            <div className='mb-3 flex items-center gap-3'>
              <Avatar className='h-12 w-12'>
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback>
                  <User className='h-6 w-6' />
                </AvatarFallback>
              </Avatar>
              <div className='flex-1'>
                <h4 className='text-lg font-semibold'>{user.name}</h4>
                <p className='text-muted-foreground text-sm'>{user.email}</p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Текущий баланс</p>
                <Badge variant='secondary' className='text-lg font-bold'>
                  {user.bonusBalance.toLocaleString()} бонусов
                </Badge>
              </div>
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Всего заработано</p>
                <Badge variant='outline' className='text-lg'>
                  {user.totalEarned.toLocaleString()} бонусов
                </Badge>
              </div>
            </div>
          </div>

          {/* Статистика транзакций */}
          <div className='grid grid-cols-4 gap-4'>
            <div className='rounded-lg border p-3 text-center'>
              <div className='text-2xl font-bold text-green-600'>
                {stats.EARN || 0}
              </div>
              <div className='text-muted-foreground text-xs'>Начислений</div>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <div className='text-2xl font-bold text-red-600'>
                {stats.SPEND || 0}
              </div>
              <div className='text-muted-foreground text-xs'>Списаний</div>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <div className='text-2xl font-bold text-gray-600'>
                {stats.EXPIRE || 0}
              </div>
              <div className='text-muted-foreground text-xs'>Истечений</div>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <div className='text-2xl font-bold text-blue-600'>
                {stats.ADMIN_ADJUST || 0}
              </div>
              <div className='text-muted-foreground text-xs'>Коррекций</div>
            </div>
          </div>

          {/* Список транзакций */}
          <div className='space-y-2'>
            <h4 className='flex items-center gap-2 text-sm font-medium'>
              <Calendar className='h-4 w-4' />
              Транзакции ({sortedTransactions.length})
            </h4>

            {sortedTransactions.length === 0 ? (
              <div className='text-muted-foreground py-8 text-center'>
                <History className='mx-auto mb-2 h-12 w-12 opacity-50' />
                <p>История транзакций пуста</p>
              </div>
            ) : (
              <ScrollArea className='h-96 w-full rounded-md border p-4'>
                <div className='space-y-4'>
                  {sortedTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className='bg-card flex items-start gap-3 rounded-lg border p-3'
                    >
                      <div className='mt-0.5'>
                        {getTransactionIcon(transaction.type)}
                      </div>

                      <div className='min-w-0 flex-1'>
                        <div className='mb-1 flex items-center gap-2'>
                          <Badge
                            variant={getTransactionBadgeVariant(
                              transaction.type
                            )}
                            className='text-xs'
                          >
                            {getTransactionTypeLabel(transaction.type)}
                          </Badge>
                          <span className='text-muted-foreground text-xs'>
                            {formatDistanceToNow(transaction.createdAt, {
                              addSuffix: true,
                              locale: ru
                            })}
                          </span>
                        </div>

                        <p className='mb-1 text-sm font-medium'>
                          {transaction.description}
                        </p>

                        {transaction.expiresAt && (
                          <div className='flex items-center gap-1 text-xs text-amber-600'>
                            <Clock className='h-3 w-3' />
                            Истекает:{' '}
                            {transaction.expiresAt.toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </div>

                      <div className='text-right'>
                        <div
                          className={`text-lg font-bold ${getTransactionColor(transaction.type)}`}
                        >
                          {transaction.amount > 0 ? '+' : ''}
                          {transaction.amount.toLocaleString()}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {transaction.createdAt.toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
