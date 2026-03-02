/**
 * @file: route.ts
 * @description: МойСклад Loyalty API - Create Return
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Endpoint: POST /retailsalesreturn - Create return
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/moysklad-loyalty/auth-middleware';
import {
  CreateReturnRequestSchema,
  validateRequest,
  formatValidationErrors
} from '@/lib/moysklad-loyalty/validation';
import {
  CreateReturnResponse,
  LoyaltyApiErrorClass,
  ErrorCodes
} from '@/lib/moysklad-loyalty/types';
import {
  logApiRequest,
  logApiResponse,
  logApiError
} from '@/lib/moysklad-loyalty/api-logger';
import { logger } from '@/lib/logger';

// POST /api/moysklad-loyalty/[projectId]/retailsalesreturn - Create return
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
      '/retailsalesreturn',
      'POST',
      body
    );

    // 4. Валидация
    const validation = validateRequest(CreateReturnRequestSchema, body);
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

    const { agent, sum, demand } = validation.data;
    const counterpartyId = agent.meta.id;
    const originalSaleId = demand?.meta.id;

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

    // 6. Находим оригинальные транзакции по МойСклад sale ID
    let originalTransactions: any[] = [];
    if (originalSaleId) {
      originalTransactions = await db.transaction.findMany({
        where: {
          userId: user.id,
          moySkladSaleId: originalSaleId as any // Type assertion до регенерации Prisma Client
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (originalTransactions.length === 0) {
        logger.warn(
          'МойСклад return: Original sale not found',
          {
            userId: user.id,
            originalSaleId
          },
          'moysklad-loyalty'
        );
      }
    }

    // 7. Используем database transaction для атомарности
    const result = await db.$transaction(async (tx) => {
      let returnedBonus = 0;

      // Реверсируем транзакции
      for (const originalTx of originalTransactions) {
        const amount = Number(originalTx.amount);

        if (originalTx.type === 'EARN') {
          // Реверсируем начисление - вычитаем бонусы
          // Находим неиспользованные бонусы пользователя
          const availableBonuses = await tx.bonus.findMany({
            where: {
              userId: user.id,
              isUsed: false,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: {
              createdAt: 'desc' // Сначала самые новые
            }
          });

          let remainingToDeduct = amount;
          for (const bonus of availableBonuses) {
            if (remainingToDeduct <= 0) break;

            const bonusAmount = Number(bonus.amount);
            const amountToDeduct = Math.min(bonusAmount, remainingToDeduct);

            if (amountToDeduct >= bonusAmount) {
              // Удаляем весь бонус
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { isUsed: true }
              });
            } else {
              // Уменьшаем сумму бонуса
              await tx.bonus.update({
                where: { id: bonus.id },
                data: { amount: bonusAmount - amountToDeduct }
              });
            }

            remainingToDeduct -= amountToDeduct;
          }

          returnedBonus += amount;
        } else if (originalTx.type === 'SPEND') {
          // Реверсируем списание - возвращаем бонусы
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 365); // Возвращенные бонусы действуют год

          await tx.bonus.create({
            data: {
              userId: user.id,
              amount,
              type: 'MANUAL', // Возвращенные бонусы как ручное начисление
              description: `Возврат бонусов за возврат товара (${sum}₽)`,
              expiresAt
            }
          });

          returnedBonus += amount;
        }
      }

      // Создаем транзакцию возврата
      const returnId = `ms_return_${Date.now()}`;
      if (returnedBonus > 0) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            amount: returnedBonus,
            type: 'RETURN' as any, // Type assertion до регенерации Prisma Client
            description: `Возврат товара в МойСклад (${sum}₽)`,
            moySkladSaleId: returnId as any // Type assertion до регенерации Prisma Client
          } as any
        });
      }

      return { returnedBonus, returnId };
    });

    // 8. Возвращаем ответ
    const response: CreateReturnResponse = {
      meta: {
        id: result.returnId
      },
      bonusProgram: {
        returnedBonus:
          result.returnedBonus > 0 ? result.returnedBonus : undefined
      }
    };

    const processingTime = Date.now() - startTime;
    await logApiResponse(logId, 201, response, processingTime);

    logger.info(
      'МойСклад return created',
      {
        userId: user.id,
        counterpartyId,
        originalSaleId,
        sum,
        returnedBonus: result.returnedBonus,
        processingTimeMs: processingTime
      },
      'moysklad-loyalty'
    );

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logApiError(logId, 500, String(error), processingTime);

    logger.error(
      'Error creating МойСклад return',
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
