/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Request Verification Code
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /counterparty/verify - Request verification code
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  RequestVerificationCodeRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  RequestVerificationCodeResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  generateVerificationCode,
  storeVerificationCode,
  sendVerificationCode,
  checkVerificationRateLimit
} from '@/lib/moysklad-loyalty/verification-code-service';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/counterparty/verify - Request verification code
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
      '/counterparty/verify',
      'POST',
      body
    );

    // 4. Валидация
    const validation = validateRequest(
      RequestVerificationCodeRequestSchema,
      body
    );
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
        id: true,
        phone: true,
        telegramChatId: true
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

    // 6. Проверяем rate limit (3 запроса за 10 минут)
    const rateLimitCheck = await checkVerificationRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      const processingTime = Date.now() - startTime;
      await logApiError(logId, 429, 'Rate limit exceeded', processingTime);

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          429,
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          `Превышен лимит запросов кодов верификации. Попробуйте через ${rateLimitCheck.retryAfterSeconds} секунд`
        ).toJSON(),
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitCheck.retryAfterSeconds) }
        }
      );
    }

    // 7. Проверяем доступность способа отправки
    if (!user.phone && !user.telegramChatId) {
      const processingTime = Date.now() - startTime;
      await logApiError(
        logId,
        400,
        'No delivery method available',
        processingTime
      );

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          400,
          ErrorCodes.BAD_REQUEST,
          'Невозможно отправить код верификации: не указан телефон или Telegram'
        ).toJSON(),
        { status: 400 }
      );
    }

    // 8. Генерируем код верификации
    const code = generateVerificationCode();

    // 9. Сохраняем код в БД (истекает через 5 минут)
    await storeVerificationCode(user.id, code);

    // 10. Отправляем код
    const sendResult = await sendVerificationCode(user.id, code, projectId);

    if (!sendResult.success) {
      const processingTime = Date.now() - startTime;
      await logApiError(
        logId,
        500,
        sendResult.error || 'Failed to send code',
        processingTime
      );

      return NextResponse.json(
        new LoyaltyApiErrorClass(
          500,
          ErrorCodes.INTERNAL_ERROR,
          'Не удалось отправить код верификации'
        ).toJSON(),
        { status: 500 }
      );
    }

    // 11. Возвращаем ответ
    const response: RequestVerificationCodeResponse = {
      message: `Код верификации отправлен ${sendResult.method === 'telegram' ? 'в Telegram' : 'по SMS'}`
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 200, response, processingTime);

    logger.info(
      'МойСклад verification code sent',
      {
        userId: user.id,
        counterpartyId,
        method: sendResult.method,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error sending МойСклад verification code',
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
