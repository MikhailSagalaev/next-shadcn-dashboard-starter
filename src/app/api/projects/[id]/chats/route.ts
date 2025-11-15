/**
 * @file: src/app/api/projects/[id]/chats/route.ts
 * @description: API для управления чатами проекта
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { ChatManagerService } from '@/lib/services/chat-manager.service';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const chats = await db.chat.findMany({
      where: { projectId },
      include: {
        channel: true,
        user: true,
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ chats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения чатов' },
      { status: 500 }
    );
  }
}

