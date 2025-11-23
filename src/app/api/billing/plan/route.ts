/**
 * @file: src/app/api/billing/plan/route.ts
 * @description: API endpoint для смены тарифного плана
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, JWT
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { formatPlan, toNumber } from '@/lib/services/billing-plan.utils';

const changePlanSchema = z.object({
  planId: z.string().min(1, 'planId is required')
});

const addMonths = (date: Date, months = 1) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'paused'];

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('sb_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const admin = await db.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const body = await request.json();
    const { planId } = changePlanSchema.parse(body);

    const plan = await db.subscriptionPlan.findFirst({
      where: {
        OR: [{ id: planId }, { slug: planId }]
      }
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Plan not found or inactive' },
        { status: 404 }
      );
    }

    const subscription = await db.subscription.findFirst({
      where: {
        adminAccountId: admin.id,
        status: { in: ACTIVE_SUBSCRIPTION_STATUSES }
      },
      orderBy: { startDate: 'desc' },
      include: { plan: true }
    });

    if (subscription && subscription.planId === plan.id) {
      return NextResponse.json({ error: 'План уже активен' }, { status: 400 });
    }

    const now = new Date();
    const nextPaymentDate = toNumber(plan.price) > 0 ? addMonths(now, 1) : null;

    let updatedSubscription;
    let action: string = 'created';

    if (subscription) {
      action =
        toNumber(plan.price) > toNumber(subscription.plan?.price ?? 0)
          ? 'upgraded'
          : 'downgraded';

      updatedSubscription = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'active',
          nextPaymentDate,
          history: {
            create: {
              action,
              fromPlanId: subscription.planId,
              toPlanId: plan.id,
              performedBy: admin.id
            }
          }
        },
        include: {
          plan: true
        }
      });
    } else {
      updatedSubscription = await db.subscription.create({
        data: {
          adminAccountId: admin.id,
          planId: plan.id,
          status: 'active',
          startDate: now,
          nextPaymentDate,
          history: {
            create: {
              action: 'created',
              toPlanId: plan.id,
              performedBy: admin.id
            }
          }
        },
        include: {
          plan: true
        }
      });
    }

    if (admin.role !== 'SUPERADMIN') {
      const nextRole = plan.slug === 'free' ? 'MANAGER' : 'ADMIN';
      if (nextRole !== admin.role) {
        await db.adminAccount.update({
          where: { id: admin.id },
          data: { role: nextRole }
        });
      }
    }

    logger.info('Plan change completed', {
      adminId: admin.id,
      subscriptionId: updatedSubscription.id,
      planId: plan.id,
      action
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'created'
          ? `Подписка на план «${plan.name}» активирована`
          : `Тарифный план изменен на «${plan.name}»`,
      plan: formatPlan(updatedSubscription.plan, {
        status: updatedSubscription.status,
        startDate: updatedSubscription.startDate,
        endDate: updatedSubscription.endDate,
        nextPaymentDate: updatedSubscription.nextPaymentDate
      })
    });
  } catch (error) {
    logger.error('Error changing plan:', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
