/**
 * @file: notification-center.tsx
 * @description: Современный центр уведомлений с фильтрацией и группировкой
 * @project: SaaS Bonus System
 * @created: 2025-09-23
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Bot,
  Database,
  Shield,
  RefreshCw,
  Settings,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Check,
  Archive,
  Star,
  X,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface SystemNotification {
  id: string;
  type:
    | 'subscription'
    | 'bot'
    | 'security'
    | 'system'
    | 'billing'
    | 'user'
    | 'project';
  title: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt?: string;
  actionUrl?: string;
  actionText?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

const NOTIFICATION_TYPES = {
  subscription: {
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Подписка'
  },
  bot: {
    icon: Bot,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Telegram бот'
  },
  security: {
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Безопасность'
  },
  system: {
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    label: 'Система'
  },
  billing: {
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Биллинг'
  },
  user: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    label: 'Пользователи'
  },
  project: {
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    label: 'Проекты'
  }
};

const PRIORITY_CONFIG = {
  critical: {
    color: 'bg-red-500',
    label: 'Критично',
    textColor: 'text-red-700'
  },
  high: {
    color: 'bg-orange-500',
    label: 'Важно',
    textColor: 'text-orange-700'
  },
  medium: {
    color: 'bg-yellow-500',
    label: 'Средне',
    textColor: 'text-yellow-700'
  },
  low: {
    color: 'bg-green-500',
    label: 'Низко',
    textColor: 'text-green-700'
  }
};

interface NotificationCenterProps {
  notifications: SystemNotification[];
  loading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  className?: string;
}

export function NotificationCenter({
  notifications,
  loading = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onArchive,
  onDelete,
  onRefresh,
  className
}: NotificationCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');

  // Фильтрация и сортировка уведомлений
  const filteredNotifications = useMemo(() => {
    let filtered = notifications.filter((notification) => {
      const matchesSearch =
        searchQuery === '' ||
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || notification.status === statusFilter;
      const matchesType =
        typeFilter === 'all' || notification.type === typeFilter;
      const matchesPriority =
        priorityFilter === 'all' || notification.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });

    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [
    notifications,
    searchQuery,
    statusFilter,
    typeFilter,
    priorityFilter,
    sortBy
  ]);

  // Группировка по датам
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: SystemNotification[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filteredNotifications.forEach((notification) => {
      const notificationDate = new Date(notification.createdAt);
      let groupKey = '';

      if (notificationDate.toDateString() === today.toDateString()) {
        groupKey = 'Сегодня';
      } else if (notificationDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Вчера';
      } else {
        groupKey = notificationDate.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long'
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });

    return groups;
  }, [filteredNotifications]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;
  const criticalCount = notifications.filter(
    (n) => n.priority === 'critical'
  ).length;

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)} ч назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <Bell className='h-5 w-5' />
            <CardTitle>Уведомления</CardTitle>
            {unreadCount > 0 && (
              <Badge variant='destructive' className='text-xs'>
                {unreadCount}
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge
                variant='outline'
                className='border-red-300 text-xs text-red-600'
              >
                {criticalCount} критично
              </Badge>
            )}
          </div>
          <div className='flex items-center space-x-2'>
            {onRefresh && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onRefresh}
                disabled={loading}
                className='h-8 w-8 p-0'
              >
                <RefreshCw
                  className={cn('h-4 w-4', loading && 'animate-spin')}
                />
              </Button>
            )}
            {onMarkAllAsRead && unreadCount > 0 && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onMarkAllAsRead}
                className='text-xs'
              >
                Прочитать все
              </Button>
            )}
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className='space-y-3'>
          <div className='relative'>
            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <Input
              placeholder='Поиск уведомлений...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>

          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder='Статус' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все</SelectItem>
                <SelectItem value='unread'>Непрочитанные</SelectItem>
                <SelectItem value='read'>Прочитанные</SelectItem>
                <SelectItem value='archived'>Архивированные</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder='Тип' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Все типы</SelectItem>
                {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder='Приоритет' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Любой</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: 'date' | 'priority') => setSortBy(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Сортировка' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='date'>По дате</SelectItem>
                <SelectItem value='priority'>По приоритету</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className='flex-1 overflow-hidden p-0'>
        {loading ? (
          <div className='flex h-32 items-center justify-center'>
            <RefreshCw className='h-6 w-6 animate-spin' />
            <span className='ml-2'>Загрузка...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className='flex h-32 flex-col items-center justify-center text-gray-500'>
            <Bell className='mb-2 h-8 w-8' />
            <p>Уведомлений нет</p>
          </div>
        ) : (
          <div className='h-full overflow-y-auto px-6 pb-6'>
            {Object.entries(groupedNotifications).map(
              ([groupKey, groupNotifications]) => (
                <div key={groupKey} className='mb-6'>
                  <h3 className='sticky top-0 mb-3 bg-white py-2 text-sm font-medium text-gray-500'>
                    {groupKey}
                  </h3>
                  <div className='space-y-3'>
                    <AnimatePresence>
                      {groupNotifications.map((notification) => {
                        const typeConfig =
                          NOTIFICATION_TYPES[notification.type];
                        const priorityConfig =
                          PRIORITY_CONFIG[notification.priority];
                        const Icon = typeConfig.icon;

                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={cn(
                              'group relative rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md',
                              notification.status === 'unread' &&
                                'border-l-4 border-l-blue-500',
                              typeConfig.borderColor
                            )}
                          >
                            {/* Индикатор приоритета */}
                            {notification.priority !== 'low' && (
                              <div
                                className={cn(
                                  'absolute top-2 right-2 h-2 w-2 rounded-full',
                                  priorityConfig.color
                                )}
                              />
                            )}

                            <div className='flex items-start space-x-3'>
                              {/* Иконка типа */}
                              <div
                                className={cn(
                                  'rounded-full p-2',
                                  typeConfig.bgColor
                                )}
                              >
                                <Icon
                                  className={cn('h-4 w-4', typeConfig.color)}
                                />
                              </div>

                              {/* Контент */}
                              <div className='min-w-0 flex-1'>
                                <div className='flex items-start justify-between'>
                                  <div className='flex-1'>
                                    <h4 className='mb-1 text-sm font-medium text-gray-900'>
                                      {notification.title}
                                    </h4>
                                    <p className='line-clamp-2 text-sm text-gray-600'>
                                      {notification.message}
                                    </p>
                                  </div>

                                  {/* Меню действий */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100'
                                      >
                                        <MoreVertical className='h-4 w-4' />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end'>
                                      {notification.status === 'unread' &&
                                        onMarkAsRead && (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              onMarkAsRead(notification.id)
                                            }
                                          >
                                            <Eye className='mr-2 h-4 w-4' />
                                            Отметить как прочитанное
                                          </DropdownMenuItem>
                                        )}
                                      {onArchive && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onArchive(notification.id)
                                          }
                                        >
                                          <Archive className='mr-2 h-4 w-4' />
                                          Архивировать
                                        </DropdownMenuItem>
                                      )}
                                      {onDelete && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onDelete(notification.id)
                                          }
                                          className='text-red-600'
                                        >
                                          <Trash2 className='mr-2 h-4 w-4' />
                                          Удалить
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {/* Метаинформация */}
                                <div className='mt-2 flex items-center justify-between'>
                                  <div className='flex items-center space-x-2'>
                                    <Badge
                                      variant='outline'
                                      className='text-xs'
                                    >
                                      {typeConfig.label}
                                    </Badge>
                                    {notification.priority !== 'low' && (
                                      <Badge
                                        variant='outline'
                                        className={cn(
                                          'text-xs',
                                          priorityConfig.textColor
                                        )}
                                      >
                                        {priorityConfig.label}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className='text-xs text-gray-400'>
                                    {getRelativeTime(notification.createdAt)}
                                  </span>
                                </div>

                                {/* Кнопка действия */}
                                {notification.actionUrl &&
                                  notification.actionText && (
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      className='mt-2'
                                      onClick={() =>
                                        window.open(
                                          notification.actionUrl,
                                          '_blank'
                                        )
                                      }
                                    >
                                      {notification.actionText}
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
