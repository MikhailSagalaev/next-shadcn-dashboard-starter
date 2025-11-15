/**
 * @file: src/app/api/projects/[id]/orders/[orderId]/status/route.ts
 * @description: API для изменения статуса заказа
 * @project: SaaS Bonus System
 * @dependencies: Next.js API Routes, Prisma, OrderService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OrderService } from '@/lib/services/order.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';

const changeStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  comment: z.string().optional(),
  changedBy: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// PUT /api/projects/[id]/orders/[orderId]/status - Изменение статуса заказа
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, orderId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим тело запроса
    const body = await request.json();

    // Валидация данных
    const validatedData = changeStatusSchema.parse(body);

    // Изменяем статус заказа
    const order = await OrderService.changeOrderStatus(projectId, orderId, {
      ...validatedData,
      changedBy: validatedData.changedBy || admin.sub,
    });

    return NextResponse.json(order);
  } catch (error) {
    logger.error('Ошибка изменения статуса заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'PUT',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Заказ не найден') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Ошибка изменения статуса заказа' },
      { status: 500 }
    );
  }
}

