/**
 * @file: src/app/api/projects/[id]/orders/[orderId]/route.ts
 * @description: API для работы с отдельным заказом (GET, PUT, DELETE)
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

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  totalAmount: z.number().positive().optional(),
  paidAmount: z.number().min(0).optional(),
  bonusAmount: z.number().min(0).optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  deliveryMethod: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/projects/[id]/orders/[orderId] - Получение заказа по ID
export async function GET(
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

    // Получаем заказ
    const order = await OrderService.getOrderById(projectId, orderId);

    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    logger.error('Ошибка получения заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'GET',
    });

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Ошибка получения заказа' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/orders/[orderId] - Обновление заказа
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
    const validatedData = updateOrderSchema.parse(body);

    // Обновляем заказ
    const order = await OrderService.updateOrder(projectId, orderId, validatedData);

    return NextResponse.json(order);
  } catch (error) {
    logger.error('Ошибка обновления заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'PUT',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные заказа', details: error.errors },
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
      { error: 'Ошибка обновления заказа' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/orders/[orderId] - Удаление заказа
export async function DELETE(
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

    // Удаляем заказ (мягкое удаление)
    await OrderService.deleteOrder(projectId, orderId);

    return NextResponse.json(
      { message: 'Заказ успешно удален' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Ошибка удаления заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'DELETE',
    });

    if (error instanceof Error && error.message === 'Заказ не найден') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Ошибка удаления заказа' },
      { status: 500 }
    );
  }
}

