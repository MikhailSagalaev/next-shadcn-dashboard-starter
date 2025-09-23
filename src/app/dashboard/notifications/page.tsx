/**
 * @file: src/app/dashboard/notifications/page.tsx
 * @description: Страница системных уведомлений с современным дизайном
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React, UI components
 * @created: 2025-01-28
 * @updated: 2025-09-23
 * @author: AI Assistant + User
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import {
  NotificationCenter,
  type SystemNotification
} from '@/components/ui/notification-center';
import { Heading } from '@/components/ui/heading';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/system');

      if (response.ok) {
        const data = await response.json();
        // Преобразуем данные в нужный формат
        const transformedNotifications: SystemNotification[] =
          data.notifications.map((n: any) => ({
            ...n,
            createdAt: n.createdAt || new Date().toISOString(),
            status: n.status === 'dismissed' ? 'archived' : n.status
          }));
        setNotifications(transformedNotifications);
      } else {
        toast.error('Ошибка загрузки уведомлений');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Ошибка загрузки уведомлений');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/notifications/system/${notificationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' })
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, status: 'read' } : n
          )
        );
        toast.success('Уведомление отмечено как прочитанное');
      } else {
        toast.error('Ошибка обновления статуса');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(
        (n) => n.status === 'unread'
      );

      const promises = unreadNotifications.map((notification) =>
        fetch(`/api/notifications/system/${notification.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' })
        })
      );

      await Promise.all(promises);

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'read' as const }))
      );

      toast.success('Все уведомления отмечены как прочитанные');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleArchive = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/notifications/system/${notificationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dismissed' })
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, status: 'archived' } : n
          )
        );
        toast.success('Уведомление архивировано');
      } else {
        toast.error('Ошибка архивирования');
      }
    } catch (error) {
      console.error('Error archiving notification:', error);
      toast.error('Ошибка архивирования');
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/notifications/system/${notificationId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        toast.success('Уведомление удалено');
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Ошибка удаления');
    }
  };

  return (
    <PageContainer scrollable>
      <div className='flex flex-1 flex-col space-y-6'>
        {/* Back Button */}
        <div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => router.push('/dashboard')}
            className='mb-4'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Назад к панели управления
          </Button>
        </div>

        {/* Header */}
        <div>
          <Heading
            title='Системные уведомления'
            description='Центр уведомлений для отслеживания системных событий, безопасности и обновлений'
          />
        </div>

        {/* Notification Center */}
        <div className='flex-1'>
          <NotificationCenter
            notifications={notifications}
            loading={loading}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRefresh={loadNotifications}
            className='h-[calc(100vh-16rem)]'
          />
        </div>
      </div>
    </PageContainer>
  );
}
