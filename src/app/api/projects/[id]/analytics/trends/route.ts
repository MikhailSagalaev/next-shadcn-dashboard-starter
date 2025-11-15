/**
 * @file: src/app/api/projects/[id]/analytics/trends/route.ts
 * @description: API endpoint для получения динамики продаж
 * @project: SaaS Bonus System
 * @dependencies: Next.js, AnalyticsService
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(projectId, admin.sub);
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') as 'day' | 'week' | 'month') || 'day';
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // По умолчанию последние 30 дней
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const trends = await AnalyticsService.getSalesTrends(
      projectId,
      period,
      startDate,
      endDate
    );

    return NextResponse.json(trends);
  } catch (error) {
    console.error('Ошибка получения динамики продаж', error);
    return NextResponse.json(
      { error: 'Ошибка получения динамики продаж' },
      { status: 500 }
    );
  }
}

