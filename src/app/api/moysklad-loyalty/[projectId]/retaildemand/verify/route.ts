/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Verify Bonus Spending
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /retaildemand/verify - Verify spending
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  VerifySpendingRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  VerifySpendingResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  validateVerificationCode,
  expireVerificationCode
} from '@/lib/moysklad-loyalty/verification-code-service';
import { checkSufficientBalance } from '@/lib/moysklad-loyalty/bonus-calculation-service';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/retaildemand/verify - Verify spending
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
      '/retaildemand/verify',
      'POST',
      body
    );

    // 4. Валидация
    const validation = validateRequest(VerifySpendingRequestSchema, body);
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

    const { meta, bonusAmount, verificationCode } = validation.data;
    const counterpartyId = meta.id;

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

    // 6. Валидируем код верификации
    const codeValidation = await validateVerificationCode(
      user.id,
      verificationCode
    );

    if (!codeValidation.valid) {
      const processingTime = Date.now() - startTime;
      await logApiError(
        logId,
        403,
        codeValidation.error || 'Invalid code',
        processingTime
      );

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          403,
          ErrorCodes.INVALID_VERIFICATION_CODE,
          codeValidation.error || 'Неверный код верификации'
        ).toJSON(),
        { status: 403 }
      );
    }

    // 7. Проверяем достаточность баланса
    const balanceCheck = await checkSufficientBalance(user.id, bonusAmount);

    if (!balanceCheck.sufficient) {
      const processingTime = Date.now() - startTime;
      await logApiError(logId, 400, 'Insufficient balance', processingTime);

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          400,
          ErrorCodes.INSUFFICIENT_BALANCE,
          `Недостаточно бонусов. Доступно: ${balanceCheck.available}, требуется: ${bonusAmount}`
        ).toJSON(),
        { status: 400 }
      );
    }

    // 8. Помечаем код как использованный
    await expireVerificationCode(user.id, verificationCode);

    // 9. Возвращаем подтверждение
    const response: VerifySpendingResponse = {
      success: true,
      message: 'Списание бонусов подтверждено'
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 200, response, processingTime);

    logger.info(
      'МойСклад spending verified',
      {
        userId: user.id,
        counterpartyId,
        bonusAmount,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error verifying МойСклад spending',
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
