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

    // 5. Log to Database (WebhookLog)
    await db.webhookLog.create({
      data: {
        projectId: project.id,
        endpoint: `/api/webhook/${webhookSecret}`,
        method: 'POST',
        headers: Object.fromEntries(req.headers.entries()),
        body: body,
        response: result as any, // Cast to any for JSON compatibility
        status: 200,
        success: result.success
      }
    });

    // 6. Log Success (Briefly)
    logger.info('Webhook Processed', {
      projectId: project.id,
      orderId: normalizedOrder.orderId,
      spent: result.data?.spent,
      earned: result.data?.earned
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Webhook Error', error);

    // Log error to database if we have projectId
    try {
      const { webhookSecret } = await params;
      const project = await db.project.findUnique({
        where: { webhookSecret },
        select: { id: true }
      });

      if (project) {
        await db.webhookLog.create({
          data: {
            projectId: project.id,
            endpoint: `/api/webhook/${webhookSecret}`,
            method: 'POST',
            headers: {},
            body: {},
            response: {
              error: 'Internal Server Error',
              details: error instanceof Error ? error.message : 'Unknown'
            },
            status: 500,
            success: false
          }
        });
      }
    } catch (logError) {
      logger.error('Failed to log webhook error', logError);
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown'
      },
      { status: 500 }
    );
  }
}
