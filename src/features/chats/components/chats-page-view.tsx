/**
 * @file: src/features/chats/components/chats-page-view.tsx
 * @description: Компонент страницы управления чатами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface ChatsPageViewProps {
  projectId: string;
}

export function ChatsPageView({ projectId }: ChatsPageViewProps) {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/chats`)
      .then((res) => res.json())
      .then((data) => {
        setChats(data.chats || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex items-center justify-between'>
        <Heading title='Чаты' description='Управление чатами из различных мессенджеров' />
        <Button>
          <Plus className='mr-2 h-4 w-4' />
          Добавить канал
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
          ) : chats.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              Нет чатов
            </div>
          ) : (
            <div className='space-y-2'>
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className='border rounded p-4 cursor-pointer hover:bg-muted/50 transition-colors'
                  onClick={() => router.push(`/dashboard/projects/${projectId}/chats/${chat.id}`)}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <div className='font-medium'>{chat.channel?.name || 'Без названия'}</div>
                      <div className='text-sm text-muted-foreground truncate'>
                        {chat.lastMessage || 'Нет сообщений'}
                      </div>
                      {chat.user && (
                        <div className='text-xs text-muted-foreground mt-1'>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

