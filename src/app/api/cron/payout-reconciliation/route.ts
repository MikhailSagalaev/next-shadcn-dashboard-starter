import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { PayoutService } from '@/lib/services/payout.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Payout reconciliation is not configured' },
      { status: 503 }
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await PayoutService.reconcilePending();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    logger.error('Payout reconciliation cron failed', {
      error: error instanceof Error ? error.message : String(error),
      component: 'payout-reconciliation-cron'
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
