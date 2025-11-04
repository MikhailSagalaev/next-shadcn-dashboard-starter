/**
 * @file: src/app/api/super-admin/promo-codes/route.ts
 * @description: API для управления промокодами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/super-admin/promo-codes
 * Получить список промокодов
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }

    const promoCodes = await db.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    return NextResponse.json({ promoCodes });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error fetching promo codes', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при получении промокодов' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/promo-codes
 * Создать новый промокод
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();

    const body = await request.json();

    if (!body.code || !body.discountType || !body.discountValue) {
      return NextResponse.json(
        { error: 'Обязательные поля: code, discountType, discountValue' },
        { status: 400 }
      );
    }

    // Проверка уникальности кода
    const existing = await db.promoCode.findUnique({
      where: { code: body.code }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Промокод с таким кодом уже существует' },
        { status: 409 }
      );
    }

    const promoCode = await db.promoCode.create({
      data: {
        code: body.code,
        description: body.description,
        discountType: body.discountType,
        discountValue: body.discountValue,
        applicablePlans: body.applicablePlans || [],
        maxUses: body.maxUses,
        validFrom: new Date(body.validFrom || Date.now()),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive !== false,
        createdBy: admin.sub || admin.email
      }
    });

    logger.info('Promo code created', {
      promoCodeId: promoCode.id,
      code: promoCode.code
    });

    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error creating promo code', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при создании промокода' },
      { status: 500 }
    );
  }
}
