/**
 * @file: src/app/api/super-admin/subscription-plans/[id]/route.ts
 * @description: API для управления конкретным тарифным планом
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 * @author: AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PUT /api/super-admin/subscription-plans/[id]
 * Обновить тарифный план
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;

    const body = await request.json();

    // Проверяем существование плана
    const existing = await db.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'План не найден' },
        { status: 404 }
      );
    }

    // Если меняется slug, проверяем уникальность
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.subscriptionPlan.findUnique({
        where: { slug: body.slug }
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'План с таким slug уже существует' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.interval !== undefined) updateData.interval = body.interval;
    if (body.maxProjects !== undefined) updateData.maxProjects = body.maxProjects;
    if (body.maxUsersPerProject !== undefined) updateData.maxUsersPerProject = body.maxUsersPerProject;
    if (body.maxBots !== undefined) updateData.maxBots = body.maxBots;
    if (body.maxNotifications !== undefined) updateData.maxNotifications = body.maxNotifications;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: updateData
    });

    logger.info('Subscription plan updated', {
      planId: plan.id,
      slug: plan.slug
    });

    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error updating subscription plan', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при обновлении плана' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/super-admin/subscription-plans/[id]
 * Удалить тарифный план
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;

    // Проверяем существование плана
    const existing = await db.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'План не найден' },
        { status: 404 }
      );
    }

    // Нельзя удалить план, на который есть активные подписки
    if (existing._count.subscriptions > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить план с активными подписками. Сначала деактивируйте план.' },
        { status: 409 }
      );
    }

    await db.subscriptionPlan.delete({
      where: { id }
    });

    logger.info('Subscription plan deleted', {
      planId: id,
      slug: existing.slug
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('Error deleting subscription plan', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Ошибка при удалении плана' },
      { status: 500 }
    );
  }
}
