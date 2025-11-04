/**
 * @file: src/app/api/logs/route.ts
 * @description: API endpoint для приема логов с клиента и сервера
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Zod
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Схема валидации логов
const logSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']),
  message: z.string().min(1).max(5000),
  source: z.string().min(1).max(100),
  context: z.record(z.any()).optional(),
  projectId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  stack: z.string().max(10000).optional()
});

// Rate limiting: максимум 100 запросов за 1 минуту с одного IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    // Получаем IP адрес клиента
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';

    // Проверка rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Парсинг и валидация тела запроса
    const body = await request.json();
    const validatedData = logSchema.parse(body);

    // Запись в SystemLog
    const logEntry = await db.systemLog.create({
      data: {
        level: validatedData.level,
        message: validatedData.message,
        source: validatedData.source,
        context: validatedData.context || null,
        projectId: validatedData.projectId || null,
        userId: validatedData.userId || null,
        stack: validatedData.stack || null
      }
    });

    return NextResponse.json(
      { success: true, id: logEntry.id },
      { status: 201 }
    );
  } catch (error) {
    // Ошибки валидации
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid log data', details: error.errors },
        { status: 400 }
      );
    }

    // Другие ошибки
    console.error('Error creating log entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
