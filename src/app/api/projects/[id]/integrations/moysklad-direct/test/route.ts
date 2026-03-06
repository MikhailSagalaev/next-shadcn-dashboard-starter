/**
 * @file: route.ts
 * @description: Test connection endpoint for МойСклад Direct integration
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15 App Router, MoySkladClient
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { MoySkladClient } from '@/lib/moysklad-direct/client';

/**
 * POST /api/projects/[id]/integrations/moysklad-direct/test
 *
 * Test connection to МойСклад API with current integration settings
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

    // Create client and test connection
    const client = new MoySkladClient({
      accountId: integration.accountId,
      apiToken: integration.apiToken,
      bonusProgramId: integration.bonusProgramId
    });

    const result = await client.testConnection();

    if (result.success) {
      logger.info(
        'МойСклад connection test successful',
        {
          projectId,
          integrationId: integration.id
        },
        'moysklad-direct-api'
      );

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        details: result.details
      });
    } else {
      logger.warn(
        'МойСклад connection test failed',
        {
          projectId,
          integrationId: integration.id,
          error: result.error
        },
        'moysklad-direct-api'
      );

      return NextResponse.json(
        {
          success: false,
          message: 'Connection failed',
          error: result.error
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error(
      'Error testing МойСклад connection',
      { error },
      'moysklad-direct-api'
    );
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
