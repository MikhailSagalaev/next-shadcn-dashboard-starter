/**
 * @file: src/app/api/projects/[id]/route.ts
 * @description: API для работы с отдельным проектом (GET, PUT, DELETE)
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, Prisma, ProjectService
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ProjectService } from '@/lib/services/project.service';
import { getCurrentAdmin } from '@/lib/auth';
import { botManager } from '@/lib/telegram/bot-manager';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let admin: Awaited<ReturnType<typeof getCurrentAdmin>> = null;
  let projectId: string = '';

  try {
    admin = await getCurrentAdmin();
    if (!admin) {
      logger.warn('GET /api/projects/[id]: Unauthorized - admin not found', {
        component: 'projects-api',
        action: 'GET'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    projectId = id;

    logger.info('GET /api/projects/[id]: начало запроса', {
      projectId: id,
      adminId: admin.sub,
      component: 'projects-api'
    });

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(id, admin.sub);

    // Получаем проект со связанными данными
    // Безопасная загрузка referralProgram - если его нет или есть ошибка, просто не включаем
    let project;
    try {
      project = await db.project.findUnique({
        where: { id },
        include: {
          referralProgram: {
            include: {
              levels: true
            }
          }
        }
      });
    } catch (dbError) {
      // Если ошибка при загрузке referralProgram, пробуем загрузить без него
      logger.warn(
        'Ошибка при загрузке referralProgram, загружаем проект без него',
        {
          projectId: id,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          component: 'projects-api'
        }
      );

      project = await db.project.findUnique({
        where: { id }
      });

      if (project) {
        (project as any).referralProgram = null;
      }
    }

    if (!project) {
      logger.warn('GET /api/projects/[id]: проект не найден', {
        projectId: id,
        adminId: admin.sub,
        component: 'projects-api'
      });
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Подсчитываем количество пользователей отдельно
    const userCount = await db.user.count({
      where: { projectId: id }
    });

    // Возвращаем проект с подсчетом пользователей
    const response = {
      ...project,
      _count: {
        users: userCount
      }
    };

    logger.info('GET /api/projects/[id]: успешно', {
      projectId: id,
      adminId: admin.sub,
      component: 'projects-api'
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Неизвестная ошибка';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Обработка ошибок доступа
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      logger.warn('GET /api/projects/[id]: Forbidden', {
        projectId: projectId,
        adminId: admin?.sub,
        component: 'projects-api'
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Безопасное логирование
    try {
      logger.error('Ошибка получения проекта', {
        projectId: projectId,
        adminId: admin?.sub,
        error: errorMessage,
        stack: errorStack,
        component: 'projects-api',
        action: 'GET'
      });
    } catch (logError) {
      console.error('Ошибка получения проекта', {
        projectId: projectId,
        adminId: admin?.sub,
        error: errorMessage,
        stack: errorStack
      });
    }

    // В development режиме возвращаем детали ошибки
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        ...(isDev && { details: errorMessage, stack: errorStack })
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(id, admin.sub);

    // Фиксируем текущий режим для корректной остановки бота
    const existingProject = await db.project.findUnique({
      where: { id },
      select: { operationMode: true }
    });

    const body = await request.json();

    // Валидация operationMode
    const validOperationModes = ['WITH_BOT', 'WITHOUT_BOT'];
    if (
      body.operationMode &&
      !validOperationModes.includes(body.operationMode)
    ) {
      return NextResponse.json(
        {
          error:
            'Недопустимое значение operationMode. Допустимые значения: WITH_BOT, WITHOUT_BOT'
        },
        { status: 400 }
      );
    }

    const updatedProject = await db.project.update({
      where: { id },
      data: {
        name: body.name,
        domain: body.domain,
        bonusPercentage: body.bonusPercentage,
        bonusExpiryDays: body.bonusExpiryDays,
        bonusBehavior: body.bonusBehavior,
        operationMode: body.operationMode,
        isActive: body.isActive,
        // Приветственное вознаграждение
        welcomeBonus:
          body.welcomeBonusAmount !== undefined
            ? body.welcomeBonusAmount
            : undefined,
        welcomeRewardType: body.welcomeRewardType,
        firstPurchaseDiscountPercent: body.firstPurchaseDiscountPercent,
        // ✨ НОВОЕ: Workflow лимиты
        workflowMaxSteps:
          body.workflowMaxSteps !== undefined
            ? body.workflowMaxSteps
            : undefined,
        workflowTimeoutMs:
          body.workflowTimeoutMs !== undefined
            ? body.workflowTimeoutMs
            : undefined
      }
    });

    // Если режим изменился с WITH_BOT на WITHOUT_BOT — останавливаем бот идемпотентно
    if (
      existingProject?.operationMode === 'WITH_BOT' &&
      body.operationMode === 'WITHOUT_BOT'
    ) {
      try {
        await botManager.stopBot(id);
        logger.info('Бот остановлен после переключения на WITHOUT_BOT', {
          projectId: id,
          component: 'projects-api'
        });
      } catch (stopError) {
        logger.warn('Не удалось остановить бота после смены режима', {
          projectId: id,
          error:
            stopError instanceof Error ? stopError.message : String(stopError),
          component: 'projects-api'
        });
      }
    }

    logger.info('Проект обновлен', {
      projectId: id,
      operationMode: body.operationMode,
      welcomeRewardType: body.welcomeRewardType,
      component: 'projects-api'
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    const { id } = await context.params;

    // Обработка ошибок доступа
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error('Ошибка обновления проекта', { projectId: id, error });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Проверяем доступ к проекту
    await ProjectService.verifyProjectAccess(id, admin.sub);

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id }
    });

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Удаляем проект (каскадное удаление настроено в схеме)
    await db.project.delete({
      where: { id }
    });

    logger.info('Проект удален', { projectId: id, projectName: project.name });

    return NextResponse.json(
      { message: 'Проект успешно удален' },
      { status: 200 }
    );
  } catch (error) {
    const { id } = await context.params;

    // Обработка ошибок доступа
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error('Ошибка удаления проекта', { projectId: id, error });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
