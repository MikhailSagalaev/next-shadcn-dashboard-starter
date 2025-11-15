/**
 * @file: src/app/api/projects/[id]/chats/[chatId]/stream/route.ts
 * @description: SSE поток обновлений чата для real-time обновлений
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ChatManagerService } from '@/lib/services/chat-manager.service';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, chatId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Проверяем, что чат существует и принадлежит проекту
    const chat = await db.chat.findFirst({
      where: {
        id: chatId,
        projectId,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Чат не найден' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    let lastTimestamp = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60000); // Последняя минута по умолчанию

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        sendEvent('connected', { chatId, timestamp: new Date().toISOString() });

        let active = true;

        // Проверяем новые сообщения каждые 2 секунды
        const interval = setInterval(async () => {
          if (!active) {
            return;
          }

          try {
            const messages = await db.chatMessage.findMany({
              where: {
                chatId,
                createdAt: {
                  gt: lastTimestamp,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            });

            if (messages.length > 0) {
              const formattedMessages = messages.map((msg) => ({
                id: msg.id,
                message: msg.message,
                direction: msg.direction,
                senderName: msg.senderName,
                senderId: msg.senderId,
                createdAt: msg.createdAt.toISOString(),
                metadata: msg.metadata,
              }));

              sendEvent('messages', formattedMessages);

              // Обновляем последний timestamp
              lastTimestamp = messages[messages.length - 1].createdAt;

              // Обновляем статус чата
              const updatedChat = await db.chat.findUnique({
                where: { id: chatId },
                select: {
                  id: true,
                  status: true,
                  lastMessage: true,
                  lastMessageAt: true,
                  unreadCount: true,
                },
              });

              if (updatedChat) {
                sendEvent('chat_update', {
                  id: updatedChat.id,
                  status: updatedChat.status,
                  lastMessage: updatedChat.lastMessage,
                  lastMessageAt: updatedChat.lastMessageAt?.toISOString(),
                  unreadCount: updatedChat.unreadCount,
                });
              }
            }
          } catch (error) {
            console.error('Ошибка в SSE потоке чата:', error);
            sendEvent('error', { message: 'Ошибка получения сообщений' });
          }
        }, 2000);

        // Очистка при закрытии соединения
        request.signal.addEventListener('abort', () => {
          active = false;
          clearInterval(interval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка создания SSE потока' },
      { status: 500 }
    );
  }
}

