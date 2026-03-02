/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Counterparty endpoints
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoints:
 * - POST /counterparty - Create customer
 * - GET /counterparty - Search customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import { normalizePhoneNumber } from '@/lib/moysklad-loyalty/phone-normalizer';
import {
  CreateCounterpartyRequestSchema,
  SearchCounterpartyRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  CreateCounterpartyResponse,
  SearchCounterpartyResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/counterparty - Create customer
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
    logId = await logApiRequest(integrationId, '/counterparty', 'POST', body);

    // 4. Валидация
    const validation = validateRequest(CreateCounterpartyRequestSchema, body);
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

    const { name, phone, email, cardNumber } = validation.data;

    // 5. Нормализуем телефон
    let normalizedPhone: string | null = null;
    if (phone) {
      normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        const processingTime = Date.now() - startTime;
        await logApiError(logId, 400, 'Invalid phone format', processingTime);

        return NextResponse.json(
          new LoyaltyApiErrorClass(
            400,
            ErrorCodes.INVALID_PHONE_FORMAT,
            'Неверный формат номера телефона'
          ).toJSON(),
          { status: 400 }
        );
      }
    }

    // 6. Проверяем существование пользователя
    const existingUser = await db.user.findFirst({
      where: {
        projectId,
        OR: [
          normalizedPhone ? { phone: normalizedPhone } : {},
          email ? { email } : {}
        ].filter((condition) => Object.keys(condition).length > 0)
      },
      include: {
        bonuses: {
          where: {
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        }
      }
    });

    if (existingUser) {
      // Пользователь уже существует
      const balance = existingUser.bonuses.reduce(
        (sum, bonus) => sum + Number(bonus.amount),
        0
      );

      const response: CreateCounterpartyResponse = {
        meta: {
          id: existingUser.moySkladCounterpartyId || existingUser.id
        },
        name: existingUser.firstName || name,
        phone: existingUser.phone || undefined,
        email: existingUser.email || undefined,
        bonusProgram: {
          agentBonusBalance: balance
        }
      };

      const processingTime = Date.now() - startTime;
      await logApiResponse(logId, 409, response, processingTime);

      return NextResponse.json(response, { status: 409 });
    }

    // 7. Создаем нового пользователя
    // Генерируем уникальный МойСклад Counterparty ID
    const counterpartyId = `ms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const newUser = await db.user.create({
      data: {
        projectId,
        firstName: name,
        phone: normalizedPhone || undefined,
        email: email || undefined,
        moySkladCounterpartyId: counterpartyId,
        isActive: true,
        metadata: {
          cardNumber: cardNumber || undefined,
          source: 'moysklad'
        }
      }
    });

    // 8. Применяем приветственные бонусы (если настроено)
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        welcomeBonus: true,
        welcomeRewardType: true,
        bonusExpiryDays: true
      }
    });

    let initialBalance = 0;

    if (
      project &&
      project.welcomeRewardType === 'BONUS' &&
      Number(project.welcomeBonus) > 0
    ) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + project.bonusExpiryDays);

      await db.bonus.create({
        data: {
          userId: newUser.id,
          amount: project.welcomeBonus,
          type: 'WELCOME',
          description: 'Приветственный бонус',
          expiresAt
        }
      });

      await db.transaction.create({
        data: {
          userId: newUser.id,
          amount: project.welcomeBonus,
          type: 'EARN',
          description: 'Приветственный бонус'
        }
      });

      initialBalance = Number(project.welcomeBonus);

      logger.info(
        'Welcome bonus applied for МойСклад user',
        {
          userId: newUser.id,
          amount: project.welcomeBonus
        },
        'moysklad-loyalty'
      );
    }

    // 9. Возвращаем ответ
    const response: CreateCounterpartyResponse = {
      meta: {
        id: counterpartyId
      },
      name,
      phone: normalizedPhone || undefined,
      email: email || undefined,
      cardNumber: cardNumber || undefined,
      bonusProgram: {
        agentBonusBalance: initialBalance
      }
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 201, response, processingTime);

    logger.info(
      'МойСклад counterparty created',
      {
        userId: newUser.id,
        counterpartyId,
        initialBalance
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error creating МойСклад counterparty',
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

// GET /api/moysklad-loyalty/[projectId]/counterparty - Search customer
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
    const search = searchParams.get('search');
    const retailStoreId = searchParams.get('retailStoreId');

    // 3. Логируем запрос
    logId = await logApiRequest(integrationId, '/counterparty', 'GET', {
      search,
      retailStoreId
    });

    // 4. Валидация
    const validation = validateRequest(SearchCounterpartyRequestSchema, {
      search,
      retailStoreId
    });

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

    // 5. Нормализуем search (если это телефон)
    let searchTerm = validation.data.search;
    const normalizedPhone = normalizePhoneNumber(searchTerm);
    if (normalizedPhone) {
      searchTerm = normalizedPhone;
    }

    // 6. Ищем пользователей
    const users = await db.user.findMany({
      where: {
        projectId,
        OR: [
          { phone: searchTerm },
          { email: searchTerm },
          { metadata: { path: ['cardNumber'], equals: searchTerm } }
        ]
      },
      select: {
        id: true,
        moySkladCounterpartyId: true,
        firstName: true,
        phone: true,
        email: true,
        metadata: true
      },
      take: 10 // Ограничиваем результаты
    });

    // 7. Форматируем ответ
    const response: SearchCounterpartyResponse = {
      rows: users.map((user) => ({
        id: user.moySkladCounterpartyId || user.id,
        name: user.firstName || 'Клиент',
        phone: user.phone || undefined,
        email: user.email || undefined,
        cardNumber: (user.metadata as any)?.cardNumber || undefined
      }))
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 200, response, processingTime);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error searching МойСклад counterparty',
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
