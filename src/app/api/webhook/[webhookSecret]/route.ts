/**
 * @file: route.ts
 * @description: Webhook API для обработки регистрации пользователей, покупок и списания бонусов
 * @project: SaaS Bonus System
 * @dependencies: NextRequest, NextResponse, db, ProjectService, UserService, BonusService
 * @created: 2025-01-23
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectService } from '@/lib/services/project.service';
import { UserService, BonusService } from '@/lib/services/user.service';
import { BonusLevelService } from '@/lib/services/bonus-level.service';
import { logger } from '@/lib/logger';
import { withWebhookRateLimit } from '@/lib';
import {
  validateTildaOrder,
  validateWebhookRequest,
  type TildaOrder,
  type TildaProduct
} from '@/lib/validation/webhook';
import { ZodError } from 'zod';
import type {
  WebhookRegisterUserPayload,
  WebhookPurchasePayload,
  WebhookSpendBonusesPayload
} from '@/types/bonus';

// Функция логирования webhook запросов
async function logWebhookRequest(
  projectId: string,
  endpoint: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  response: any,
  status: number,
  success: boolean
) {
  try {
    // Безопасное усечение больших тел
    const safeJson = (obj: any, limit = 10000) => {
      try {
        const str = JSON.stringify(obj);
        if (str.length > limit) {
          return { _truncated: true, preview: str.slice(0, limit) } as any;
        }
        return obj;
      } catch {
        return { _error: 'serialization_failed' } as any;
      }
    };

    await db.webhookLog.create({
      data: {
        projectId,
        endpoint,
        method,
        headers: safeJson(headers),
        body: safeJson(body),
        response: safeJson(response),
        status,
        success
      }
    });
  } catch (error) {
    logger.error('Ошибка логирования webhook', {
      projectId,
      endpoint,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'webhook-logging'
    });
  }
}

// Обработчик заказа от Tilda
async function handleTildaOrder(projectId: string, orderData: TildaOrder) {
  const { name, email, phone, payment, utm_ref } = orderData;

  if (!email && !phone) {
    throw new Error('Должен быть указан email или телефон пользователя');
  }

  // Получаем настройки проекта для определения поведения бонусов
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { bonusBehavior: true }
  });

  if (!project) {
    throw new Error('Проект не найден');
  }

  const bonusBehavior = project.bonusBehavior as
    | 'SPEND_AND_EARN'
    | 'SPEND_ONLY'
    | 'EARN_ONLY';

  // Получаем данные заказа
  const totalAmount =
    typeof payment.amount === 'string'
      ? parseInt(payment.amount) || 0
      : payment.amount || 0;

  const appliedRequested =
    typeof orderData.appliedBonuses === 'string'
      ? parseFloat(orderData.appliedBonuses) || 0
      : orderData.appliedBonuses || 0;

  // Определяем является ли промокод GUPIL
  const promoFromPayment = (payment as any)?.promocode;
  const promoFromOrderData = (orderData as any)?.promocode;

  const finalPromo = promoFromPayment || promoFromOrderData;
  const isGupilPromo =
    typeof finalPromo === 'string' &&
    finalPromo.trim().toUpperCase() === 'GUPIL';

  // Проверяем условия для списания бонусов
  // НОВАЯ ЛОГИКА: Бонусы списываются если:
  // 1. Есть appliedBonuses > 0 (виджет применил бонусы)
  // 2. И настройка проекта позволяет списывать бонусы (SPEND_AND_EARN или SPEND_ONLY)
  // Промокод GUPIL больше не проверяется, так как он создается виджетом искусственно
  const shouldSpendBonuses =
    Number.isFinite(appliedRequested) &&
    appliedRequested > 0 &&
    (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

  // ЭКСТРЕННОЕ ЛОГИРОВАНИЕ СРАЗУ ПОСЛЕ РАСЧЕТА
  logger.info('🚨 ЭКСТРЕННОЕ ЛОГИРОВАНИЕ ПОСЛЕ РАСЧЕТА shouldSpendBonuses', {
    projectId,
    orderId: payment.orderid,
    appliedRequested_initial: appliedRequested,
    bonusBehavior_initial: bonusBehavior,
    shouldSpendBonuses_calculated: shouldSpendBonuses,
    isFinite: Number.isFinite(appliedRequested),
    gt_zero: appliedRequested > 0,
    behavior_spend_and_earn: bonusBehavior === 'SPEND_AND_EARN',
    behavior_spend_only: bonusBehavior === 'SPEND_ONLY',
    component: 'tilda-webhook-emergency-log'
  });

  // ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ для отладки проблемы
  logger.info('🎯 КРИТИЧНЫЙ АНАЛИЗ СПИСАНИЯ БОНУСОВ', {
    projectId,
    orderId: payment.orderid,
    RAW_DATA: {
      appliedBonuses_from_orderData: (orderData as any).appliedBonuses,
      promocode_from_payment: (payment as any)?.promocode,
      bonusBehavior_from_project: bonusBehavior
    },
    PARSED_VALUES: {
      appliedRequested,
      isGupilPromo,
      bonusBehavior
    },
    CALCULATIONS: {
      isFinite_appliedRequested: Number.isFinite(appliedRequested),
      appliedRequested_gt_0: appliedRequested > 0,
      bonusBehavior_allows_spending:
        bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY',
      shouldSpendBonuses_RESULT: shouldSpendBonuses
    },
    component: 'tilda-webhook-critical-debug'
  });

  // Проверяем, нужно ли начислять бонусы
  const shouldEarnBonuses =
    bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'EARN_ONLY';

  logger.info('🎯 Параметры заказа Tilda', {
    projectId,
    orderId: payment.orderid,
    totalAmount,
    appliedRequested,
    isGupilPromo,
    bonusBehavior,
    shouldSpendBonuses,
    shouldEarnBonuses,
    component: 'tilda-webhook',
    promo_debug: {
      promoFromPayment,
      promoFromOrderData,
      finalPromo,
      finalPromoType: typeof finalPromo,
      finalPromoUpper:
        typeof finalPromo === 'string' ? finalPromo.toUpperCase() : null
    },
    NEW_LOGIC_CHECKS: {
      appliedRequested_isFinite: Number.isFinite(appliedRequested),
      appliedRequested_gt_0: appliedRequested > 0,
      bonusBehavior_allows_spending:
        bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY',
      shouldSpendBonuses_calculation:
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY')
    }
  });

  try {
    // Сначала пытаемся найти пользователя
    let user = await UserService.findUserByContact(projectId, email, phone);

    // Если пользователь не найден, создаем его
    if (!user) {
      const nameParts = name ? name.trim().split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      user = await UserService.createUser({
        projectId,
        email: email || '',
        phone: phone || '',
        firstName,
        lastName,
        utmSource: utm_ref || ''
      });
    }

    // Начисляем бонусы за покупку
    const totalAmount =
      typeof payment.amount === 'string'
        ? parseInt(payment.amount) || 0
        : payment.amount || 0;
    const orderId = payment.orderid || payment.systranid || 'tilda_order';

    // Создаем описание заказа с товарами
    const productNames =
      payment.products?.map((p: TildaProduct) => p.name).join(', ') ||
      'Заказ Tilda';
    const description = `Заказ #${orderId}: ${productNames}`;

    // Получаем настройки проекта для определения поведения бонусов
    const project = await ProjectService.getProjectById(projectId);
    const bonusBehavior = project?.bonusBehavior || 'SPEND_AND_EARN';

    // Обработка списания бонусов в зависимости от настроек проекта
    try {
      // Используем уже определенный isGupilPromo вместо переопределения
      const hasAppliedBonuses = appliedRequested > 0;
      const shouldCheckGupilPromo = hasAppliedBonuses && !isGupilPromo;

      logger.info('🔍 Анализ промокода', {
        projectId,
        orderId,
        promo: finalPromo, // исправлено - была неопределенная переменная promo
        isGupilPromo,
        hasAppliedBonuses,
        appliedRequested,
        paymentData: payment,
        component: 'tilda-webhook'
      });
      const appliedRaw =
        (orderData as any).appliedBonuses ?? (orderData as any).applied_bonuses;
      const appliedRequested = Number(
        typeof appliedRaw === 'string'
          ? appliedRaw.replace(/[^0-9.\-]/g, '')
          : appliedRaw
      );

      logger.info('🔍 Проверка условий списания бонусов', {
        projectId,
        orderId,
        promo: finalPromo, // исправлено
        isGupilPromo,
        appliedRaw,
        appliedRequested,
        bonusBehavior,
        component: 'tilda-webhook'
      });

      // КРИТИЧНОЕ ЛОГИРОВАНИЕ ПРЯМО ПЕРЕД ПРОВЕРКОЙ
      logger.info('🚨 ПРЯМАЯ ПРОВЕРКА shouldSpendBonuses ПЕРЕД IF', {
        projectId,
        orderId,
        shouldSpendBonuses,
        appliedRequested_current: appliedRequested,
        bonusBehavior_current: bonusBehavior,
        isFinite_check: Number.isFinite(appliedRequested),
        gt_zero_check: appliedRequested > 0,
        behavior_check:
          bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY',
        calculation_debug: `${appliedRequested} > 0 && (${bonusBehavior} === 'SPEND_AND_EARN' || ${bonusBehavior} === 'SPEND_ONLY')`,
        component: 'tilda-webhook-critical-if-check'
      });

      if (shouldSpendBonuses) {
        logger.info('🎯 Условия для списания бонусов выполнены', {
          projectId,
          orderId,
          isGupilPromo,
          bonusBehavior,
          appliedRequested,
          userBalance: user.currentBalance,
          component: 'tilda-webhook'
        });

        // Получаем текущий уровень пользователя для проверки лимитов оплаты
        const currentLevel = await BonusLevelService.calculateUserLevel(
          projectId,
          Number(user.totalPurchases)
        );

        // Ограничиваем суммой доступных бонусов, чтобы не падать при нехватке
        const balance = await UserService.getUserBalance(user.id);
        let applied = Math.min(
          appliedRequested,
          Number(balance.currentBalance)
        );

        logger.info('💰 Параметры списания бонусов', {
          projectId,
          orderId,
          requested: appliedRequested,
          currentBalance: balance.currentBalance,
          appliedAfterLimit: applied,
          userLevel: currentLevel?.name,
          paymentPercent: currentLevel?.paymentPercent,
          component: 'tilda-webhook'
        });

        // Применяем ограничение по проценту оплаты из уровня пользователя
        if (currentLevel && currentLevel.paymentPercent < 100) {
          const maxPaymentByLevel =
            (totalAmount * currentLevel.paymentPercent) / 100;
          applied = Math.min(applied, maxPaymentByLevel);

          logger.info('🔒 Применено ограничение по уровню пользователя', {
            projectId,
            orderId,
            userId: user.id,
            userLevel: currentLevel.name,
            paymentPercent: currentLevel.paymentPercent,
            totalAmount,
            maxPaymentByLevel,
            appliedBeforeLimit: Math.min(
              appliedRequested,
              Number(balance.currentBalance)
            ),
            appliedAfterLimit: applied,
            component: 'tilda-webhook'
          });
        }

        if (applied <= 0) {
          logger.warn(
            'Запрошено списание, но баланс равен нулю или превышен лимит уровня',
            {
              projectId,
              orderId,
              requested: appliedRequested,
              currentBalance: balance.currentBalance,
              userLevel: currentLevel?.name,
              paymentPercent: currentLevel?.paymentPercent,
              component: 'tilda-webhook'
            }
          );
        } else {
          logger.info('💰 Выполняем списание бонусов', {
            projectId,
            orderId,
            userId: user.id,
            applied,
            requested: appliedRequested,
            currentBalance: balance.currentBalance,
            userLevel: currentLevel?.name,
            paymentPercent: currentLevel?.paymentPercent,
            bonusBehavior,
            component: 'tilda-webhook'
          });

          await BonusService.spendBonuses(
            user.id,
            applied,
            `Списание бонусов при заказе ${orderId}${isGupilPromo ? ' (промокод GUPIL)' : ''}`,
            {
              orderId,
              source: 'tilda_order',
              promocode: isGupilPromo ? 'GUPIL' : undefined,
              userLevel: currentLevel?.name,
              paymentPercent: currentLevel?.paymentPercent
            }
          );

          logger.info('✅ Списание бонусов выполнено успешно', {
            projectId,
            orderId,
            userId: user.id,
            applied,
            userLevel: currentLevel?.name,
            bonusBehavior,
            component: 'tilda-webhook'
          });
        }
      } else {
        logger.info('🚫 Условия для списания бонусов НЕ выполнены', {
          projectId,
          orderId,
          promo: finalPromo, // добавлено
          isGupilPromo,
          bonusBehavior,
          appliedRequested,
          hasAppliedBonuses: appliedRequested > 0,
          component: 'tilda-webhook'
        });
      }

      // Проверяем, нужно ли начислять бонусы
      const shouldEarnBonuses =
        bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'EARN_ONLY';

      if (!shouldEarnBonuses) {
        logger.info('🚫 Начисление бонусов отключено для проекта', {
          projectId,
          bonusBehavior,
          component: 'tilda-webhook'
        });
        // Возвращаем результат без начисления бонусов
        return {
          success: true,
          message: 'Заказ обработан, бонусы списаны',
          order: {
            id: orderId,
            amount: totalAmount,
            products: payment.products?.length || 0
          },
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            name: name,
            currentBalance: Number(
              (await UserService.getUserBalance(user.id)).currentBalance
            ),
            totalEarned: Number(
              (await UserService.getUserBalance(user.id)).totalEarned
            )
          },
          bonusBehavior,
          debug: {
            promo: finalPromo, // исправлено
            appliedBonuses: appliedRaw,
            isGupilPromo,
            bonusBehavior,
            timestamp: new Date().toISOString()
          }
        };
      }
    } catch (e) {
      logger.error('Ошибка обработки списания бонусов из webhook', {
        projectId,
        orderId,
        error: e instanceof Error ? e.message : String(e),
        component: 'tilda-webhook'
      });

      // Логируем ошибку, но не прерываем выполнение - начисление бонусов продолжится
      logger.warn(
        'Списание бонусов не удалось, но начисление за покупку продолжится',
        {
          projectId,
          orderId,
          error: e instanceof Error ? e.message : String(e),
          component: 'tilda-webhook'
        }
      );
    }

    // Начисляем бонусы за покупку с учётом уровня и реферальной системы
    const result = await BonusService.awardPurchaseBonus(
      user.id,
      totalAmount,
      orderId,
      description
    );

    // Получаем баланс пользователя для ответа
    const userBalance = await UserService.getUserBalance(user.id);

    // Определяем статус обработки бонусов
    let bonusStatus = 'earn_only';
    if (shouldSpendBonuses) {
      bonusStatus =
        bonusBehavior === 'SPEND_ONLY' ? 'spend_only' : 'spend_and_earn';
    }
    const bonusesSpent = shouldSpendBonuses && appliedRequested > 0;

    return {
      success: true,
      message: bonusesSpent
        ? bonusStatus === 'spend_only'
          ? 'Заказ обработан, бонусы списаны'
          : 'Заказ обработан, бонусы списаны и начислены'
        : 'Заказ обработан, бонусы начислены',
      debug_test: 'DEBUG_WORKING',
      order: {
        id: orderId,
        amount: totalAmount,
        products: payment.products?.length || 0
      },
      bonus: {
        id: result.bonus.id,
        amount: Number(result.bonus.amount),
        expiresAt: result.bonus.expiresAt
      },
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: name,
        currentBalance: Number(userBalance.currentBalance),
        totalEarned: Number(userBalance.totalEarned)
      },
      levelInfo: result.levelInfo,
      referralInfo: result.referralInfo,
      bonusStatus: {
        spent: bonusesSpent,
        earned: true,
        appliedAmount: appliedRequested,
        bonusBehavior: bonusBehavior
      },
      debug: {
        promo: finalPromo, // исправлено
        appliedBonuses:
          (orderData as any).appliedBonuses ??
          (orderData as any).applied_bonuses,
        isGupilPromo:
          typeof (
            (payment as any)?.promocode || (orderData as any)?.promocode
          ) === 'string' &&
          ((payment as any)?.promocode || (orderData as any)?.promocode)
            .trim()
            .toUpperCase() === 'GUPIL',
        shouldSpendBonuses,
        shouldEarnBonuses,
        bonusBehavior,
        userBalanceAfter: Number(userBalance.currentBalance),
        userBalanceBefore: Number(user.currentBalance),
        bonusEarned: Number(result.bonus.amount),
        bonusSpent: bonusesSpent,
        bonusStatus,
        timestamp: new Date().toISOString()
      }
    };

    logger.info('🎉 Заказ обработан полностью', {
      projectId,
      orderId,
      userId: user.id,
      appliedBonuses: appliedRequested,
      shouldSpendBonuses,
      shouldEarnBonuses,
      bonusEarned: Number(result.bonus.amount),
      bonusSpent: bonusesSpent,
      bonusStatus,
      balanceBefore: Number(user.currentBalance),
      balanceAfter: Number(userBalance.currentBalance),
      component: 'tilda-webhook'
    });
  } catch (error) {
    logger.error('Ошибка обработки заказа Tilda', {
      projectId,
      orderData,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'tilda-webhook'
    });
    throw error;
  }
}
// Нормализация заказа Tilda: приводит строковые числа к number
function normalizeTildaOrder(raw: any): any {
  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/[^0-9.\-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const out: any = { ...raw };
  // Приведение контактных полей к нижнему регистру
  if (out.Email && !out.email) out.email = String(out.Email).trim();
  if (out.Phone && !out.phone) out.phone = String(out.Phone).trim();
  if (out.Name && !out.name) out.name = String(out.Name).trim();
  if (out.payment) {
    out.payment = { ...out.payment };
    if (typeof out.payment.amount !== 'undefined') {
      out.payment.amount = toNum(out.payment.amount);
    }
    if (Array.isArray(out.payment.products)) {
      out.payment.products = out.payment.products.map((p: any) => ({
        ...p,
        price: toNum(p?.price),
        amount:
          typeof p?.amount !== 'undefined' ? toNum(p.amount) : toNum(p?.price),
        quantity: typeof p?.quantity !== 'undefined' ? toNum(p.quantity) : 1
      }));
    }
    if (!out.payment.orderid && out.payment.systranid) {
      out.payment.orderid = String(out.payment.systranid);
    }
    if (out.payment.orderid) out.payment.orderid = String(out.payment.orderid);
  }
  return out;
}

// Обработчик POST запросов (без rate limiting)
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookSecret: string }> }
) {
  const { webhookSecret } = await params;
  const method = request.method;
  // В логах фиксируем внешний URL за прокси (домен), а не 0.0.0.0
  const computeExternalUrl = () => {
    try {
      const url = new URL(request.url);
      const proto = request.headers.get('x-forwarded-proto');
      const host =
        request.headers.get('x-forwarded-host') || request.headers.get('host');
      if (proto && host)
        return `${proto}://${host}${url.pathname}${url.search}`;
      return request.url;
    } catch {
      return request.url;
    }
  };
  const endpoint = computeExternalUrl();

  // Получаем заголовки (упрощенная версия)
  const requestHeaders: Record<string, string> = {
    'content-type': request.headers.get('content-type') || '',
    'user-agent': request.headers.get('user-agent') || ''
  };

  let body: any;
  let project: any;
  let response: any = { error: 'Неизвестная ошибка' };
  let status = 500;
  let success = false;
  const start = Date.now();

  try {
    // Логируем КАЖДЫЙ входящий webhook запрос для отладки
    logger.info('Входящий webhook запрос', {
      webhookSecret,
      method,
      endpoint,
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent'),
      component: 'webhook-handler'
    });

    // Парсим тело запроса (поддержка JSON, form-urlencoded и multipart из Tilda)
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      // Tilda часто передает JSON строкой в поле 'data' или 'json'
      const jsonStr = (form.get('data') ||
        form.get('json') ||
        form.get('order')) as string | null;
      if (jsonStr && typeof jsonStr === 'string') {
        try {
          body = JSON.parse(jsonStr);
        } catch {
          body = Object.fromEntries(form.entries());
        }
      } else {
        body = Object.fromEntries(form.entries());
      }
    } else {
      // Пытаемся распарсить как текст/JSON
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    // Получаем проект по webhook secret
    logger.info('Поиск проекта по webhook secret', {
      webhookSecret,
      endpoint,
      component: 'webhook-handler'
    });

    project = await ProjectService.getProjectByWebhookSecret(webhookSecret);

    if (!project) {
      logger.warn('Проект не найден по webhook secret', {
        webhookSecret,
        endpoint,
        component: 'webhook-handler'
      });
      response = { error: 'Неверный webhook secret' };
      status = 401;
      return NextResponse.json(response, { status });
    }

    logger.info('Проект найден', {
      projectId: project.id,
      projectName: project.name,
      isActive: project.isActive,
      webhookSecret,
      component: 'webhook-handler'
    });

    if (!project.isActive) {
      response = { error: 'Проект деактивирован' };
      status = 403;
      return NextResponse.json(response, { status });
    }

    // Обработка тестовых запросов (например, Tilda отправляет test ping)
    const urlObj = new URL(endpoint);
    const testParam =
      urlObj.searchParams.get('test') || urlObj.searchParams.get('ping');
    const isTestRequest =
      testParam === '1' ||
      testParam === 'true' ||
      (typeof body === 'object' &&
        body !== null &&
        (body.test === '1' ||
          body.test === 1 ||
          body.action === 'test' ||
          body.event === 'test'));

    if (isTestRequest) {
      // Возвращаем простой текст "ok" — совместимо с Tilda тестом
      success = true;
      return new NextResponse('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Проверяем, это webhook от Tilda или наш стандартный webhook
    // Нормализуем: если пришел единичный объект заказа, обернем в массив
    if (
      (Array.isArray(body) && body.length > 0 && (body[0] as any).payment) ||
      (body && (body as any).payment)
    ) {
      const tildaPayload = Array.isArray(body) ? body : [body];
      // Нормализуем числа из строк, затем валидируем
      const normalized = normalizeTildaOrder(tildaPayload[0]);
      const validatedOrder = validateTildaOrder(normalized);
      response = await handleTildaOrder(project.id, validatedOrder);
      status = 200;
      success = true;
    } else {
      // Это наш стандартный webhook. Нормализуем action и форму payload перед валидацией
      // Доп. обработка: тестовые пинги/формы Tilda без payment
      const isLikelyTest =
        typeof body === 'object' &&
        body !== null &&
        ((typeof (body as any).test !== 'undefined' &&
          String((body as any).test).toLowerCase() !== 'false') ||
          /test/i.test(String((body as any).action || '')) ||
          /test/i.test(String((body as any).event || '')));
      if (isLikelyTest) {
        response = { success: true, message: 'Webhook test accepted' };
        status = 200;
        success = true;
        return NextResponse.json(response, { status });
      }

      // Эвристика: если это форма (есть email/phone), трактуем как register_user
      const pick = (obj: any, keys: string[]): string | undefined => {
        for (const k of keys) {
          const v =
            obj?.[k] ?? obj?.[k.toLowerCase()] ?? obj?.[k.toUpperCase()];
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return undefined;
      };
      const email = pick(body, ['email', 'Email', 'emailAddress', 'E-mail']);
      let phone = pick(body, ['phone', 'Phone', 'tel', 'telephone', 'Телефон']);
      // Нормализуем телефон (как в API создания пользователя)
      try {
        const { normalizePhone } = await import('@/lib/phone');
        phone = normalizePhone(phone) || phone;
      } catch {
        // no-op
      }
      if (email || phone) {
        const name = pick(body, ['name', 'Name', 'fio', 'FIO', 'fullname']);
        const [firstName, ...rest] = (name || '').split(' ').filter(Boolean);
        const lastName = rest.join(' ') || undefined;
        const normalized: WebhookRegisterUserPayload = {
          email,
          phone,
          firstName,
          lastName
        } as any;
        response = await handleRegisterUser(project.id, normalized);
        status = 201;
        success = true;
        return NextResponse.json(response, { status });
      }
      const normalizeAction = (a: unknown): string | undefined => {
        if (typeof a !== 'string') return undefined;
        const raw = a
          .trim()
          .toLowerCase()
          .replace(/[-\s]+/g, '_');
        const map: Record<string, string> = {
          register: 'register_user',
          signup: 'register_user',
          sign_up: 'register_user',
          registeruser: 'register_user',
          register_user: 'register_user',

          purchase: 'purchase',
          order: 'purchase',
          paid: 'purchase',
          payment: 'purchase',
          buy: 'purchase',

          spend: 'spend_bonuses',
          spend_bonus: 'spend_bonuses',
          spend_bonuses: 'spend_bonuses',
          writeoff: 'spend_bonuses'
        };
        return map[raw] || raw;
      };

      const maybePayload =
        (body as any)?.payload ??
        (body as any)?.data ??
        (body as any)?.orderPayload;
      let normalizedPayload = maybePayload;
      if (typeof maybePayload === 'string') {
        try {
          normalizedPayload = JSON.parse(maybePayload);
        } catch {
          // оставляем как есть
        }
      }
      const normalizedBody = {
        ...((typeof body === 'object' && body) || {}),
        action: normalizeAction((body as any)?.action),
        payload: normalizedPayload
      };

      // Валидируем данные
      const validatedRequest = validateWebhookRequest(normalizedBody);
      const { action, payload } = validatedRequest;

      switch (action) {
        case 'register_user':
          response = await handleRegisterUser(project.id, payload);
          status = 201;
          success = true;
          break;

        case 'purchase':
          // Проверяем обязательные поля для покупки
          if (!payload.purchaseAmount || !payload.orderId) {
            throw new Error(
              'purchaseAmount и orderId обязательны для действия purchase'
            );
          }
          response = await handlePurchase(
            project.id,
            payload as WebhookPurchasePayload
          );
          status = 200;
          success = true;
          break;

        case 'spend_bonuses':
          // Проверяем обязательные поля для списания бонусов
          if (!payload.bonusAmount || !payload.orderId) {
            throw new Error(
              'bonusAmount и orderId обязательны для действия spend_bonuses'
            );
          }
          response = await handleSpendBonuses(
            project.id,
            payload as WebhookSpendBonusesPayload
          );
          status = 200;
          success = true;
          break;

        default:
          response = { error: `Неизвестное действие: ${action}` };
          status = 400;
      }
    }

    return NextResponse.json(response, { status });
  } catch (error) {
    logger.error('Ошибка обработки webhook', {
      webhookSecret,
      body,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'webhook-handler'
    });
    if (error instanceof ZodError) {
      response = {
        error: 'Ошибка валидации',
        details: error.issues
      };
      status = 400;
      return NextResponse.json(response, { status });
    }
    response = {
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
    status = 500;
    return NextResponse.json(response, { status });
  } finally {
    // Логируем запрос
    if (project) {
      const duration = Date.now() - start;
      await logWebhookRequest(
        project.id,
        endpoint,
        method,
        {
          ...requestHeaders,
          'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
          'content-length': request.headers.get('content-length') || '',
          'x-response-time-ms': String(duration)
        },
        body,
        response,
        status,
        success
      );
    }
  }
}

// Обработчик регистрации пользователя
async function handleRegisterUser(
  projectId: string,
  payload: WebhookRegisterUserPayload
) {
  const {
    email,
    phone,
    firstName,
    lastName,
    birthDate,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referralCode
  } = payload;

  if (!email && !phone) {
    throw new Error('Должен быть указан email или телефон');
  }

  // Проверяем, не существует ли уже такой пользователь
  const existingUser = await UserService.findUserByContact(
    projectId,
    email,
    phone
  );
  if (existingUser) {
    return {
      success: true,
      message: 'Пользователь уже существует',
      user: {
        id: existingUser.id,
        email: existingUser.email,
        phone: existingUser.phone
      }
    };
  }

  // Создаем нового пользователя с UTM метками и реферальной системой
  const user = await UserService.createUser({
    projectId,
    email,
    phone,
    firstName,
    lastName,
    birthDate: birthDate ? new Date(birthDate) : undefined,
    // UTM метки
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    // Реферальная система
    referralCode
  });
  try {
    // Приветственный бонус: читаем из ReferralProgram.description
    const program = await db.referralProgram.findUnique({
      where: { projectId }
    });
    const meta = program?.description
      ? JSON.parse(program.description as any)
      : {};
    const welcome = Number(meta?.welcomeBonus || 0);
    if (welcome > 0) {
      const project = await db.project.findUnique({ where: { id: projectId } });
      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + Number(project?.bonusExpiryDays || 365)
      );
      const bonus = await db.bonus.create({
        data: {
          userId: user.id,
          amount: welcome,
          type: 'MANUAL',
          description: 'Приветственный бонус при регистрации',
          expiresAt
        }
      });
      await db.transaction.create({
        data: {
          userId: user.id,
          bonusId: bonus.id,
          amount: welcome,
          type: 'EARN',
          description: 'Приветственный бонус при регистрации'
        }
      });
    }
  } catch (e) {
    logger.warn('Не удалось начислить приветственный бонус (webhook)', {
      projectId,
      error: e instanceof Error ? e.message : String(e)
    });
  }

  return {
    success: true,
    message: 'Пользователь успешно зарегистрирован',
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone
    }
  };
}

// Обработчик покупки (начисление бонусов)
async function handlePurchase(
  projectId: string,
  payload: WebhookPurchasePayload
) {
  const { userEmail, userPhone, purchaseAmount, orderId, description } =
    payload;

  if (!userEmail && !userPhone) {
    throw new Error('Должен быть указан email или телефон пользователя');
  }

  // Находим пользователя
  const user = await UserService.findUserByContact(
    projectId,
    userEmail,
    userPhone
  );
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  // Начисляем бонусы за покупку с учётом уровня и реферальной системы
  const result = await BonusService.awardPurchaseBonus(
    user.id,
    purchaseAmount,
    orderId,
    description
  );

  return {
    success: true,
    message: 'Бонусы успешно начислены',
    bonus: {
      id: result.bonus.id,
      amount: Number(result.bonus.amount),
      expiresAt: result.bonus.expiresAt
    },
    levelInfo: result.levelInfo,
    referralInfo: result.referralInfo,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone
    }
  };
}

// Обработчик списания бонусов
async function handleSpendBonuses(
  projectId: string,
  payload: WebhookSpendBonusesPayload
) {
  const { userEmail, userPhone, bonusAmount, orderId, description } = payload;

  if (!userEmail && !userPhone) {
    throw new Error('Должен быть указан email или телефон пользователя');
  }

  // Находим пользователя
  const user = await UserService.findUserByContact(
    projectId,
    userEmail,
    userPhone
  );
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  // Списываем бонусы
  const transactions = await BonusService.spendBonuses(
    user.id,
    bonusAmount,
    description || `Списание бонусов для заказа ${orderId}`,
    { orderId }
  );

  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    success: true,
    message: 'Бонусы успешно списаны',
    spent: {
      amount: totalSpent,
      transactionsCount: transactions.length
    },
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone
    }
  };
}

// Обработчик GET запросов (для проверки)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ webhookSecret: string }> }
) {
  const { webhookSecret } = await context.params;

  const project = await ProjectService.getProjectByWebhookSecret(webhookSecret);

  if (!project) {
    return NextResponse.json(
      { error: 'Неверный webhook secret' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    project: project.name,
    status: project.isActive ? 'active' : 'inactive',
    webhookEndpoint: `/api/webhook/${webhookSecret}`,
    supportedActions: ['register_user', 'purchase', 'spend_bonuses']
  });
}

// Применяем rate limiting к POST запросам
export const POST = withWebhookRateLimit(handlePOST);
