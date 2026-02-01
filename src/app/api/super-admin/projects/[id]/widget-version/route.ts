/**
 * @file: src/app/api/super-admin/projects/[id]/widget-version/route.ts
 * @description: API endpoint для изменения версии виджета проекта
 * @project: SaaS Bonus System
 * @created: 2026-02-01
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';

// PATCH /api/super-admin/projects/[id]/widget-version - Изменить версию виджета
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Проверка прав супер-админа
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;
    const body = await request.json();
    const { version } = body;

    // Валидация версии
    if (!version || !['legacy', 'universal'].includes(version)) {
      return NextResponse.json(
        { error: 'Invalid version. Must be "legacy" or "universal"' },
        { status: 400 }
      );
    }

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        widgetVersion: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Если версия уже установлена, возвращаем успех
    if (project.widgetVersion === version) {
      return NextResponse.json({
        success: true,
        message: 'Version already set',
        project: {
          id: project.id,
          name: project.name,
          widgetVersion: version
        }
      });
    }

    // Обновляем версию виджета
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: { widgetVersion: version },
      select: {
        id: true,
        name: true,
        widgetVersion: true,
        updatedAt: true
      }
    });

    // Логируем изменение
    logger.info(
      'Widget version changed',
      {
        projectId,
        projectName: project.name,
        fromVersion: project.widgetVersion,
        toVersion: version,
        changedBy: admin.sub
      },
      'widget-version-api'
    );

    // Создаем запись в системных логах
    await db.systemLog.create({
      data: {
        projectId,
        level: 'INFO',
        message: `Widget version changed from ${project.widgetVersion} to ${version}`,
        source: 'api',
        context: {
          fromVersion: project.widgetVersion,
          toVersion: version,
          changedBy: admin.sub,
          changedAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Widget version updated successfully',
      project: updatedProject
    });
  } catch (error) {
    logger.error(
      'Error updating widget version',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-version-api'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/super-admin/projects/[id]/widget-version - Получить текущую версию виджета
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Проверка прав супер-админа
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Получаем проект
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        widgetVersion: true,
        updatedAt: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project
    });
  } catch (error) {
    logger.error(
      'Error fetching widget version',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-version-api'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
