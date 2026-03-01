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
      where: { webhookSecret },
      select: {
        id: true,
        widgetVersion: true,
        bonusBehavior: true,
        operationMode: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 403 }
      );
    }

    // 2. Parse Body and Normalize
    let body;
    const contentType = req.headers.get('content-type') || '';

    logger.info('Webhook received', {
      projectId: project.id,
      contentType,
      method: req.method
    });

    try {
      if (contentType.includes('application/json')) {
        // JSON format (custom integrations)
        body = await req.json();
        logger.debug('Parsed as JSON', { bodyKeys: Object.keys(body) });
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        // Form data format (Tilda)
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
        
        logger.debug('Parsed as FormData', { 
          bodyKeys: Object.keys(body),
          paymentType: typeof body.payment 
        });
        
        // Tilda sends nested data as JSON strings, parse them
        if (body.payment && typeof body.payment === 'string') {
          try {
            body.payment = JSON.parse(body.payment);
            logger.debug('Payment field parsed successfully', { 
              paymentKeys: Object.keys(body.payment) 
            });
          } catch (e) {
            logger.warn('Failed to parse payment field', { 
              payment: body.payment,
              error: e instanceof Error ? e.message : 'Unknown'
            });
          }
        }
      } else {
        // Try JSON as fallback
        logger.debug('Unknown content-type, trying JSON fallback');
        body = await req.json();
      }
    } catch (e) {
      logger.error('Failed to parse request body', { 
        contentType, 
        error: e instanceof Error ? e.message : 'Unknown' 
      });
      return NextResponse.json({ 
        error: 'Invalid request format. Expected JSON or form data.',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 400 });
    }

    // Handle test requests
    if (!body || body.test === 'test') {
      logger.info('Test webhook received', { projectId: project.id });
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
      widgetVersion: project.widgetVersion,
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
