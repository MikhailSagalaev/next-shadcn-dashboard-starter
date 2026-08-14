/**
 * @file: src/features/chats/components/chats-page-view.tsx
 * @description: Компонент страницы управления чатами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ChatsPageViewProps {
  projectId: string;
}

export function ChatsPageView({ projectId }: ChatsPageViewProps) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/chats`)
      .then((res) => {
        if (!res.ok) throw new Error('Ошибка загрузки чатов');
        return res.json();
      })
      .then((data) => {
        setChats(data.chats || []);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [projectId]);

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex items-center justify-between'>
        <Heading
          title='Чаты'
          description='Управление чатами из различных мессенджеров'
        />
        <Button asChild>
          <Link href={`/dashboard/projects/${projectId}/integrations`}>
            <Plus className='mr-2 h-4 w-4' />
            Подключить канал
          </Link>
        </Button>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Чаты</CardTitle>
          <CardDescription>Всего: {chats.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Загрузка...</div>
          ) : loadError ? (
            <div className='space-y-3 py-8 text-center'>
              <p className='text-muted-foreground'>
                Не удалось загрузить чаты. Обновите страницу.
              </p>
            </div>
          ) : chats.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center'>
              Нет чатов
            </div>
          ) : (
            <div className='space-y-2'>
              {chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/dashboard/projects/${projectId}/chats/${chat.id}`}
                  className='hover:bg-muted/50 focus-visible:ring-ring block rounded border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <div className='font-medium'>
                        {chat.channel?.name || 'Без названия'}
                      </div>
                      <div className='text-muted-foreground truncate text-sm'>
                        {chat.lastMessage || 'Нет сообщений'}
                      </div>
                      {chat.user && (
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {chat.user.firstName} {chat.user.lastName}
                        </div>
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <Badge variant='default' className='ml-2'>
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
