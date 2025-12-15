/**
 * @file: src/app/api/billing/payment/route.ts
 * @description: Создание платежа через ЮKassa (разовый платеж за период)
 * @project: SaaS Bonus System
 * @created: 2025-12-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { formatPlan } from '@/lib/services/billing-plan.utils';
import { randomUUID } from 'crypto';

const YK_API_URL = 'https://api.yookassa.ru/v3/payments';

function getBasicAuth(shopId?: string, secret?: string) {
  if (!shopId || !secret) return null;
  const token = Buffer.from(`${shopId}:${secret}`).toString('base64');
  return `Basic ${token}`;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const planId: string | undefined = body.planId;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const formattedPlan = formatPlan(plan);
    if (formattedPlan.price <= 0) {
      return NextResponse.json(
        { error: 'Plan is free. Payment is not required.' },
        { status: 400 }
      );
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const returnUrl =
      body.returnUrl ||
      process.env.YOOKASSA_RETURN_URL ||
      'https://example.com/billing';

    const authHeader = getBasicAuth(shopId, secretKey);
    if (!authHeader) {
      return NextResponse.json(
        { error: 'YooKassa credentials are not configured' },
        { status: 500 }
      );
    }

    const idempotenceKey = randomUUID();

    const paymentPayload = {
      amount: {
        value: formattedPlan.price.toFixed(2),
        currency: formattedPlan.currency || 'RUB'
      },
      capture: true,
      description: `Оплата тарифа ${formattedPlan.name}`,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl
      },
      metadata: {
        adminId: admin.sub,
        planId: plan.id
      }
    };

    // Создаем запись Payment со статусом created
    const paymentRecord = await db.payment.create({
      data: {
        adminAccountId: admin.sub,
        planId: plan.id,
        amount: plan.price,
        currency: plan.currency || 'RUB',
        status: 'created',
        provider: 'yookassa',
        providerPaymentId: `temp-${idempotenceKey}`, // будет обновлен после запроса
        description: paymentPayload.description
      }
    });

    const response = await fetch(YK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify(paymentPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('YooKassa create payment failed', {
        status: response.status,
        body: errorText
      });
      await db.payment.update({
        where: { id: paymentRecord.id },
        data: {
          status: 'failed',
          metadata: { error: errorText }
        }
      });
      return NextResponse.json(
        { error: 'Failed to create payment' },
        { status: 502 }
      );
    }

    const paymentResponse = await response.json();
    const providerPaymentId = paymentResponse.id;
    const confirmationUrl =
      paymentResponse.confirmation?.confirmation_url || null;
    const status = paymentResponse.status || 'pending';

    await db.payment.update({
      where: { id: paymentRecord.id },
      data: {
        providerPaymentId,
        confirmationUrl,
        status,
        metadata: paymentResponse
      }
    });

    return NextResponse.json({
      paymentId: paymentRecord.id,
      providerPaymentId,
      status,
      confirmationUrl
    });
  } catch (error) {
    logger.error('Error creating payment', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
