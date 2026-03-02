/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Create Sale (Finalize Transaction)
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /retaildemand - Create sale
 *
 * КРИТИЧНО: Применяет логику BonusBehavior при начислении бонусов
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  CreateSaleRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  CreateSaleResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import { applyBonusBehavior } from '@/lib/moysklad-loyalty/bonus-calculation-service';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/retaildemand - Create sale
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const startTime = Date.now();
  const { projectId } = params;
  let logId = '';

  try {
    // 1. Аутентификация
    const authResult = await authenticateRequest(request, projectId);
    if (!authResult.success) {
      return authResult.response;
    }

    const integrationId = authResult.integrationId;

    // 2. Парсим request body
    const body = await request.json();

    // 3. Логируем запрос
    logId = await logApiRequest(integrationId, '/retaildemand', 'POST', body);

    // 4. Валидация
    const validation = validateRequest(CreateSaleRequestSchema, body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.errors);
      const processingTime = Date.now() - startTime;

      await logApiError(logId, 400, errors.join('; '), processingTime);

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          400,
          ErrorCodes.BAD_REQUEST,
          `Ошибки валидации: ${errors.join('; ')}`
        ).toJSON(),
        { status: 400 }
      );
    }

    const { agent, sum, transactionType, bonusProgram, meta } = validation.data;
    const counterpartyId = agent.meta.id;
    const moySkladSaleId = meta?.id || `ms_sale_${Date.now()}`;

    // 5. Находим пользователя
    const user = await db.user.findFirst({
      where: {
        projectId,
        moySkladCounterpartyId: counterpartyId
      },
      select: {
        id: true
      }
    });

    if (!user) {
      const processingTime = Date.now() - startTime;
      await logApiError(logId, 404, 'User not found', processingTime);

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          404,
          ErrorCodes.NOT_FOUND,
          'Покупатель не найден'
        ).toJSON(),
        { status: 404 }
      );
    }

    // 6. Получаем настройки проекта и интеграции
    const [project, integration] = await Promise.all([
      db.project.findUnique({
        where: { id: projectId },
        select: {
          bonusBehavior: true,
          bonusExpiryDays: true
        }
      }),
      db.moySkladIntegration.findUnique({
        where: { projectId },
        select: {
          bonusPercentage: true
        }
      })
    ]);

    if (!project || !integration) {
      const processingTime = Date.now() - startTime;
      await logApiError(
        logId,
        404,
        'Project or integration not found',
        processingTime
      );

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          404,
          ErrorCodes.NOT_FOUND,
          'Проект или интеграция не найдены'
        ).toJSON(),
        { status: 404 }
      );
    }

    // 7. Используем database transaction для атомарности
    const result = await db.$transaction(async (tx) => {
      let earnedBonus = 0;
      let spentBonus = 0;

      if (transactionType === 'EARNING') {
        // 8a. EARNING - начисление бонусов
        const spentBonuses = bonusProgram?.spentBonus || 0;

        // КРИТИЧНО: Применяем логику BonusBehavior
        earnedBonus = applyBonusBehavior({
          totalAmount: sum,
          spentBonuses,
          bonusPercentage: Number(integration.bonusPercentage),
          bonusBehavior: project.bonusBehavior
        });

        if (earnedBonus > 0) {
          // Создаем Bonus запись с expiry
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + project.bonusExpiryDays);

          await tx.bonus.create({
            data: {
              userId: user.id,
              amount: earnedBonus,
              type: 'PURCHASE',
              description: `Начисление за покупку в МойСклад (${sum}₽)`,
              expiresAt
            }
          });

          // Создаем Transaction запись
          await tx.transaction.create({
            data: {
              userId: user.id,
              amount: earnedBonus,
              type: 'EARN',
              description: `Начисление за покупку в МойСклад (${sum}₽)`,
              moySkladSaleId
            }
          });
        }

        // Если были списаны бонусы, создаем транзакцию списания
        if (spentBonuses > 0) {
          spentBonus = spentBonuses;

          // Списываем бонусы (FIFO - сначала самые старые)
          const availableBonuses = await tx.bonus.findMany({
            where: {
              userId: user.id,
              isUsed: false,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          let remainingToSpend = spentBonuses;
          for (const bonus of availableBonuses) {
            if (remainingToSpend <= 0) break;

            const bonusAmount = Number(bonus.amount);
            const amountToUse = Math.min(bonusAmount, remainingToSpend);

            if (amountToUse >= bonusAmount) {
              // Используем весь бонус
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { isUsed: true }
              });
            } else {
              // Частичное использование - уменьшаем сумму
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { amount: bonusAmount - amountToUse }
              });
            }

            remainingToSpend -= amountToUse;
          }

          // Создаем транзакцию списания
          await tx.transaction.create({
            data: {
              userId: user.id,
              amount: spentBonuses,
              type: 'SPEND',
              description: `Списание бонусов в МойСклад (${sum}₽)`,
              moySkladSaleId
            }
          });
        }
      } else {
        // 8b. SPENDING - только списание бонусов
        spentBonus = bonusProgram?.spentBonus || 0;

        if (spentBonus > 0) {
          // Списываем бонусы (FIFO)
          const availableBonuses = await tx.bonus.findMany({
            where: {
              userId: user.id,
              isUsed: false,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          let remainingToSpend = spentBonus;
          for (const bonus of availableBonuses) {
            if (remainingToSpend <= 0) break;

            const bonusAmount = Number(bonus.amount);
            const amountToUse = Math.min(bonusAmount, remainingToSpend);

            if (amountToUse >= bonusAmount) {
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { isUsed: true }
              });
            } else {
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { amount: bonusAmount - amountToUse }
              });
            }

            remainingToSpend -= amountToUse;
          }

          // Создаем транзакцию списания
          await tx.transaction.create({
            data: {
              userId: user.id,
              amount: spentBonus,
              type: 'SPEND',
              description: `Списание бонусов в МойСклад (${sum}₽)`,
              moySkladSaleId
            }
          });
        }
      }

      return { earnedBonus, spentBonus };
    });

    // 9. Возвращаем ответ
    const response: CreateSaleResponse = {
      meta: {
        id: moySkladSaleId
      },
      bonusProgram: {
        earnedBonus: result.earnedBonus > 0 ? result.earnedBonus : undefined,
        spentBonus: result.spentBonus > 0 ? result.spentBonus : undefined
      }
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 201, response, processingTime);

    logger.info(
      'МойСклад sale created',
      {
        userId: user.id,
        counterpartyId,
        moySkladSaleId,
        sum,
        transactionType,
        earnedBonus: result.earnedBonus,
        spentBonus: result.spentBonus,
        bonusBehavior: project.bonusBehavior,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error creating МойСклад sale',
      {
        error,
        projectId
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(
      new LoyaltyApiErrorClass(
        500,
        ErrorCodes.INTERNAL_ERROR,
        'Внутренняя ошибка сервера'
      ).toJSON(),
      { status: 500 }
    );
  }
}
