/**
 * @file: route.ts
 * @description: Получение последних логов webhook для проекта
 * @project: SaaS Bonus System
 * @dependencies: NextRequest, NextResponse, db
 * @created: 2025-09-10
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Безопасное усечение больших тел
const safeJson = (obj: any, limit = 10000) => {
  try {
    const str = JSON.stringify(obj);
    if (str.length > limit) {
      return { _truncated: true, preview: str.slice(0, limit) } as any;
    }
    return obj;
  } catch {
    return { _error: 'serialization_failed' } as any;
  }
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  const logs = await db.webhookLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      endpoint: true,
      method: true,
      headers: true,
      status: true,
      success: true,
      createdAt: true,
      body: true,
      response: true
    }
  });

  return NextResponse.json({ logs });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const {
      endpoint,
      method,
      headers,
      body: requestBody,
      response,
      status,
      success
    } = body;

    if (!endpoint || !method || !requestBody) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'INVALID_REQUEST',
            message: 'Недостаточно данных для создания лога'
          }
        },
        { status: 400 }
      );
    }

    // Создаем новый лог
    const newLog = await db.webhookLog.create({
      data: {
        projectId: id,
        endpoint,
        method,
        headers: safeJson(headers),
        body: safeJson(requestBody),
        response: safeJson(response),
        status: status || 200,
        success: success !== undefined ? success : true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Лог успешно создан',
      log: newLog
    });
  } catch (error) {
    console.error('❌ Ошибка при создании лога:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'CREATE_ERROR',
          message:
            error instanceof Error ? error.message : 'Неизвестная ошибка',
          details: error instanceof Error ? error.stack : String(error)
        }
      },
      { status: 500 }
    );
  }
}
