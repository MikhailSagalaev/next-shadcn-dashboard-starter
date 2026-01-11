/**
 * @file: scripts/migrate-widget-settings.ts
 * @description: Скрипт миграции настроек виджета из BotSettings в WidgetSettings
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2026-01-11
 * @author: AI Assistant + User
 */

import { db } from '../src/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

async function migrateWidgetSettings() {
  console.log('🚀 Начинаем миграцию настроек виджета...');

  try {
    // Получаем все проекты с настройками бота
    const botSettings = await db.botSettings.findMany({
      include: {
        project: true
      }
    });

    console.log(`📊 Найдено ${botSettings.length} проектов с настройками бота`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const botSetting of botSettings) {
      try {
        const projectId = botSetting.projectId;

        // Проверяем, не существует ли уже запись в widget_settings
        const existingWidget = await db.widgetSettings.findUnique({
          where: { projectId }
        });

        if (existingWidget) {
          console.log(
            `⏭️  Пропускаем проект ${projectId} - настройки виджета уже существуют`
          );
          skippedCount++;
          continue;
        }

        // Извлекаем widgetSettings из functionalSettings
        const functionalSettings = botSetting.functionalSettings as any;
        const widgetSettings = functionalSettings?.widgetSettings || {};

        console.log(`📦 Мигрируем настройки для проекта ${projectId}...`);

        // Создаём запись в widget_settings
        await db.widgetSettings.create({
          data: {
            projectId: projectId,

            // Текстовые настройки плашки регистрации
            registrationTitle:
              widgetSettings.registrationTitle ||
              'Зарегистрируйся и получи {bonusAmount} бонусов!',
            registrationDescription:
              widgetSettings.registrationDescription ||
              'Зарегистрируйся в нашей бонусной программе',
            registrationButtonText:
              widgetSettings.registrationButtonText ||
              'Для участия в акции перейдите в бота',
            registrationButtonUrl: widgetSettings.registrationButtonUrl || null,
            verificationButtonUrl: widgetSettings.verificationButtonUrl || null,
            registrationFallbackText:
              widgetSettings.registrationFallbackText ||
              'Свяжитесь с администратором для регистрации',

            // Настройки видимости
            showIcon:
              widgetSettings.showIcon !== undefined
                ? widgetSettings.showIcon
                : true,
            showTitle:
              widgetSettings.showTitle !== undefined
                ? widgetSettings.showTitle
                : true,
            showDescription:
              widgetSettings.showDescription !== undefined
                ? widgetSettings.showDescription
                : true,
            showButton:
              widgetSettings.showButton !== undefined
                ? widgetSettings.showButton
                : true,
            showFallbackText:
              widgetSettings.showFallbackText !== undefined
                ? widgetSettings.showFallbackText
                : true,

            // Настройки бонусных плашек
            productBadgeEnabled: widgetSettings.productBadgeEnabled !== false,
            productBadgeShowOnCards:
              widgetSettings.productBadgeShowOnCards !== false,
            productBadgeShowOnProductPage:
              widgetSettings.productBadgeShowOnProductPage !== false,
            productBadgeText:
              widgetSettings.productBadgeText ||
              'Начислим до {bonusAmount} бонусов',
            productBadgeLinkUrl: widgetSettings.productBadgeLinkUrl || null,
            productBadgeBonusPercent: new Decimal(
              widgetSettings.productBadgeBonusPercent || 10
            ),
            productBadgePosition:
              widgetSettings.productBadgePosition || 'after-price',
            productBadgeCustomSelector:
              widgetSettings.productBadgeCustomSelector || null,

            // Стили (сохраняем как JSON)
            registrationStyles: {
              backgroundColor: widgetSettings.backgroundColor,
              backgroundGradient: widgetSettings.backgroundGradient,
              textColor: widgetSettings.textColor,
              titleColor: widgetSettings.titleColor,
              descriptionColor: widgetSettings.descriptionColor,
              fallbackTextColor: widgetSettings.fallbackTextColor,
              buttonTextColor: widgetSettings.buttonTextColor,
              buttonBackgroundColor: widgetSettings.buttonBackgroundColor,
              buttonBorderColor: widgetSettings.buttonBorderColor,
              buttonHoverColor: widgetSettings.buttonHoverColor,
              fallbackBackgroundColor: widgetSettings.fallbackBackgroundColor,
              borderRadius: widgetSettings.borderRadius,
              padding: widgetSettings.padding,
              marginBottom: widgetSettings.marginBottom,
              iconSize: widgetSettings.iconSize,
              titleFontSize: widgetSettings.titleFontSize,
              titleFontWeight: widgetSettings.titleFontWeight,
              descriptionFontSize: widgetSettings.descriptionFontSize,
              buttonFontSize: widgetSettings.buttonFontSize,
              buttonFontWeight: widgetSettings.buttonFontWeight,
              buttonPadding: widgetSettings.buttonPadding,
              buttonBorderRadius: widgetSettings.buttonBorderRadius,
              fallbackFontSize: widgetSettings.fallbackFontSize,
              fallbackPadding: widgetSettings.fallbackPadding,
              fallbackBorderRadius: widgetSettings.fallbackBorderRadius,
              boxShadow: widgetSettings.boxShadow,
              buttonBoxShadow: widgetSettings.buttonBoxShadow,
              iconAnimation: widgetSettings.iconAnimation,
              iconEmoji: widgetSettings.iconEmoji,
              iconColor: widgetSettings.iconColor,
              fontFamily: widgetSettings.fontFamily,
              maxWidth: widgetSettings.maxWidth,
              textAlign: widgetSettings.textAlign,
              buttonWidth: widgetSettings.buttonWidth,
              buttonDisplay: widgetSettings.buttonDisplay,
              fontSize: widgetSettings.fontSize
            },
            productBadgeStyles: {
              backgroundColor: widgetSettings.productBadgeBackgroundColor,
              textColor: widgetSettings.productBadgeTextColor,
              fontFamily: widgetSettings.productBadgeFontFamily,
              fontSize: widgetSettings.productBadgeFontSize,
              fontWeight: widgetSettings.productBadgeFontWeight,
              padding: widgetSettings.productBadgePadding,
              borderRadius: widgetSettings.productBadgeBorderRadius,
              marginTop: widgetSettings.productBadgeMarginTop
            },
            widgetStyles: {
              backgroundColor: widgetSettings.widgetBackgroundColor,
              borderColor: widgetSettings.widgetBorderColor,
              textColor: widgetSettings.widgetTextColor,
              labelColor: widgetSettings.widgetLabelColor,
              inputBackground: widgetSettings.widgetInputBackground,
              inputBorder: widgetSettings.widgetInputBorder,
              inputText: widgetSettings.widgetInputText,
              buttonBackground: widgetSettings.widgetButtonBackground,
              buttonText: widgetSettings.widgetButtonText,
              buttonHover: widgetSettings.widgetButtonHover,
              balanceColor: widgetSettings.widgetBalanceColor,
              errorColor: widgetSettings.widgetErrorColor,
              successColor: widgetSettings.widgetSuccessColor,
              fontFamily: widgetSettings.widgetFontFamily,
              fontSize: widgetSettings.widgetFontSize,
              labelFontSize: widgetSettings.widgetLabelFontSize,
              buttonFontSize: widgetSettings.widgetButtonFontSize,
              balanceFontSize: widgetSettings.widgetBalanceFontSize,
              borderRadius: widgetSettings.widgetBorderRadius,
              padding: widgetSettings.widgetPadding,
              inputBorderRadius: widgetSettings.widgetInputBorderRadius,
              inputPadding: widgetSettings.widgetInputPadding,
              buttonBorderRadius: widgetSettings.widgetButtonBorderRadius,
              buttonPadding: widgetSettings.widgetButtonPadding,
              boxShadow: widgetSettings.widgetBoxShadow,
              inputBoxShadow: widgetSettings.widgetInputBoxShadow,
              buttonBoxShadow: widgetSettings.widgetButtonBoxShadow
            }
          }
        });

        console.log(
          `✅ Успешно мигрированы настройки для проекта ${projectId}`
        );
        migratedCount++;
      } catch (error) {
        console.error(
          `❌ Ошибка миграции для проекта ${botSetting.projectId}:`,
          error
        );
        errorCount++;
      }
    }

    console.log('\n📊 Результаты миграции:');
    console.log(`✅ Успешно мигрировано: ${migratedCount}`);
    console.log(`⏭️  Пропущено (уже существуют): ${skippedCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log('\n✨ Миграция завершена!');
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Запускаем миграцию
migrateWidgetSettings().catch((error) => {
  console.error('❌ Необработанная ошибка:', error);
  process.exit(1);
});
