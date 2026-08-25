import { NextRequest, NextResponse } from 'next/server';

import { withProjectAccess } from '@/lib/with-project-access';
import {
  OrganizationMemberActivityService,
  type OrganizationActivityPeriod
} from '@/lib/services/organization-member-activity.service';

const VALID_PERIODS: OrganizationActivityPeriod[] = [
  'today',
  '7d',
  '30d',
  'all'
];

type ActivityRouteParams = {
  id: string;
  organizationId: string;
  userId: string;
};

export const GET = withProjectAccess<ActivityRouteParams>(
  async (request: NextRequest, { projectId, params }) => {
    const { organizationId, userId } = await params;
    const url = new URL(request.url);
    const periodParam = (url.searchParams.get('period') ||
      '30d') as OrganizationActivityPeriod;
    const period = VALID_PERIODS.includes(periodParam) ? periodParam : '30d';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('limit') || 30))
    );

    try {
      const result = await OrganizationMemberActivityService.get({
        projectId,
        organizationId,
        userId,
        period,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 30
      });
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, no-store' }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить историю';
      const status = message.includes('не найден') ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);
