'use client';

/**
 * @file: src/components/layout/notification-bell.tsx
 * @description: Колокольчик in-app уведомлений админа (план 009, core).
 *   Бейдж непрочитанного, поллинг счётчика ~45с, popover с лентой, отметка
 *   прочитанным и переход по ссылке. Производители событий — отдельный шаг.
 * @project: SaaS Bonus System
 */

import * as React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Severity = 'info' | 'success' | 'warning' | 'error';

interface AdminNotificationItem {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 45_000;

const SEVERITY_DOT: Record<Severity, string> = {
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500'
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);

  if (diffSec < 60) return 'только что';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ч назад`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [items, setItems] = React.useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchCount = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/admin?unread=true&limit=1', {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // тихо игнорируем сетевые сбои поллинга
    }
  }, []);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/admin?limit=20', {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // тихо игнорируем
    } finally {
      setLoading(false);
    }
  }, []);

  // Поллинг счётчика непрочитанного.
  React.useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // Полный список при открытии popover.
  React.useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  const markRead = React.useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const res = await fetch('/api/notifications/admin/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
        setItems((prev) =>
          prev.map((n) =>
            ids.includes(n.id) && !n.readAt
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        );
      }
    } catch {
      // тихо игнорируем
    }
  }, []);

  const markAllRead = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/admin/read-all', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((n) => (n.readAt ? n : { ...n, readAt: now }))
        );
      }
    } catch {
      // тихо игнорируем
    }
  }, []);

  const handleItemClick = React.useCallback(
    async (n: AdminNotificationItem) => {
      if (!n.readAt) await markRead([n.id]);
      if (n.link) {
        setOpen(false);
        router.push(n.link);
      }
    },
    [markRead, router]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative h-8 w-8'
          aria-label='Уведомления'
        >
          <Bell className='h-4 w-4' />
          {unreadCount > 0 && (
            <span className='bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' sideOffset={10} className='w-80 p-0'>
        <div className='flex items-center justify-between border-b px-4 py-3'>
          <span className='text-sm font-medium'>Уведомления</span>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className='mr-1 h-3 w-3' />
            Прочитать всё
          </Button>
        </div>

        <ScrollArea className='h-80'>
          {loading && items.length === 0 ? (
            <div className='text-muted-foreground px-4 py-8 text-center text-sm'>
              Загрузка…
            </div>
          ) : items.length === 0 ? (
            <div className='text-muted-foreground px-4 py-8 text-center text-sm'>
              Нет уведомлений
            </div>
          ) : (
            <ul className='divide-y'>
              {items.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type='button'
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        'hover:bg-accent flex w-full items-start gap-2 px-4 py-3 text-left transition-colors',
                        isUnread && 'bg-accent/40'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          SEVERITY_DOT[n.severity] ?? SEVERITY_DOT.info,
                          !isUnread && 'opacity-30'
                        )}
                      />
                      <span className='min-w-0 flex-1'>
                        <span className='flex items-center justify-between gap-2'>
                          <span
                            className={cn(
                              'truncate text-sm',
                              isUnread ? 'font-medium' : 'font-normal'
                            )}
                          >
                            {n.title}
                          </span>
                          <span className='text-muted-foreground shrink-0 text-[11px]'>
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </span>
                        <span className='text-muted-foreground mt-0.5 line-clamp-2 block text-xs'>
                          {n.message}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
