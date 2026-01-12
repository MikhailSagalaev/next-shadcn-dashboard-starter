/**
 * @file: src/app/api/projects/[id]/widget/route.ts
 * @description: Публичный API для получения настроек виджета
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-01-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// CORS заголовки для публичного доступа
function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300' // Кэш на 5 минут
  };
}

// OPTIONS handler для CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: createCorsHeaders()
  });
}

// GET /api/projects/[id]/widget - Публичный endpoint для виджета
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    logger.info('GET /api/projects/[id]/widget запрос', {
      projectId,
      origin: request.headers.get('origin')
    });

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        operationMode: true,
        welcomeBonus: true,
        welcomeRewardType: true,
        firstPurchaseDiscountPercent: true,
        botUsername: true
      }
    });

    if (!project) {
      logger.warn('Проект не найден', { projectId });
      return NextResponse.json(
        {
          success: false,
          error: 'Проект не найден'
        },
        { status: 404, headers: createCorsHeaders() }
      );
    }

    // КРИТИЧНО: Получаем максимальный процент из уровней бонусов
    const bonusLevels = await db.bonusLevel.findMany({
      where: { projectId },
      select: { bonusPercent: true },
      orderBy: { bonusPercent: 'desc' }
    });

    const maxBonusPercent =
      bonusLevels.length > 0
        ? bonusLevels[0].bonusPercent
        : Number(project.welcomeBonus) || 10;

    logger.info('Рассчитан максимальный процент из уровней', {
      projectId,
      maxBonusPercent,
      levelsCount: bonusLevels.length
    });

    // Получаем настройки виджета
    const widgetSettings = await db.widgetSettings.findUnique({
      where: { projectId }
    });

    // Если настроек нет, создаём дефолтные
    if (!widgetSettings) {
      logger.info('Настройки виджета не найдены, создаём дефолтные', {
        projectId
      });

      const defaultSettings = await db.widgetSettings.create({
        data: {
          projectId,
          productBadgeBonusPercent: maxBonusPercent // Используем рассчитанный процент
        }
      });

      return NextResponse.json(
        {
          success: true,
          ...defaultSettings,
          // Разворачиваем стили из JSON полей
          ...((defaultSettings.registrationStyles as object) || {}),
          ...((defaultSettings.productBadgeStyles as object) || {}),
          ...((defaultSettings.widgetStyles as object) || {}),
          productBadgeBonusPercent: maxBonusPercent, // Всегда актуальный процент
          operationMode: project.operationMode,
          botUsername: project.botUsername,
          welcomeBonusAmount: Number(project.welcomeBonus),
          welcomeRewardType: project.welcomeRewardType,
          firstPurchaseDiscountPercent: project.firstPurchaseDiscountPercent
        },
        { headers: createCorsHeaders() }
      );
    }

    // Возвращаем настройки виджета с актуальным процентом из уровней
    const response = {
      success: true,
      ...widgetSettings,
      // Разворачиваем стили из JSON полей
      ...((widgetSettings.registrationStyles as object) || {}),
      ...((widgetSettings.productBadgeStyles as object) || {}),
      ...((widgetSettings.widgetStyles as object) || {}),
      productBadgeBonusPercent: maxBonusPercent, // ВСЕГДА берём из уровней, игнорируя сохранённое значение
      // Добавляем данные из проекта
      operationMode: project.operationMode,
      botUsername: project.botUsername,
      welcomeBonusAmount: Number(project.welcomeBonus),
      welcomeRewardType: project.welcomeRewardType,
      firstPurchaseDiscountPercent: project.firstPurchaseDiscountPercent
    };

    logger.info('Настройки виджета успешно загружены', {
      projectId,
      hasSettings: true
    });

    return NextResponse.json(response, { headers: createCorsHeaders() });
  } catch (error) {
    logger.error(
      'Ошибка получения настроек виджета',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-api'
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера'
      },
      { status: 500, headers: createCorsHeaders() }
    );
  }
}

// PUT /api/projects/[id]/widget - Обновление настроек виджета (требует аутентификации)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();

    logger.info('PUT /api/projects/[id]/widget запрос', {
      projectId,
      bodyKeys: Object.keys(body)
    });

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Разделяем поля на основные и стили
    const {
      // Стили регистрации
      backgroundColor,
      backgroundGradient,
      textColor,
      titleColor,
      descriptionColor,
      fallbackTextColor,
      buttonTextColor,
      buttonBackgroundColor,
      buttonBorderColor,
      buttonHoverColor,
      fallbackBackgroundColor,
      borderRadius,
      padding,
      marginBottom,
      iconSize,
      titleFontSize,
      titleFontWeight,
      descriptionFontSize,
      buttonFontSize,
      buttonFontWeight,
      buttonPadding,
      buttonBorderRadius,
      fallbackFontSize,
      fallbackPadding,
      fallbackBorderRadius,
      boxShadow,
      buttonBoxShadow,
      iconAnimation,
      iconEmoji,
      iconColor,
      fontFamily,
      maxWidth,
      textAlign,
      buttonWidth,
      buttonDisplay,
      fontSize,

      // Стили бейджей товаров
      productBadgeBackgroundColor,
      productBadgeTextColor,
      productBadgeFontFamily,
      productBadgeFontSize,
      productBadgeFontWeight,
      productBadgePadding,
      productBadgeBorderRadius,
      productBadgeMarginTop,

      // Стили виджета
      widgetBackgroundColor,
      widgetBorderColor,
      widgetTextColor,
      widgetLabelColor,
      widgetInputBackground,
      widgetInputBorder,
      widgetInputText,
      widgetButtonBackground,
      widgetButtonText,
      widgetButtonHover,
      widgetBalanceColor,
      widgetErrorColor,
      widgetSuccessColor,
      widgetFontFamily,
      widgetFontSize,
      widgetLabelFontSize,
      widgetButtonFontSize,
      widgetBalanceFontSize,
      widgetBorderRadius,
      widgetPadding,
      widgetInputBorderRadius,
      widgetInputPadding,
      widgetButtonBorderRadius,
      widgetButtonPadding,
      widgetBoxShadow,
      widgetInputBoxShadow,
      widgetButtonBoxShadow,

      ...mainFields
    } = body;

    // Группируем стили в JSON объекты
    const registrationStyles = {
      backgroundColor,
      backgroundGradient,
      textColor,
      titleColor,
      descriptionColor,
      fallbackTextColor,
      buttonTextColor,
      buttonBackgroundColor,
      buttonBorderColor,
      buttonHoverColor,
      fallbackBackgroundColor,
      borderRadius,
      padding,
      marginBottom,
      iconSize,
      titleFontSize,
      titleFontWeight,
      descriptionFontSize,
      buttonFontSize,
      buttonFontWeight,
      buttonPadding,
      buttonBorderRadius,
      fallbackFontSize,
      fallbackPadding,
      fallbackBorderRadius,
      boxShadow,
      buttonBoxShadow,
      iconAnimation,
      iconEmoji,
      iconColor,
      fontFamily,
      maxWidth,
      textAlign,
      buttonWidth,
      buttonDisplay,
      fontSize
    };

    const productBadgeStyles = {
      productBadgeBackgroundColor,
      productBadgeTextColor,
      productBadgeFontFamily,
      productBadgeFontSize,
      productBadgeFontWeight,
      productBadgePadding,
      productBadgeBorderRadius,
      productBadgeMarginTop
    };

    const widgetStyles = {
      widgetBackgroundColor,
      widgetBorderColor,
      widgetTextColor,
      widgetLabelColor,
      widgetInputBackground,
      widgetInputBorder,
      widgetInputText,
      widgetButtonBackground,
      widgetButtonText,
      widgetButtonHover,
      widgetBalanceColor,
      widgetErrorColor,
      widgetSuccessColor,
      widgetFontFamily,
      widgetFontSize,
      widgetLabelFontSize,
      widgetButtonFontSize,
      widgetBalanceFontSize,
      widgetBorderRadius,
      widgetPadding,
      widgetInputBorderRadius,
      widgetInputPadding,
      widgetButtonBorderRadius,
      widgetButtonPadding,
      widgetBoxShadow,
      widgetInputBoxShadow,
      widgetButtonBoxShadow
    };

    // Удаляем undefined значения
    const cleanRegistrationStyles = Object.fromEntries(
      Object.entries(registrationStyles).filter(
        ([_, value]) => value !== undefined
      )
    );
    const cleanProductBadgeStyles = Object.fromEntries(
      Object.entries(productBadgeStyles).filter(
        ([_, value]) => value !== undefined
      )
    );
    const cleanWidgetStyles = Object.fromEntries(
      Object.entries(widgetStyles).filter(([_, value]) => value !== undefined)
    );

    // Подготавливаем данные для сохранения
    const updateData = {
      ...mainFields,
      ...(Object.keys(cleanRegistrationStyles).length > 0 && {
        registrationStyles: cleanRegistrationStyles
      }),
      ...(Object.keys(cleanProductBadgeStyles).length > 0 && {
        productBadgeStyles: cleanProductBadgeStyles
      }),
      ...(Object.keys(cleanWidgetStyles).length > 0 && {
        widgetStyles: cleanWidgetStyles
      })
    };

    // Обновляем или создаём настройки виджета
    const widgetSettings = await db.widgetSettings.upsert({
      where: { projectId },
      create: {
        projectId,
        ...updateData
      },
      update: updateData
    });

    logger.info('Настройки виджета обновлены', { projectId });

    return NextResponse.json({
      success: true,
      ...widgetSettings
    });
  } catch (error) {
    logger.error(
      'Ошибка обновления настроек виджета',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'widget-api'
    );
    return NextResponse.json(
      { error: 'Ошибка обновления настроек виджета' },
      { status: 500 }
    );
  }
}
