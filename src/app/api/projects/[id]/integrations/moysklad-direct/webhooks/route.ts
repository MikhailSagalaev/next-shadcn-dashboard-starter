/**
 * @file: route.ts
 * @description: API endpoint для управления вебхуками МойСклад
 * @project: SaaS Bonus System
 * @created: 2026-03-06
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { decryptApiToken } from '@/lib/moysklad-direct/encryption';

const MOYSKLAD_API_URL = 'https://api.moysklad.ru/api/remap/1.2';

interface WebhookConfig {
  entityType: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  description: string;
}

const WEBHOOK_CONFIGS: WebhookConfig[] = [
  {
    entityType: 'bonustransaction',
    action: 'CREATE',
    description: 'Начисление бонусов'
  },
  {
    entityType: 'bonustransaction',
    action: 'UPDATE',
    description: 'Обновление бонусной операции'
  },
  {
    entityType: 'counterparty',
    action: 'CREATE',
    description: 'Создание контрагента'
  },
  {
    entityType: 'counterparty',
    action: 'UPDATE',
    description: 'Обновление контрагента'
  },
  {
    entityType: 'demand',
    action: 'CREATE',
    description: 'Новая продажа'
  }
];

/**
 * GET /api/projects/[id]/integrations/moysklad-direct/webhooks
 * Получить список вебхуков
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Verify ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get integration
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Decrypt token
    const apiToken = decryptApiToken(integration.apiToken);

    // Fetch webhooks from МойСклад
    const response = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`МойСклад API error: ${response.statusText}`);
    }

    const data = await response.json();
    const webhookUrl = `https://gupil.ru/api/webhook/moysklad-direct/${projectId}`;

    // Filter only our webhooks
    const ourWebhooks = data.rows.filter(
      (webhook: any) => webhook.url === webhookUrl
    );

    logger.info(
      'Fetched МойСклад webhooks',
      { projectId, count: ourWebhooks.length },
      'moysklad-direct-api'
    );

    return NextResponse.json({
      webhooks: ourWebhooks,
      total: ourWebhooks.length
    });
  } catch (error) {
    logger.error('Error fetching webhooks', { error }, 'moysklad-direct-api');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/integrations/moysklad-direct/webhooks
 * Создать вебхуки
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Verify ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get integration
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Decrypt token
    const apiToken = decryptApiToken(integration.apiToken);
    const webhookUrl = `https://gupil.ru/api/webhook/moysklad-direct/${projectId}`;

    // Get existing webhooks first
    const existingResponse = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });

    if (!existingResponse.ok) {
      throw new Error(
        `Failed to fetch existing webhooks: ${existingResponse.statusText}`
      );
    }

    const existingData = await existingResponse.json();
    const existingWebhooks = existingData.rows.filter(
      (webhook: any) => webhook.url === webhookUrl
    );

    // Create a map of existing webhooks for quick lookup
    const existingMap = new Map(
      existingWebhooks.map((w: any) => [`${w.entityType}_${w.action}`, w])
    );

    const results = [];
    const errors = [];
    const skipped = [];

    // Create webhooks
    for (const config of WEBHOOK_CONFIGS) {
      const key = `${config.entityType}_${config.action}`;

      // Check if webhook already exists
      if (existingMap.has(key)) {
        const existing = existingMap.get(key);
        skipped.push({
          ...config,
          id: existing.id,
          success: true,
          skipped: true
        });

        logger.info(
          'Webhook already exists, skipping',
          {
            projectId,
            webhookId: existing.id,
            entityType: config.entityType,
            action: config.action
          },
          'moysklad-direct-api'
        );
        continue;
      }

      try {
        const response = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: webhookUrl,
            action: config.action,
            entityType: config.entityType
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          throw new Error(JSON.stringify(errorData));
        }

        const webhook = await response.json();
        results.push({
          ...config,
          id: webhook.id,
          success: true
        });

        logger.info(
          'Created МойСклад webhook',
          {
            projectId,
            webhookId: webhook.id,
            entityType: config.entityType,
            action: config.action
          },
          'moysklad-direct-api'
        );
      } catch (error) {
        const errorMessage = (error as Error).message;
        let parsedError;
        try {
          parsedError = JSON.parse(errorMessage);
        } catch {
          parsedError = { message: errorMessage };
        }

        errors.push({
          ...config,
          error: parsedError,
          success: false
        });

        logger.error(
          'Failed to create webhook',
          {
            projectId,
            config,
            error: parsedError
          },
          'moysklad-direct-api'
        );
      }
    }

    return NextResponse.json({
      message: 'Webhooks setup complete',
      created: results.length,
      skipped: skipped.length,
      failed: errors.length,
      results,
      skipped,
      errors
    });
  } catch (error) {
    logger.error('Error creating webhooks', { error }, 'moysklad-direct-api');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/integrations/moysklad-direct/webhooks
 * Удалить все вебхуки для этого проекта
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Verify ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get integration
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Decrypt token
    const apiToken = decryptApiToken(integration.apiToken);
    const webhookUrl = `https://gupil.ru/api/webhook/moysklad-direct/${projectId}`;

    // Get all webhooks
    const response = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`МойСклад API error: ${response.statusText}`);
    }

    const data = await response.json();
    const ourWebhooks = data.rows.filter(
      (webhook: any) => webhook.url === webhookUrl
    );

    const results = [];
    const errors = [];

    // Delete each webhook
    for (const webhook of ourWebhooks) {
      try {
        const deleteResponse = await fetch(
          `${MOYSKLAD_API_URL}/entity/webhook/${webhook.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${apiToken}`
            }
          }
        );

        if (!deleteResponse.ok) {
          throw new Error(`Failed to delete webhook ${webhook.id}`);
        }

        results.push({
          id: webhook.id,
          entityType: webhook.entityType,
          action: webhook.action,
          success: true
        });

        logger.info(
          'Deleted МойСклад webhook',
          {
            projectId,
            webhookId: webhook.id
          },
          'moysklad-direct-api'
        );
      } catch (error) {
        errors.push({
          id: webhook.id,
          error: (error as Error).message,
          success: false
        });

        logger.error(
          'Failed to delete webhook',
          {
            projectId,
            webhookId: webhook.id,
            error
          },
          'moysklad-direct-api'
        );
      }
    }

    return NextResponse.json({
      message: 'Webhooks cleanup complete',
      deleted: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    logger.error('Error deleting webhooks', { error }, 'moysklad-direct-api');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
