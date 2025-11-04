/**
 * @file: src/app/api/super-admin/promo-codes/[id]/route.ts
 * @description: API для управления конкретным промокодом
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PUT /api/super-admin/promo-codes/[id]
 * Обновить промокод
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;

    const body = await request.json();

    const existing = await db.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Промокод не найден' }, { status: 404 });
    }

    // Если меняется code, проверяем уникальность
    if (body.code && body.code !== existing.code) {
      const codeExists = await db.promoCode.findUnique({
        where: { code: body.code }
      });
      if (codeExists) {
        return NextResponse.json(
          { error: 'Промокод с таким кодом уже существует' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.discountType !== undefined) updateData.discountType = body.discountType;
    if (body.discountValue !== undefined) updateData.discountValue = body.discountValue;
    if (body.applicablePlans !== undefined) updateData.applicablePlans = body.applicablePlans;
    if (body.maxUses !== undefined) updateData.maxUses = body.maxUses;
    if (body.validFrom !== undefined) updateData.validFrom = new Date(body.validFrom);
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const promoCode = await db.promoCode.update({
      where: { id },
      data: updateData
    });

    logger.info('Promo code updated', { promoCodeId: promoCode.id });
    return NextResponse.json({ promoCode });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error updating promo code', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при обновлении промокода' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/super-admin/promo-codes/[id]
 * Удалить промокод
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;

    const existing = await db.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Промокод не найден' }, { status: 404 });
    }

    await db.promoCode.delete({ where: { id } });

    logger.info('Promo code deleted', { promoCodeId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error deleting promo code', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при удалении промокода' },
      { status: 500 }
    );
  }
}
