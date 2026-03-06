/**
 * @file: route.ts
 * @description: Sync logs query endpoint for МойСклад Direct integration
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15 App Router, Prisma
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { z } from 'zod';

const logsQuerySchema = z.object({
  operation: z
    .enum(['bonus_accrual', 'bonus_spending', 'balance_sync'])
    .optional(),
  direction: z.enum(['incoming', 'outgoing']).optional(),
  status: z.enum(['success', 'error', 'pending']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

/**
 * GET /api/projects/[id]/integrations/moysklad-direct/logs
 *
 * Query sync logs with filtering and pagination
 *
 * Query parameters:
 * - operation: bonus_accrual | bonus_spending | balance_sync
 * - direction: incoming | outgoing
 * - status: success | error | pending
 * - dateFrom: ISO 8601 datetime
 * - dateTo: ISO 8601 datetime
 * - limit: 1-100 (default: 50)
 * - offset: 0+ (default: 0)
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
      select: { id: true }
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      operation: searchParams.get('operation'),
      direction: searchParams.get('direction'),
      status: searchParams.get('status'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    };

    const validationResult = logsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const {
      operation,
      direction,
      status,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0
    } = validationResult.data;

    // Build where clause
    const where: any = {
      integrationId: integration.id
    };

    if (operation) {
      where.operation = operation;
    }

    if (direction) {
      where.direction = direction;
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Execute queries in parallel
    const [logs, totalCount] = await Promise.all([
      db.moySkladDirectSyncLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      db.moySkladDirectSyncLog.count({ where })
    ]);

    logger.info(
      'Sync logs queried',
      {
        projectId,
        integrationId: integration.id,
        filters: { operation, direction, status, dateFrom, dateTo },
        resultCount: logs.length,
        totalCount
      },
      'moysklad-direct-api'
    );

    return NextResponse.json({
      logs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount
      }
    });
  } catch (error) {
    logger.error('Error querying sync logs', { error }, 'moysklad-direct-api');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
