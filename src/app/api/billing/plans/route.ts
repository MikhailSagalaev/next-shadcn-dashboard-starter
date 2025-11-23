/**
 * @file: src/app/api/billing/plans/route.ts
 * @description: Публичный список тарифных планов
 * @project: SaaS Bonus System
 * @created: 2025-11-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { formatPlan } from '@/lib/services/billing-plan.utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const isPublic = searchParams.get('isPublic');

    const where: Record<string, unknown> = {};

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (isPublic !== null) {
      where.isPublic = isPublic === 'true';
    }

    const plans = await db.subscriptionPlan.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({
      plans: plans.map((plan) => formatPlan(plan))
    });
  } catch (error) {
    logger.error('Error fetching billing plans', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to load plans' },
      { status: 500 }
    );
  }
}
