/**
 * @file: src/app/api/projects/[id]/retailcrm/route.ts
 * @description: API для управления интеграцией RetailCRM
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateIntegrationSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  isActive: z.boolean().optional(),
  syncOrders: z.boolean().optional(),
  syncCustomers: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const integration = await db.retailCrmIntegration.findUnique({
      where: { projectId },
    });

    return NextResponse.json({ integration: integration || null });
  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения интеграции' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await ProjectService.verifyProjectAccess(projectId, admin.sub);

    const body = await request.json();
    const data = updateIntegrationSchema.parse(body);

    const integration = await db.retailCrmIntegration.upsert({
      where: { projectId },
      create: {
        projectId,
        ...data,
        isActive: data.isActive ?? false,
        syncOrders: data.syncOrders ?? true,
        syncCustomers: data.syncCustomers ?? true,
      },
      update: data,
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Ошибка сохранения интеграции' },
      { status: 500 }
    );
  }
}

