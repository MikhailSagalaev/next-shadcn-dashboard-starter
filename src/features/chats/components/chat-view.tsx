/**
 * @file: src/features/chats/components/chat-view.tsx
 * @description: Компонент просмотра чата с real-time обновлениями через SSE
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChatViewProps {
  projectId: string;
  chatId: string;
  chat?: {
    id: string;
    channel?: {
      name: string;
      type: string;
    };
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    };
    status: string;
  };
}

interface ChatMessage {
  id: string;
  message: string;
  direction: 'INCOMING' | 'OUTGOING';
  senderName?: string | null;
  senderId?: string | null;
  createdAt: string;
  metadata?: any;
}

export function ChatView({ projectId, chatId, chat }: ChatViewProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Загрузка сообщений
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/chats/${chatId}/messages?limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [projectId, chatId]);

  // SSE подключение для real-time обновлений
  useEffect(() => {
    if (!chatId) return;

    const eventSource = new EventSource(
      `/api/projects/${projectId}/chats/${chatId}/stream?since=${new Date(Date.now() - 60000).toISOString()}`
    );

    eventSource.addEventListener('connected', (event) => {
      console.log('SSE подключен:', event.data);
    });

    eventSource.addEventListener('messages', (event) => {
      try {
        const newMessages = JSON.parse(event.data) as ChatMessage[];
        if (Array.isArray(newMessages) && newMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.id));
            return [...prev, ...uniqueNewMessages].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        }
      } catch (error) {
        console.error('Ошибка парсинга сообщений:', error);
      }
    });

    eventSource.addEventListener('chat_update', (event) => {
      try {
        const update = JSON.parse(event.data);
        // Можно обновить статус чата, если нужно
        console.log('Обновление чата:', update);
      } catch (error) {
        console.error('Ошибка парсинга обновления чата:', error);
      }
    });

    eventSource.addEventListener('error', (event) => {
      console.error('Ошибка SSE:', event);
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [projectId, chatId]);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/chats/${chatId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: newMessage,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-muted-foreground'>Загрузка сообщений...</div>
      </div>
    );
  }

  return (
    <Card className='flex flex-col h-[600px]'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>
            {chat?.channel?.name || 'Чат'}
            {chat?.user && (
              <span className='text-sm text-muted-foreground font-normal ml-2'>
                {chat.user.firstName} {chat.user.lastName}
              </span>
            )}
          </CardTitle>
          <Badge variant={chat?.status === 'OPEN' ? 'default' : 'secondary'}>
            {chat?.status === 'OPEN' ? 'Открыт' : 'Закрыт'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='flex-1 flex flex-col p-0'>
        <ScrollArea className='flex-1 px-4'>
          <div className='space-y-4 py-4'>
            {messages.length === 0 ? (
              <div className='text-center text-muted-foreground py-8'>
                <MessageSquare className='mx-auto h-12 w-12 mb-2 opacity-50' />
                <p>Нет сообщений</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.direction === 'OUTGOING'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className='text-sm font-medium mb-1'>
                      {message.senderName || (message.direction === 'OUTGOING' ? 'Вы' : 'Пользователь')}
                    </div>
                    <div className='text-sm whitespace-pre-wrap'>{message.message}</div>
                    <div
                      className={`text-xs mt-1 ${
                        message.direction === 'OUTGOING'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {format(new Date(message.createdAt), 'HH:mm', { locale: ru })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <form onSubmit={handleSendMessage} className='p-4 border-t'>
          <div className='flex gap-2'>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder='Введите сообщение...'
              disabled={sending}
            />
            <Button type='submit' disabled={sending || !newMessage.trim()}>
              <Send className='h-4 w-4' />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

