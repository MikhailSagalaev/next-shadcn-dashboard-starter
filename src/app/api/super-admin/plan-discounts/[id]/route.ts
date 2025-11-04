/**
 * @file: src/app/api/super-admin/plan-discounts/[id]/route.ts
 * @description: API для управления конкретной скидкой
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/super-admin/plan-discounts/[id]
 * Удалить скидку
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;

    const existing = await db.planDiscount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Скидка не найдена' }, { status: 404 });
    }

    await db.planDiscount.delete({ where: { id } });

    logger.info('Plan discount deleted', { discountId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error deleting plan discount', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при удалении скидки' },
      { status: 500 }
    );
  }
}
