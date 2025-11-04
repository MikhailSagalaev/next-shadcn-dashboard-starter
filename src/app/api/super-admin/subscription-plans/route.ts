/**
 * @file: src/app/api/super-admin/subscription-plans/route.ts
 * @description: API для управления тарифными планами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/super-admin/subscription-plans
 * Получить список тарифных планов
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const isPublic = searchParams.get('isPublic');

    const where: any = {};
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (isPublic !== null && isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }

    const plans = await db.subscriptionPlan.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            subscriptions: true,
            discounts: true
          }
        }
      }
    });

    return NextResponse.json({ plans });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error fetching subscription plans', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при получении планов' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/subscription-plans
 * Создать новый тарифный план
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();

    // Валидация обязательных полей
    if (!body.name || !body.slug || !body.price || body.maxProjects === undefined || body.maxUsersPerProject === undefined) {
      return NextResponse.json(
        { error: 'Обязательные поля: name, slug, price, maxProjects, maxUsersPerProject' },
        { status: 400 }
      );
    }

    // Проверка уникальности slug
    const existing = await db.subscriptionPlan.findUnique({
      where: { slug: body.slug }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'План с таким slug уже существует' },
        { status: 409 }
      );
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: body.price,
        currency: body.currency || 'RUB',
        interval: body.interval || 'month',
        maxProjects: body.maxProjects,
        maxUsersPerProject: body.maxUsersPerProject,
        features: body.features || [],
        isActive: body.isActive !== false,
        isPublic: body.isPublic !== false,
        sortOrder: body.sortOrder || 0
      }
    });

    logger.info('Subscription plan created', {
      planId: plan.id,
      slug: plan.slug
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error creating subscription plan', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при создании плана' },
      { status: 500 }
    );
  }
}
