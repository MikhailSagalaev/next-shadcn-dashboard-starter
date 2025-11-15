/**
 * @file: src/app/api/projects/[id]/analytics/rfm/route.ts
 * @description: API endpoint для получения RFM-анализа
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
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const rfm = await AnalyticsService.getRFMAnalysis(projectId, endDate);

    return NextResponse.json(rfm);
  } catch (error) {
    console.error('Ошибка получения RFM-анализа', error);
    return NextResponse.json(
      { error: 'Ошибка получения RFM-анализа' },
      { status: 500 }
    );
  }
}

