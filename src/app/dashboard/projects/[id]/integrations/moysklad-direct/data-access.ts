/**
 * @file: data-access.ts
 * @description: Data loading functions for МойСклад Direct integration page
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface IntegrationPageData {
  integration: {
    id: string;
    accountId: string;
    bonusProgramId: string;
    syncDirection: string;
    autoSync: boolean;
    webhookSecret: string | null;
    isActive: boolean;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncTime: Date | null;
    totalBonusSynced: number;
  };
  recentLogs: Array<{
    id: string;
    operation: string;
    direction: string;
    status: string;
    amount: number | null;
    createdAt: Date;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    } | null;
  }>;
  projectId: string;
  webhookUrl: string;
}

export async function getIntegrationPageData(
  projectId: string,
  page: number = 1,
  limit: number = 10
): Promise<IntegrationPageData & { pagination?: any }> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect('/auth/login');
  }

  // Verify project ownership
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  });

  if (!project || project.ownerId !== admin.sub) {
    redirect('/dashboard');
  }

  try {
    // Load integration
    const integration = await db.moySkladDirectIntegration.findUnique({
      where: { projectId },
      select: {
        id: true,
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
      }
    });

    // Calculate stats
    let stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      successRate: 0,
      lastSyncTime: null as Date | null,
      totalBonusSynced: 0
    };

    let recentLogs: any[] = [];
    let pagination = { total: 0, page, limit, totalPages: 0 };

    if (integration) {
      const [syncCounts, bonusSum, logs] = await Promise.all([
        // Count syncs by status
        db.moySkladDirectSyncLog.groupBy({
          by: ['status'],
          where: { integrationId: integration.id },
          _count: true
        }),
        // Sum bonus amounts
        db.moySkladDirectSyncLog.aggregate({
          where: {
            integrationId: integration.id,
            status: 'success',
            operation: { in: ['bonus_accrual', 'bonus_spending'] }
          },
          _sum: {
            amount: true
          }
        }),
        // Count total logs for pagination
        db.moySkladDirectSyncLog.count({
          where: { integrationId: integration.id }
        }),
        // Recent logs (paginated)
        db.moySkladDirectSyncLog.findMany({
          where: { integrationId: integration.id },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ]);

      // Calculate stats
      const totalSyncs = syncCounts.reduce((sum, item) => sum + item._count, 0);
      const successfulSyncs =
        syncCounts.find((item) => item.status === 'success')?._count || 0;
      const failedSyncs =
        syncCounts.find((item) => item.status === 'error')?._count || 0;

      stats = {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
        lastSyncTime: integration.lastSyncAt,
        totalBonusSynced: Number(bonusSum._sum.amount || 0)
      };

      recentLogs = logs.map((log) => ({
        id: log.id,
        operation: log.operation,
        direction: log.direction,
        status: log.status,
        amount: log.amount ? Number(log.amount) : null,
        createdAt: log.createdAt,
        user: log.user
      }));

      const totalLogs = bonusSum[0] as unknown as number; // Quick workaround for Promise array unpacking
      pagination = {
        total: totalLogs,
        page,
        limit,
        totalPages: Math.ceil(totalLogs / limit)
      };
    }

    // Generate webhook URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
    const webhookUrl = `${baseUrl}/api/webhook/moysklad-direct/${projectId}`;

    return {
      integration,
      stats,
      recentLogs,
      projectId,
      webhookUrl,
      pagination
    };
  } catch (error) {
    logger.error(
      'Error loading integration page data',
      { error, projectId },
      'moysklad-direct-page'
    );

    // Return empty data on error
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
    return {
      integration: null,
      stats: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        successRate: 0,
        lastSyncTime: null,
        totalBonusSynced: 0
      },
      recentLogs: [],
      projectId,
      webhookUrl: `${baseUrl}/api/webhook/moysklad-direct/${projectId}`
    };
  }
}
