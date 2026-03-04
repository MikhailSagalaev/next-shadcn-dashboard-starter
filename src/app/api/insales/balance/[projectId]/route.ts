/**
 * @file: route.ts
 * @description: InSales Balance API - возвращает баланс бонусов пользователя
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { InSalesService } from '@/lib/insales/insales-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const projectId = params.projectId;

  try {
    // Проверяем интеграцию
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'Integration not found'
        },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'Integration is not active'
        },
        { status: 403 }
      );
    }

    // Получаем параметры из query string
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    if (!email && !phone) {
      return NextResponse.json(
        {
          success: false,
          balance: 0,
          currency: 'RUB',
          error: 'Email or phone is required'
        },
        { status: 400 }
      );
    }

    // Получаем баланс
    const insalesService = new InSalesService();
    const result = await insalesService.getBonusBalance(projectId, {
      email: email || undefined,
      phone: phone || undefined
    });

    logger.info(
      'InSales balance check',
      {
        projectId,
        email,
        phone,
        balance: result.balance,
        success: result.success
      },
      'insales-balance'
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      'InSales balance check error',
      {
        projectId,
        error: errorMessage
      },
      'insales-balance'
    );

    return NextResponse.json(
      {
        success: false,
        balance: 0,
        currency: 'RUB',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
