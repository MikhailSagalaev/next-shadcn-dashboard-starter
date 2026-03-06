/**
 * @file: route.ts
 * @description: Manual sync endpoint for МойСклад Direct integration
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15 App Router, SyncService
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { SyncService } from '@/lib/moysklad-direct/sync-service';
import { z } from 'zod';

const syncRequestSchema = z.object({
  userId: z.string().optional()
});

/**
 * POST /api/projects/[id]/integrations/moysklad-direct/sync
 *
 * Manually trigger balance sync for users
 * - If userId provided: sync specific user
 * - If no userId: sync all users for project (with batching)
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

    if (!integration.isActive) {
      return NextResponse.json(
        { error: 'Integration is not active' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validationResult = syncRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { userId } = validationResult.data;
    const syncService = new SyncService();

    // Sync specific user
    if (userId) {
      // Verify user belongs to project
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { projectId: true, moySkladDirectCounterpartyId: true }
      });

      if (!user || user.projectId !== projectId) {
        return NextResponse.json(
          { error: 'User not found or does not belong to this project' },
          { status: 404 }
        );
      }

      if (!user.moySkladDirectCounterpartyId) {
        return NextResponse.json(
          { error: 'User is not linked to МойСклад counterparty' },
          { status: 400 }
        );
      }

      const result = await syncService.checkAndSyncBalance(userId);

      logger.info(
        'Manual sync completed for user',
        {
          projectId,
          userId,
          result
        },
        'moysklad-direct-api'
      );

      return NextResponse.json({
        success: true,
        syncedCount: 1,
        errorsCount: result.error ? 1 : 0,
        results: [
          {
            userId,
            ourBalance: result.ourBalance,
            moySkladBalance: result.moySkladBalance,
            synced: result.synced,
            error: result.error
          }
        ]
      });
    }

    // Sync all users for project (with batching)
    const users = await db.user.findMany({
      where: {
        projectId,
        moySkladDirectCounterpartyId: { not: null }
      },
      select: {
        id: true,
        moySkladDirectCounterpartyId: true
      }
    });

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        errorsCount: 0,
        message: 'No users linked to МойСклад counterparties'
      });
    }

    // Process in batches of 10
    const BATCH_SIZE = 10;
    const results: any[] = [];
    let syncedCount = 0;
    let errorsCount = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map((user) => syncService.checkAndSyncBalance(user.id))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const user = batch[j];

        if (result.status === 'fulfilled') {
          const balanceResult = result.value;
          results.push({
            userId: user.id,
            ourBalance: balanceResult.ourBalance,
            moySkladBalance: balanceResult.moySkladBalance,
            synced: balanceResult.synced,
            error: balanceResult.error
          });

          if (balanceResult.error) {
            errorsCount++;
          } else {
            syncedCount++;
          }
        } else {
          results.push({
            userId: user.id,
            error: result.reason.message
          });
          errorsCount++;
        }
      }

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(
      'Manual bulk sync completed',
      {
        projectId,
        totalUsers: users.length,
        syncedCount,
        errorsCount
      },
      'moysklad-direct-api'
    );

    return NextResponse.json({
      success: true,
      syncedCount,
      errorsCount,
      totalUsers: users.length,
      results
    });
  } catch (error) {
    logger.error('Error during manual sync', { error }, 'moysklad-direct-api');
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}
