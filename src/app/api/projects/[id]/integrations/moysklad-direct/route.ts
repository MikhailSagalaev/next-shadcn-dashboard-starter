/**
 * @file: route.ts
 * @description: API routes for МойСклад Direct integration management (CRUD operations)
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15 App Router, Prisma
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import {
  encryptApiToken,
  generateWebhookSecret
} from '@/lib/moysklad-direct/encryption';
import { MoySkladClient } from '@/lib/moysklad-direct/client';
import { SyncDirection } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const createIntegrationSchema = z.object({
  accountId: z.string().uuid('Account ID must be a valid UUID'),
  apiToken: z.string().min(1, 'API Token is required'),
  bonusProgramId: z.string().uuid('Bonus Program ID must be a valid UUID'),
  syncDirection: z.nativeEnum(SyncDirection).optional(),
  autoSync: z.boolean().optional()
});

const updateIntegrationSchema = z.object({
  accountId: z.string().uuid().optional(),
  apiToken: z.string().min(1).optional(),
  bonusProgramId: z.string().uuid().optional(),
  syncDirection: z.nativeEnum(SyncDirection).optional(),
  autoSync: z.boolean().optional(),
  isActive: z.boolean().optional()
});

/**
 * GET /api/projects/[id]/integrations/moysklad-direct
 *
 * Get МойСклад Direct integration settings for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get integration
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        accountId: true,
        bonusProgramId: true,
        syncDirection: true,
        autoSync: true,
        webhookSecret: true,
        isActive: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true
        // Note: apiToken is NOT returned for security
      }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(integration);
  } catch (error) {
    logger.error(
      'Error getting МойСклад Direct integration',
      { error },
      'moysklad-direct-api'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/integrations/moysklad-direct
 *
 * Create new МойСклад Direct integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if integration already exists
    const existing = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Integration already exists for this project' },
        { status: 409 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createIntegrationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { accountId, apiToken, bonusProgramId, syncDirection, autoSync } =
      validationResult.data;

    // Encrypt API token
    const encryptedToken = encryptApiToken(apiToken);

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Create integration
    const integration = await db.moySkladDirectIntegration.create({
      data: {
        projectId,
        accountId,
        apiToken: encryptedToken,
        bonusProgramId,
        syncDirection: syncDirection || SyncDirection.BIDIRECTIONAL,
        autoSync: autoSync !== undefined ? autoSync : true,
        webhookSecret,
        isActive: false // Requires manual activation after testing
      },
      select: {
        id: true,
        projectId: true,
        accountId: true,
        bonusProgramId: true,
        syncDirection: true,
        autoSync: true,
        webhookSecret: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logger.info(
      'МойСклад Direct integration created',
      {
        projectId,
        integrationId: integration.id
      },
      'moysklad-direct-api'
    );

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    logger.error(
      'Error creating МойСклад Direct integration',
      { error },
      'moysklad-direct-api'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/integrations/moysklad-direct
 *
 * Update МойСклад Direct integration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if integration exists
    const existing = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateIntegrationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const updateData: any = {};

    // Build update data
    if (validationResult.data.accountId) {
      updateData.accountId = validationResult.data.accountId;
    }
    if (validationResult.data.apiToken) {
      updateData.apiToken = encryptApiToken(validationResult.data.apiToken);
    }
    if (validationResult.data.bonusProgramId) {
      updateData.bonusProgramId = validationResult.data.bonusProgramId;
    }
    if (validationResult.data.syncDirection) {
      updateData.syncDirection = validationResult.data.syncDirection;
    }
    if (validationResult.data.autoSync !== undefined) {
      updateData.autoSync = validationResult.data.autoSync;
    }
    if (validationResult.data.isActive !== undefined) {
      updateData.isActive = validationResult.data.isActive;
    }

    // Update integration
    const integration = await db.moySkladDirectIntegration.update({
      where: { projectId },
      data: updateData,
      select: {
        id: true,
        projectId: true,
        accountId: true,
        bonusProgramId: true,
        syncDirection: true,
        autoSync: true,
        webhookSecret: true,
        isActive: true,
        lastSyncAt: true,
        lastError: true,
        updatedAt: true
      }
    });

    logger.info(
      'МойСклад Direct integration updated',
      {
        projectId,
        integrationId: integration.id
      },
      'moysklad-direct-api'
    );

    return NextResponse.json(integration);
  } catch (error) {
    logger.error(
      'Error updating МойСклад Direct integration',
      { error },
      'moysklad-direct-api'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/integrations/moysklad-direct
 *
 * Soft delete МойСклад Direct integration (set isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    });

    if (!project || project.ownerId !== admin.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if integration exists
    const existing = await db.moySkladDirectIntegration.findUnique({
      where: { projectId }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Soft delete (set isActive = false)
    await db.moySkladDirectIntegration.update({
      where: { projectId },
      data: { isActive: false }
    });

    logger.info(
      'МойСклад Direct integration deleted (soft)',
      {
        projectId,
        integrationId: existing.id
      },
      'moysklad-direct-api'
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error(
      'Error deleting МойСклад Direct integration',
      { error },
      'moysklad-direct-api'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
