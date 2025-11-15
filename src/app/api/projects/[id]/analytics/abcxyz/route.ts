/**
 * @file: src/app/api/projects/[id]/analytics/abcxyz/route.ts
 * @description: API endpoint для получения ABC/XYZ-анализа товаров
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
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const analysis = await AnalyticsService.getABCXYZAnalysis(
      projectId,
      startDate,
      endDate
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Ошибка получения ABC/XYZ-анализа', error);
    return NextResponse.json(
      { error: 'Ошибка получения ABC/XYZ-анализа' },
      { status: 500 }
    );
  }
}

