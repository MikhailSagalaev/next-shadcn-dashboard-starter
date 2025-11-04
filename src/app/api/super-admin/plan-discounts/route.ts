/**
 * @file: src/app/api/super-admin/plan-discounts/route.ts
 * @description: API для управления скидками на планы
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/super-admin/plan-discounts
 * Получить список скидок
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (planId) where.planId = planId;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const discounts = await db.planDiscount.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({ discounts });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error fetching plan discounts', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при получении скидок' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/plan-discounts
 * Создать скидку
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();

    if (!body.planId || !body.name || !body.discountType || !body.discountValue) {
      return NextResponse.json(
        { error: 'Обязательные поля: planId, name, discountType, discountValue' },
        { status: 400 }
      );
    }

    const discount = await db.planDiscount.create({
      data: {
        planId: body.planId,
        name: body.name,
        description: body.description,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minMonths: body.minMonths,
        validFrom: new Date(body.validFrom || Date.now()),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive !== false,
        sortOrder: body.sortOrder || 0
      }
    });

    logger.info('Plan discount created', { discountId: discount.id });
    return NextResponse.json({ discount }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error creating plan discount', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при создании скидки' },
      { status: 500 }
    );
  }
}
