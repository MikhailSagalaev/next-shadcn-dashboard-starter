import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { TildaParserService } from '@/lib/services/integration/tilda-parser.service';
import { OrderProcessingService } from '@/lib/services/orders/order-processing.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ webhookSecret: string }> }
) {
  try {
    const { webhookSecret } = await params;

    // 1. Verify Project via Secret
    const project = await db.project.findUnique({
      where: { webhookSecret }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 403 }
      );
    }

    // 2. Parse Body and Normalize
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body || body.test === 'test') {
      return NextResponse.json({ message: 'Test OK' });
    }

    // 3. Normalize Data
    const normalizedOrder = TildaParserService.normalizeOrder(body);

    // 4. Process Order
    const result = await OrderProcessingService.processOrder(
      project.id,
      normalizedOrder
    );

    // 5. Log Success (Briefly)
    logger.info('Webhook Processed', {
      projectId: project.id,
      orderId: normalizedOrder.orderId,
      spent: result.data?.spent,
      earned: result.data?.earned
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Webhook Error', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    );
  }
}
