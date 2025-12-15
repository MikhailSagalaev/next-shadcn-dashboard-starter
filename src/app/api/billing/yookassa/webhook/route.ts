/**
 * @file: src/app/api/billing/yookassa/webhook/route.ts
 * @description: Webhook обработчик статусов платежей ЮKassa
 * @project: SaaS Bonus System
 * @created: 2025-12-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    const paymentObject = event.object || {};
    const providerPaymentId: string | undefined = paymentObject.id;
    const status: string | undefined = paymentObject.status;

    if (!providerPaymentId) {
      return NextResponse.json({ error: 'payment id missing' }, { status: 400 });
    }

    const payment = await db.payment.findUnique({
      where: { providerPaymentId },
      include: { plan: true, subscription: true, adminAccount: true }
    });

    if (!payment) {
      logger.warn('Payment not found for webhook', { providerPaymentId, status });
      return NextResponse.json({ ok: true });
    }

    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: status || payment.status,
        metadata: paymentObject
      }
    });

    // Обрабатываем успешный платеж
    if (status === 'succeeded') {
      const plan = payment.plan;
      if (!plan) {
        logger.error('Payment has no plan linked', { paymentId: payment.id });
        return NextResponse.json({ ok: true });
      }

      // Найти или создать подписку для админа
      let subscription = await db.subscription.findFirst({
        where: {
          adminAccountId: payment.adminAccountId,
          status: { in: ['active', 'trial', 'paused'] }
        },
        include: { plan: true }
      });

      const now = new Date();
      const intervalMonths = plan.interval === 'year' ? 12 : 1;

      if (!subscription) {
        subscription = await db.subscription.create({
          data: {
            adminAccountId: payment.adminAccountId,
            planId: plan.id,
            status: 'active',
            startDate: now,
            endDate: addMonths(now, intervalMonths),
            lastPaymentDate: now,
            nextPaymentDate: addMonths(now, intervalMonths)
          },
          include: { plan: true }
        });
      } else {
        const baseDate =
          subscription.endDate && subscription.endDate > now
            ? subscription.endDate
            : now;
        const newEnd = addMonths(baseDate, intervalMonths);
        await db.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            planId: plan.id,
            startDate: subscription.startDate || now,
            endDate: newEnd,
            lastPaymentDate: now,
            nextPaymentDate: addMonths(now, intervalMonths)
          }
        });
      }

      await db.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          action: 'paid',
          toPlanId: plan.id,
          reason: 'yookassa_payment',
          performedBy: 'system'
        }
      });
    }

    if (status === 'canceled' || status === 'waiting_for_capture') {
      // Ничего не делаем кроме логирования
      logger.info('YooKassa payment status update', {
        paymentId: payment.id,
        status
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('YooKassa webhook error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
