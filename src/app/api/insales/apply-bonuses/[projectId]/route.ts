/**
 * @file: route.ts
 * @description: InSales Apply Bonuses API - списывает бонусы для оплаты заказа
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { InSalesService } from '@/lib/insales/insales-service';
import type { ApplyBonusesRequest } from '@/lib/insales/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Проверяем интеграцию
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Integration not found'
        },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Integration is not active'
        },
        { status: 403 }
      );
    }

    // Парсим request body
    const body: ApplyBonusesRequest = await request.json();

    // Валидация
    if (!body.email && !body.phone) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Email or phone is required'
        },
        { status: 400 }
      );
    }

    if (!body.bonusAmount || body.bonusAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Invalid bonus amount'
        },
        { status: 400 }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Order ID is required'
        },
        { status: 400 }
      );
    }

    if (!body.orderTotal || body.orderTotal <= 0) {
      return NextResponse.json(
        {
          success: false,
          applied: 0,
          newBalance: 0,
          discount: 0,
          error: 'Invalid order total'
        },
        { status: 400 }
      );
    }

    // Применяем бонусы
    const insalesService = new InSalesService();
    const result = await insalesService.applyBonuses(projectId, body);

    logger.info(
      'InSales bonuses applied',
      {
        projectId,
        email: body.email,
        phone: body.phone,
        orderId: body.orderId,
        bonusAmount: body.bonusAmount,
        applied: result.applied,
        success: result.success
      },
      'insales-apply-bonuses'
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      'InSales apply bonuses error',
      {
        projectId,
        error: errorMessage
      },
      'insales-apply-bonuses'
    );

    return NextResponse.json(
      {
        success: false,
        applied: 0,
        newBalance: 0,
        discount: 0,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
