/**
 * @file: src/app/api/projects/route.ts
 * @description: API для управления проектами (CRUD операции)
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, Prisma, ProjectService
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project.service';
import { logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation/api-schemas';
import {
  createProjectSchema,
  type CreateProjectInput
} from '@/lib/validation/schemas';
import { getCurrentAdmin } from '@/lib/auth';
import { z } from 'zod';
// import { db } from '@/lib/db'; // удалено как неиспользуемое
// import type { CreateProjectInput } from '@/types/bonus';

// GET /api/projects - Получение списка проектов
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Фильтруем проекты по владельцу
    const result = await ProjectService.getProjects(page, limit, admin.sub);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Ошибка получения списка проектов', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'projects-api',
      action: 'GET'
    });
    return NextResponse.json(
      { error: 'Ошибка получения проектов' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Создание нового проекта
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Логируем начало процесса
    logger.info('Creating new project - started', {
      adminId: admin.sub,
      component: 'projects-api'
    });

    // Проверка лимита проектов
    const { BillingService } = await import('@/lib/services/billing.service');
    const limitCheck = await BillingService.checkLimit(admin.sub, 'projects');
    
    logger.info('Project limit check result', {
      adminId: admin.sub,
      allowed: limitCheck.allowed,
      used: limitCheck.used,
      limit: limitCheck.limit,
      planId: limitCheck.planId
    });
    
    if (!limitCheck.allowed) {
      logger.warn('Project limit reached', {
        adminId: admin.sub,
        used: limitCheck.used,
        limit: limitCheck.limit
      });
      return NextResponse.json(
        { 
          error: `Лимит проектов исчерпан (${limitCheck.used}/${limitCheck.limit}). Обновите тарифный план для увеличения лимита.`,
          limitReached: true,
          currentUsage: limitCheck.used,
          limit: limitCheck.limit,
          planId: limitCheck.planId
        },
        { status: 402 }
      );
    }

    // Валидация входных данных с Zod
    const validatedData = await validateRequest(request, createProjectSchema);
    
    logger.info('Creating project with data', {
      adminId: admin.sub,
      projectName: validatedData.name,
      hasDomain: !!validatedData.domain
    });

    // Создаем проект
    const project = await ProjectService.createProject(validatedData as any, admin.sub);

    logger.info('Project created successfully', {
      adminId: admin.sub,
      projectId: project.id,
      projectName: project.name
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    // Детальное логирование ошибки
    logger.error('Failed to create project', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      stack: error instanceof Error ? error.stack : undefined,
      component: 'projects-api',
      action: 'POST'
    });

    // Обработка известных ошибок
    if (error instanceof Error) {
      if (error.message.startsWith('Validation error:')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Проект с таким доменом уже существует' },
          { status: 409 }
        );
      }
    }

    // В development режиме возвращаем детали ошибки
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { 
        error: 'Ошибка создания проекта',
        ...(isDev && error instanceof Error && { details: error.message })
      },
      { status: 500 }
    );
  }
}
