/**
 * @file: route.ts
 * @description: Webhook handler for МойСклад Direct API bonus transaction events
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15 App Router, МойСклад webhooks
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MoySkladClient } from '@/lib/moysklad-direct/client';
import { SyncService } from '@/lib/moysklad-direct/sync-service';
import { MoySkladWebhookPayload } from '@/lib/moysklad-direct/types';
import crypto from 'crypto';

/**
 * Validate webhook signature using HMAC-SHA256
 */
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(
      'Error validating webhook signature',
      { error },
      'moysklad-direct-webhook'
    );
    return false;
  }
}

/**
 * POST /api/webhook/moysklad-direct/[projectId]
 *
 * Receives webhook events from МойСклад for bonus transactions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const startTime = Date.now();
  const { projectId } = params;

  try {
    // Find integration by projectId
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId },
      include: { project: true }
    });

    if (!integration) {
      logger.warn(
        'Integration not found for webhook',
        { projectId },
        'moysklad-direct-webhook'
      );
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      logger.warn(
        'Integration is not active',
        { projectId },
        'moysklad-direct-webhook'
      );
      return NextResponse.json(
        { error: 'Integration not active' },
        { status: 404 }
      );
    }

    if (!integration.webhookSecret) {
      logger.error(
        'Webhook secret not configured',
        { projectId },
        'moysklad-direct-webhook'
      );
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Read request body
    const bodyText = await request.text();

    // Validate signature
    const signature = request.headers.get('X-MoySklad-Signature');

    if (!signature) {
      logger.warn(
        'Missing webhook signature',
        { projectId },
        'moysklad-direct-webhook'
      );
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const isValidSignature = validateWebhookSignature(
      bodyText,
      signature,
      integration.webhookSecret
    );

    if (!isValidSignature) {
      logger.warn(
        'Invalid webhook signature',
        { projectId },
        'moysklad-direct-webhook'
      );
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    const payload: MoySkladWebhookPayload = JSON.parse(bodyText);

    logger.info(
      'Webhook received from МойСклад',
      {
        projectId,
        eventCount: payload.events.length
      },
      'moysklad-direct-webhook'
    );

    // Filter bonus transaction events
    const bonusTransactionEvents = payload.events.filter(
      (event) => event.meta.type === 'bonustransaction'
    );

    if (bonusTransactionEvents.length === 0) {
      logger.debug(
        'No bonus transaction events in webhook',
        {
          projectId,
          eventTypes: payload.events.map((e) => e.meta.type)
        },
        'moysklad-direct-webhook'
      );

      return NextResponse.json({
        message: 'No bonus transaction events to process',
        processed: 0
      });
    }

    // Create МойСклад client
    const client = new MoySkladClient({
      accountId: integration.accountId,
      apiToken: integration.apiToken,
      bonusProgramId: integration.bonusProgramId
    });

    // Create sync service
    const syncService = new SyncService();

    // Process each bonus transaction event
    const results = await Promise.allSettled(
      bonusTransactionEvents.map(async (event) => {
        try {
          // Extract transaction ID from href
          const transactionId = event.meta.href.split('/').pop();

          if (!transactionId) {
            throw new Error('Failed to extract transaction ID from event');
          }

          logger.info(
            'Processing bonus transaction event',
            {
              projectId,
              transactionId,
              action: event.action
            },
            'moysklad-direct-webhook'
          );

          // Fetch full transaction details
          const bonusTransaction =
            await client.getBonusTransaction(transactionId);

          // Sync to our system
          await syncService.syncFromMoySklad({
            integrationId: integration.id,
            bonusTransaction
          });

          return { transactionId, status: 'success' };
        } catch (error) {
          logger.error(
            'Error processing bonus transaction event',
            {
              error,
              event
            },
            'moysklad-direct-webhook'
          );

          return {
            transactionId: event.meta.href.split('/').pop(),
            status: 'error',
            error: (error as Error).message
          };
        }
      })
    );

    // Count successes and failures
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const errorCount = results.filter((r) => r.status === 'rejected').length;

    // Create webhook log
    await db.moySkladDirectSyncLog.create({
      data: {
        integrationId: integration.id,
        operation: 'bonus_accrual',
        direction: 'incoming',
        requestData: payload,
        responseData: { results, successCount, errorCount },
        status: errorCount === 0 ? 'success' : 'error',
        errorMessage:
          errorCount > 0 ? `${errorCount} events failed to process` : null
      }
    });

    const processingTime = Date.now() - startTime;

    logger.info(
      'Webhook processed',
      {
        projectId,
        totalEvents: bonusTransactionEvents.length,
        successCount,
        errorCount,
        processingTime
      },
      'moysklad-direct-webhook'
    );

    return NextResponse.json({
      message: 'Webhook processed',
      processed: successCount,
      errors: errorCount,
      processingTime
    });
  } catch (error) {
    logger.error(
      'Error processing webhook',
      {
        error,
        projectId
      },
      'moysklad-direct-webhook'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
