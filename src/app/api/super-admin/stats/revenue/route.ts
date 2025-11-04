/**
 * @file: src/app/api/super-admin/stats/revenue/route.ts
 * @description: API для статистики доходов (MRR, ARR)
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/super-admin/stats/revenue
 * Получить статистику по доходам
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    // Получаем все активные подписки
    const activeSubscriptions = await db.subscription.findMany({
      where: {
        status: 'active',
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } }
        ]
      },
      include: {
        plan: true,
        promoCode: true
      }
    });

    // Подсчитываем MRR (Monthly Recurring Revenue)
    let mrr = 0;
    let arr = 0;

    activeSubscriptions.forEach((sub) => {
      let price = Number(sub.plan.price);

      // Применяем скидку промокода, если есть
      if (sub.promoCode) {
        if (sub.promoCode.discountType === 'percent') {
          price = price * (1 - Number(sub.promoCode.discountValue) / 100);
        } else if (sub.promoCode.discountType === 'fixed_amount') {
          price = Math.max(0, price - Number(sub.promoCode.discountValue));
        }
      }

      if (sub.plan.interval === 'month') {
        mrr += price;
        arr += price * 12;
      } else if (sub.plan.interval === 'year') {
        mrr += price / 12;
        arr += price;
      }
    });

    // Подписки по планам
    const subscriptionsByPlan: Record<string, number> = {};
    activeSubscriptions.forEach((sub) => {
      const planName = sub.plan.name;
      subscriptionsByPlan[planName] = (subscriptionsByPlan[planName] || 0) + 1;
    });

    // Конверсия (пока упрощенная версия)
    const totalAdmins = await db.adminAccount.count();
    const totalSubscriptions = await db.subscription.count();
    const conversionRate = totalAdmins > 0 ? (totalSubscriptions / totalAdmins) * 100 : 0;

    return NextResponse.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      activeSubscriptions: activeSubscriptions.length,
      subscriptionsByPlan,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalAdmins,
      totalSubscriptions
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error fetching revenue stats', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при получении статистики' },
      { status: 500 }
    );
  }
}
