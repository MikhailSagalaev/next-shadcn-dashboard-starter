/**
 * @file: src/app/api/projects/[id]/orders/route.ts
 * @description: API для управления заказами проекта
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

const createOrderSchema = z.object({
  userId: z.string().optional(),
  orderNumber: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  totalAmount: z.number().positive(),
  paidAmount: z.number().min(0).optional(),
  bonusAmount: z.number().min(0).optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  deliveryMethod: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    total: z.number().positive(),
    metadata: z.record(z.any()).optional(),
  })).min(1),
});

const getOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(20).optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'status']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

// GET /api/projects/[id]/orders - Получение списка заказов
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим query параметры
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '20',
      userId: url.searchParams.get('userId') || undefined,
      status: url.searchParams.get('status') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      search: url.searchParams.get('search') || undefined,
      sortBy: url.searchParams.get('sortBy') || 'createdAt',
      sortOrder: url.searchParams.get('sortOrder') || 'desc',
    };

    // Валидация и преобразование параметров
    const validated = getOrdersQuerySchema.parse(queryParams);

    // Преобразуем статус
    let status: OrderStatus | OrderStatus[] | undefined;
    if (validated.status) {
      const statuses = validated.status.split(',');
      status = statuses.length === 1 
        ? (statuses[0] as OrderStatus)
        : (statuses as OrderStatus[]);
    }

    // Преобразуем даты
    const startDate = validated.startDate ? new Date(validated.startDate) : undefined;
    const endDate = validated.endDate ? new Date(validated.endDate) : undefined;

    const filters = {
      projectId,
      userId: validated.userId,
      status,
      startDate,
      endDate,
      search: validated.search,
      page: validated.page,
      pageSize: validated.pageSize,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder,
    };

    const result = await OrderService.getOrders(filters);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Ошибка получения списка заказов', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'GET',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные параметры запроса', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка получения заказов' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/orders - Создание нового заказа
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    // Парсим тело запроса
    const body = await request.json();

    // Валидация данных
    const validatedData = createOrderSchema.parse(body);

    // Создаем заказ
    const order = await OrderService.createOrder({
      projectId,
      ...validatedData,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    logger.error('Ошибка создания заказа', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'orders-api',
      action: 'POST',
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные заказа', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('уже существует')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка создания заказа' },
      { status: 500 }
    );
  }
}

