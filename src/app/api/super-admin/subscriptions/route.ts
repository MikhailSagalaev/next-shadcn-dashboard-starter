/**
 * @file: src/app/api/super-admin/subscriptions/route.ts
 * @description: API для управления подписками
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { BillingService } from '@/lib/services/billing.service';

/**
 * GET /api/super-admin/subscriptions
 * Получить список подписок
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status'); // active, cancelled, expired
    const planId = searchParams.get('planId');
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.planId = planId;
    if (search) {
      where.adminAccount = {
        email: { contains: search, mode: 'insensitive' }
      };
    }

    const [subscriptions, total] = await Promise.all([
      db.subscription.findMany({
        where,
        include: {
          adminAccount: { select: { id: true, email: true } },
          plan: true,
          promoCode: { select: { code: true, discountValue: true, discountType: true } }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.subscription.count({ where })
    ]);

    return NextResponse.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error fetching subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при получении подписок' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/subscriptions
 * Создать новую подписку
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();

    if (!body.adminId || !body.planId) {
      return NextResponse.json(
        { error: 'Обязательные поля: adminId, planId' },
        { status: 400 }
      );
    }

    const subscription = await BillingService.createSubscription({
      adminId: body.adminId,
      planId: body.planId,
      promoCode: body.promoCode,
      trialDays: body.trialDays
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error creating subscription', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка при создании подписки' },
      { status: 500 }
    );
  }
}
