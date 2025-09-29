/**
 * @file: src/app/api/projects/[id]/bot/route.ts
 * @description: API для управления настройками Telegram бота проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router, Prisma, Grammy
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectService } from '@/lib/services/project.service';
import { botManager } from '@/lib/telegram/bot-manager';
import type { BotSettings } from '@/types/bonus';
import { logger } from '@/lib/logger';

// CORS заголовки для виджета
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// OPTIONS handler для CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// GET /api/projects/[id]/bot - Получение настроек бота
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Получаем настройки бота
    const botSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    // Получаем welcomeBonusAmount из meta проекта
    const welcomeBonusAmount = Number(project.meta?.welcomeBonus || 0);

    // Добавляем welcomeBonusAmount к ответу
    const response = {
      ...botSettings,
      welcomeBonusAmount
    };

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    logger.error(
      'Ошибка получения настроек бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка получения настроек бота' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/bot - Создание/обновление настроек бота
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Валидация данных
    if (!body.botToken) {
      return NextResponse.json(
        { error: 'Токен бота обязателен' },
        { status: 400 }
      );
    }

    // Проверяем валидность токена бота (базовая проверка формата)
    if (!body.botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
      return NextResponse.json(
        { error: 'Неверный формат токена бота' },
        { status: 400 }
      );
    }

    // Подготавливаем настройки сообщений по умолчанию
    const defaultMessageSettings = {
      welcomeMessage:
        'Добро пожаловать! 🎉\n\nОтправьте свой номер телефона для привязки аккаунта.',
      balanceMessage: 'Ваш баланс бонусов: {balance}',
      helpMessage:
        'Доступные команды:\n/start - начать работу\n/balance - проверить баланс\n/help - показать помощь'
    };

    // Подготавливаем функциональные настройки по умолчанию
    const defaultFunctionalSettings = {
      showBalance: true,
      showLevel: true,
      showReferral: true,
      showHistory: true,
      showHelp: true
    };

    // Создаем или обновляем настройки бота в базе данных
    const botSettings = await db.botSettings.upsert({
      where: { projectId: id },
      update: {
        botToken: body.botToken,
        botUsername: body.botUsername || null,
        welcomeMessage:
          body.welcomeMessage || defaultMessageSettings.welcomeMessage,
        messageSettings: body.messageSettings || defaultMessageSettings,
        functionalSettings:
          body.functionalSettings || defaultFunctionalSettings,
        isActive: body.isActive !== undefined ? body.isActive : true
      },
      create: {
        projectId: id,
        botToken: body.botToken,
        botUsername: body.botUsername || null,
        welcomeMessage:
          body.welcomeMessage || defaultMessageSettings.welcomeMessage,
        messageSettings: body.messageSettings || defaultMessageSettings,
        functionalSettings:
          body.functionalSettings || defaultFunctionalSettings,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });

    // Создаем/обновляем бота в BotManager НЕ блокируя ответ API
    // Выполняем операцию в фоне, чтобы UI не зависал при сетевых задержках Telegram
    setTimeout(() => {
      (async () => {
        try {
          if (botSettings.isActive) {
            const botSettingsForManager = {
              ...botSettings,
              welcomeMessage:
                typeof botSettings.welcomeMessage === 'string'
                  ? botSettings.welcomeMessage
                  : 'Добро пожаловать! 🎉\n\nЭто бот бонусной программы.'
            };
            await botManager.createBot(
              id,
              botSettingsForManager as BotSettings
            );
            logger.info(
              '✅ Бот создан и активирован',
              { projectId: id },
              'bot-api'
            );
          } else {
            await botManager.stopBot(id);
            logger.info('🔄 Бот деактивирован', { projectId: id }, 'bot-api');
          }
        } catch (error) {
          logger.error(
            'Ошибка управления ботом через BotManager (background)',
            { error: error instanceof Error ? error.message : 'Unknown error' },
            'bot-api'
          );
        }
      })();
    }, 0);

    return NextResponse.json(botSettings, { status: 201 });
  } catch (error) {
    logger.error(
      'Ошибка настройки бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Токен бота уже используется в другом проекте' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка настройки бота' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/bot - Обновление настроек бота
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Проверяем существование настроек бота
    const existingBot = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    if (!existingBot) {
      return NextResponse.json(
        { error: 'Настройки бота не найдены' },
        { status: 404 }
      );
    }

    // Валидация токена если он передан
    if (body.botToken && !body.botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
      return NextResponse.json(
        { error: 'Неверный формат токена бота' },
        { status: 400 }
      );
    }

    // Обновляем настройки
    const updateData: any = {};
    if (body.botToken !== undefined) updateData.botToken = body.botToken;
    if (body.botUsername !== undefined)
      updateData.botUsername = body.botUsername;
    if (body.welcomeMessage !== undefined)
      updateData.welcomeMessage = body.welcomeMessage;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedBot = await db.botSettings.update({
      where: { projectId: id },
      data: updateData
    });

    // Обновляем бота в BotManager
    try {
      if (updatedBot.isActive) {
        // Преобразуем настройки для BotManager
        const botSettingsForManager = {
          ...updatedBot,
          welcomeMessage:
            typeof updatedBot.welcomeMessage === 'string'
              ? updatedBot.welcomeMessage
              : 'Добро пожаловать! 🎉\n\nЭто бот бонусной программы.'
        };
        await botManager.updateBot(id, botSettingsForManager as BotSettings);
        logger.info('🔄 Бот обновлен', { projectId: id }, 'bot-api');
      } else {
        await botManager.stopBot(id);
        logger.info('🔄 Бот деактивирован', { projectId: id }, 'bot-api');
      }
    } catch (error) {
      logger.error(
        'Ошибка обновления бота через BotManager',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'bot-api'
      );
    }

    return NextResponse.json(updatedBot);
  } catch (error) {
    logger.error(
      'Ошибка обновления настроек бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка обновления настроек бота' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/bot - Деактивация бота
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const botSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    if (!botSettings) {
      return NextResponse.json(
        { error: 'Настройки бота не найдены' },
        { status: 404 }
      );
    }

    // Деактивируем бота в базе данных
    const deactivatedBot = await db.botSettings.update({
      where: { projectId: id },
      data: { isActive: false }
    });

    // Останавливаем бота в BotManager
    try {
      await botManager.stopBot(id);
      logger.info('🛑 Бот остановлен через API', { projectId: id }, 'bot-api');
    } catch (error) {
      logger.error(
        'Ошибка остановки бота через BotManager',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'bot-api'
      );
    }

    return NextResponse.json({
      message: 'Бот успешно деактивирован',
      bot: deactivatedBot
    });
  } catch (error) {
    logger.error(
      'Ошибка деактивации бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка деактивации бота' },
      { status: 500 }
    );
  }
}
