/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Get Counterparty Balance
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /counterparty/detail - Get balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  GetBalanceRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  GetBalanceResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import { getUserAvailableBalance } from '@/lib/moysklad-loyalty/bonus-calculation-service';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/counterparty/detail - Get balance
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
      '/counterparty/detail',
      'POST',
      body
    );

    // 4. Валидация
    const validation = validateRequest(GetBalanceRequestSchema, body);
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

    const { meta } = validation.data;
    const counterpartyId = meta.id;

    // 5. Находим пользователя по МойСклад Counterparty ID
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

    // 6. Получаем доступный баланс (исключая истекшие бонусы)
    const balance = await getUserAvailableBalance(user.id);

    // 7. Форматируем и возвращаем ответ
    const response: GetBalanceResponse = {
      bonusProgram: {
        agentBonusBalance: balance
      }
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 200, response, processingTime);

    logger.info(
      'МойСклад balance check',
      {
        userId: user.id,
        counterpartyId,
        balance,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error getting МойСклад balance',
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
