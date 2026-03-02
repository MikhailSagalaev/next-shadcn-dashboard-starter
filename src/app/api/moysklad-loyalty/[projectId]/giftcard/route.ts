/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Gift Card Search (Optional)
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: GET /giftcard - Search gift card
 *
 * NOTE: Это опциональный endpoint. Возвращает 501 Not Implemented
 * если функция подарочных карт не включена в проекте.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  SearchGiftCardRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  SearchGiftCardResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// GET /api/moysklad-loyalty/[projectId]/giftcard - Search gift card
export async function GET(
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

    // 2. Извлекаем query параметры
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    // 3. Логируем запрос
    logId = await logApiRequest(integrationId, '/giftcard', 'GET', { name });

    // 4. Валидация
    const validation = validateRequest(SearchGiftCardRequestSchema, { name });
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

    // 5. Функция подарочных карт не реализована
    // Возвращаем 501 Not Implemented
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 501, 'Gift cards not implemented', processingTime);

    logger.info(
      'МойСклад gift card search - not implemented',
      {
        projectId,
        name: validation.data.name
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(
      {
        error: {
          message: 'Функция подарочных карт не реализована',
          code: 'NOT_IMPLEMENTED'
        }
      },
      { status: 501 }
    );

    // TODO: Если в будущем добавим подарочные карты, реализовать здесь:
    //
    // const giftCard = await db.giftCard.findUnique({
    //   where: {
    //     projectId,
    //     code: validation.data.name,
    //   },
    // });
    //
    // if (!giftCard) {
    //   const response: SearchGiftCardResponse = { rows: [] };
    //   return NextResponse.json(response, { status: 200 });
    // }
    //
    // const response: SearchGiftCardResponse = {
    //   rows: [{
    //     id: giftCard.id,
    //     name: giftCard.code,
    //     balance: Number(giftCard.balance),
    //     status: giftCard.isActive ? 'active' : 'inactive',
    //   }],
    // };
    //
    // return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error searching МойСклад gift card',
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
