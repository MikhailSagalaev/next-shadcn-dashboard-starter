/**
 * @file: route.ts
 * @description: InSales Widget Settings API - возвращает настройки виджета
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Получаем интеграцию и проект
    const integration = await db.inSalesIntegration.findUnique({
      where: { projectId },
      include: {
        project: true
      }
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Integration not found'
        },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Integration is not active'
        },
        { status: 403 }
      );
    }

    // Формируем настройки виджета
    const settings = {
      projectId: projectId,
      bonusPercent: integration.bonusPercent,
      maxBonusSpend: integration.maxBonusSpend,
      widgetEnabled: integration.widgetEnabled,
      showProductBadges: integration.showProductBadges,
      currency: 'RUB',
      projectName: integration.project.name,
      operationMode: integration.project.operationMode
    };

    logger.info(
      'InSales widget settings requested',
      {
        projectId
      },
      'insales-widget-settings'
    );

    return NextResponse.json(
      {
        success: true,
        settings
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      'InSales widget settings error',
      {
        projectId,
        error: errorMessage
      },
      'insales-widget-settings'
    );

    return NextResponse.json(
      {
        success: false,
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
