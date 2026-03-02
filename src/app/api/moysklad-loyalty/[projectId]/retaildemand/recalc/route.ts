/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Calculate Discounts (Recalc)
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /retaildemand/recalc - Calculate discounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  RecalcRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  RecalcResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  calculateEarnedBonuses,
  calculateMaxSpendableBonuses,
  getUserAvailableBalance,
  distributeDiscountAcrossPositions
} from '@/lib/moysklad-loyalty/bonus-calculation-service';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/retaildemand/recalc - Calculate discounts
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
    logId = await logApiRequest(
      integrationId,
      '/retaildemand/recalc',
      'POST',
      body
    );

    // 4. Валидация
    const validation = validateRequest(RecalcRequestSchema, body);
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

    const { agent, positions, transactionType, bonusProgram } = validation.data;
    const counterpartyId = agent.meta.id;

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

    // 6. Получаем настройки интеграции
    const integration = await db.moySkladIntegration.findUnique({
      where: { projectId },
      select: {
        bonusPercentage: true,
        maxBonusSpend: true
      }
    });

    if (!integration) {
      const processingTime = Date.now() - startTime;
      await logApiError(logId, 404, 'Integration not found', processingTime);

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          404,
          ErrorCodes.NOT_FOUND,
          'Интеграция не найдена'
        ).toJSON(),
        { status: 404 }
      );
    }

    // 7. Рассчитываем общую сумму
    const totalSum = positions.reduce(
      (sum, pos) => sum + pos.quantity * pos.price,
      0
    );

    let response: RecalcResponse;

    if (transactionType === 'EARNING') {
      // 8a. Расчет для EARNING - начисляемые бонусы
      const earnedBonus = calculateEarnedBonuses(
        totalSum,
        Number(integration.bonusPercentage)
      );

      response = {
        positions: positions.map((pos) => ({ ...pos, discount: 0 })),
        bonusProgram: {
          earnedBonus
        }
      };
    } else {
      // 8b. Расчет для SPENDING - максимум списываемых бонусов
      const userBalance = await getUserAvailableBalance(user.id);

      const maxSpendable = calculateMaxSpendableBonuses({
        totalAmount: totalSum,
        maxSpendPercent: Number(integration.maxBonusSpend),
        userBalance
      });

      // Клиент может запросить конкретную сумму для списания
      const requestedSpend = bonusProgram?.spentBonus || 0;
      const actualSpend = Math.min(requestedSpend, maxSpendable);

      // Проверяем достаточность баланса
      if (actualSpend > userBalance) {
        const processingTime = Date.now() - startTime;
        await logApiError(logId, 400, 'Insufficient balance', processingTime);

        return NextResponse.json(
          new LoyaltyApiErrorClass(
            400,
            ErrorCodes.INSUFFICIENT_BALANCE,
            `Недостаточно бонусов. Доступно: ${userBalance}, запрошено: ${actualSpend}`
          ).toJSON(),
          { status: 400 }
        );
      }

      // Распределяем скидку по позициям
      const positionsWithDiscounts = distributeDiscountAcrossPositions(
        positions,
        actualSpend
      );

      response = {
        positions: positions.map((pos, index) => ({
          ...pos,
          discount: positionsWithDiscounts[index].discount
        })),
        bonusProgram: {
          spentBonus: actualSpend
        }
      };
    }

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 200, response, processingTime);

    logger.info(
      'МойСклад recalc completed',
      {
        userId: user.id,
        counterpartyId,
        transactionType,
        totalSum,
        earnedBonus: response.bonusProgram.earnedBonus,
        spentBonus: response.bonusProgram.spentBonus,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error calculating МойСклад discounts',
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
