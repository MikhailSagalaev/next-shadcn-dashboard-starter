/**
 * @file: src/app/api/projects/[id]/chats/[chatId]/messages/route.ts
 * @description: API для получения и отправки сообщений чата
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ChatManagerService } from '@/lib/services/chat-manager.service';
import { z } from 'zod';

const sendMessageSchema = z.object({
  message: z.string().min(1),
  senderName: z.string().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, chatId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const messages = await ChatManagerService.getChatMessages(
      projectId,
      chatId,
      {
        limit,
        offset
      }
    );

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения сообщений' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, chatId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const data = sendMessageSchema.parse(body);

    const message = await ChatManagerService.addMessageToChat(
      projectId,
      chatId,
      {
        chatId,
        message: data.message,
        direction: 'OUTGOING',
        senderName: data.senderName || admin.email || 'Администратор',
        senderId: admin.sub
      }
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка отправки сообщения' },
      { status: 500 }
    );
  }
}
