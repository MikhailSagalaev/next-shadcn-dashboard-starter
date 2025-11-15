/**
 * @file: src/app/api/projects/[id]/orders/[orderId]/history/route.ts
 * @description: API для получения истории заказа
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

// GET /api/projects/[id]/orders/[orderId]/history - Получение истории заказа
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

    // Проверяем, что заказ существует и принадлежит проекту
    const order = await OrderService.getOrderById(projectId, orderId);

    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }

    // Получаем историю заказа
    const history = await OrderService.getOrderHistory(orderId);

    return NextResponse.json(history);
  } catch (error) {
    logger.error('Ошибка получения истории заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'GET',
    });

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Ошибка получения истории заказа' },
      { status: 500 }
    );
  }
}

