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
import { logger } from '@/lib/logger';

// Функция для создания CORS заголовков - разрешаем все origins для виджета
function createCorsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400' // 24 hours
  };
}

// OPTIONS handler для CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: createCorsHeaders(request)
  });
}

// GET /api/projects/[id]/bot - Получение настроек бота (публичный endpoint для виджета)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    logger.info('GET /api/projects/[id]/bot запрос', {
      projectId: id,
      origin: request.headers.get('origin')
    });

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      logger.warn('Проект не найден', { projectId: id });
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404, headers: createCorsHeaders(request) }
      );
    }

    // Получаем настройки бота
    const botSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    // Получаем welcomeBonusAmount из botSettings.functionalSettings или ReferralProgram
    let welcomeBonusAmount = 0;
    let botUsername = null;

    if (botSettings) {
      botUsername = botSettings.botUsername;

      // Пытаемся получить из functionalSettings
      try {
        const functionalSettings = botSettings.functionalSettings as any;
        if (functionalSettings && functionalSettings.welcomeBonusAmount) {
          welcomeBonusAmount = Number(functionalSettings.welcomeBonusAmount);
        }

        // Извлекаем настройки виджета для шаблона регистрации
        const widgetSettings = functionalSettings?.widgetSettings;
      } catch (e) {
        logger.warn('Ошибка парсинга functionalSettings', { error: e });
      }
    }

    // Если не нашли в botSettings, пытаемся получить из ReferralProgram
    if (welcomeBonusAmount === 0) {
      try {
        const referralProgram = await db.referralProgram.findUnique({
          where: { projectId: id }
        });

        if (referralProgram && referralProgram.description) {
          const meta = JSON.parse(referralProgram.description);
          welcomeBonusAmount = Number(meta.welcomeBonus || 0);
        }
      } catch (e) {
        logger.warn('Ошибка получения welcomeBonus из ReferralProgram', {
          error: e
        });
      }
    }

    // Если все еще 0, пытаемся получить из project.meta
    if (welcomeBonusAmount === 0) {
      welcomeBonusAmount = Number((project as any).meta?.welcomeBonus || 0);
    }

    logger.info('Bot settings loaded', {
      projectId: id,
      welcomeBonusAmount,
      botUsername,
      hasBotSettings: !!botSettings
    });

    // Извлекаем настройки виджета из functionalSettings
    let widgetSettings = null;
    if (botSettings?.functionalSettings) {
      try {
        const functionalSettings = botSettings.functionalSettings as any;
        widgetSettings = functionalSettings.widgetSettings || null;
      } catch (e) {
        logger.warn('Ошибка извлечения widgetSettings', { error: e });
      }
    }

    // Формируем ответ
    const response = {
      ...botSettings,
      welcomeBonusAmount,
      botUsername,
      widgetSettings
    };

    return NextResponse.json(response, { headers: createCorsHeaders(request) });
  } catch (error) {
    logger.error(
      'Ошибка получения настроек бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка получения настроек бота' },
      { status: 500, headers: createCorsHeaders(request) }
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

    logger.info('🚀 POST /api/projects/[id]/bot - СОЗДАНИЕ НАСТРОЕК БОТА', {
      projectId: id,
      bodyKeys: Object.keys(body),
      botToken: body.botToken ? '***' + body.botToken.slice(-4) : 'none',
      botUsername: body.botUsername || 'none',
      allBotsInManager: botManager.getAllBotsStatus(),
      component: 'bot-api'
    });

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404, headers: createCorsHeaders(request) }
      );
    }

    // Валидация данных
    if (!body.botToken) {
      return NextResponse.json(
        { error: 'Токен бота обязателен' },
        { status: 400, headers: createCorsHeaders(request) }
      );
    }

    // Проверяем валидность токена бота (базовая проверка формата)
    // Telegram bot tokens format: <bot_id>:<token>
    // Example: 123456789:AAHmCIAAIfasYFQQB_3fSqcP_BB0_YykG7Y
    const tokenParts = body.botToken.split(':');
    if (
      tokenParts.length !== 2 ||
      !/^\d+$/.test(tokenParts[0]) || // bot ID should be numeric
      !tokenParts[1].startsWith('AA') || // token should start with AA
      tokenParts[1].length < 35 // minimum token length
    ) {
      return NextResponse.json(
        { error: 'Неверный формат токена бота. Ожидается формат: <bot_id>:<token>' },
        { status: 400, headers: createCorsHeaders(request) }
      );
    }

    // Проверяем, не существует ли уже настройки для этого проекта
    const existingSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    if (existingSettings) {
      return NextResponse.json(
        {
          error:
            'Настройки бота для этого проекта уже существуют. Используйте PUT для обновления.'
        },
        { status: 409, headers: createCorsHeaders(request) }
      );
    }

    // Создаем настройки бота
    const botSettings = await db.botSettings.create({
      data: {
        projectId: id,
        botToken: body.botToken,
        botUsername: body.botUsername,
        functionalSettings: body.functionalSettings || {}
      }
    });

    // Инициализируем бота
    try {
      await botManager.createBot(id, {
        id: body.id,
        projectId: id,
        botToken: body.botToken,
        botUsername: body.botUsername,
        functionalSettings: body.functionalSettings || {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info('Бот успешно инициализирован', { projectId: id }, 'bot-api');
    } catch (botError) {
      logger.warn(
        'Не удалось инициализировать бота, но настройки сохранены',
        {
          projectId: id,
          error: botError instanceof Error ? botError.message : 'Unknown error'
        },
        'bot-api'
      );
    }

    logger.info('Настройки бота созданы', { projectId: id }, 'bot-api');

    return NextResponse.json(
      {
        ...botSettings,
        message: 'Настройки бота успешно созданы'
      },
      { headers: createCorsHeaders(request) }
    );
  } catch (error) {
    logger.error(
      'Ошибка создания настроек бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка создания настроек бота' },
      { status: 500, headers: createCorsHeaders(request) }
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

    logger.info('🔄 PUT /api/projects/[id]/bot - ОБНОВЛЕНИЕ НАСТРОЕК БОТА', {
      projectId: id,
      bodyKeys: Object.keys(body),
      botToken: body.botToken ? '***' + body.botToken.slice(-4) : 'none',
      botUsername: body.botUsername || 'none',
      allBotsInManager: botManager.getAllBotsStatus(),
      component: 'bot-api'
    });

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404, headers: createCorsHeaders(request) }
      );
    }

    // Получаем существующие настройки бота
    const existingBotSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    // Если обновляем только функциональные настройки (например, widgetSettings)
    // и не передан botToken, используем существующие данные
    if (!body.botToken && existingBotSettings) {
      logger.info('Обновляем только функциональные настройки бота', {
        projectId: id
      });

      // Обновляем только functionalSettings
      const updatedSettings = await db.botSettings.update({
        where: { projectId: id },
        data: {
          functionalSettings: body.functionalSettings || {}
        }
      });

      return NextResponse.json(
        {
          ...updatedSettings,
          message: 'Функциональные настройки бота успешно обновлены'
        },
        { headers: createCorsHeaders(request) }
      );
    }

    // Если не передан botToken и нет существующих настроек - создаем базовые настройки
    if (!body.botToken && !existingBotSettings) {
      logger.info(
        'Создаем базовые настройки бота с функциональными настройками',
        {
          projectId: id
        }
      );

      // Создаем базовые настройки бота с пустым токеном (можно будет обновить позже)
      const newSettings = await db.botSettings.create({
        data: {
          projectId: id,
          botToken: '', // Пустой токен, будет обновлен позже
          botUsername: '',
          isActive: false,
          functionalSettings: body.functionalSettings || {}
        }
      });

      return NextResponse.json(
        {
          ...newSettings,
          message: 'Базовые настройки бота созданы'
        },
        { headers: createCorsHeaders(request) }
      );
    }

    // Валидация данных для полного обновления
    if (!body.botToken) {
      return NextResponse.json(
        { error: 'Токен бота обязателен для создания/полного обновления' },
        { status: 400, headers: createCorsHeaders(request) }
      );
    }

    // Проверяем валидность токена бота (базовая проверка формата)
    // Telegram bot tokens format: <bot_id>:<token>
    // Example: 123456789:AAHmCIAAIfasYFQQB_3fSqcP_BB0_YykG7Y
    const tokenParts = body.botToken.split(':');
    if (
      tokenParts.length !== 2 ||
      !/^\d+$/.test(tokenParts[0]) || // bot ID should be numeric
      !tokenParts[1].startsWith('AA') || // token should start with AA
      body.botToken.length < 45
    ) {
      return NextResponse.json(
        {
          error:
            'Неверный формат токена бота. Токен должен быть в формате: <bot_id>:<token>'
        },
        { status: 400, headers: createCorsHeaders(request) }
      );
    }

    // Обновляем настройки бота
    const botSettings = await db.botSettings.update({
      where: { projectId: id },
      data: {
        botToken: body.botToken,
        botUsername: body.botUsername,
        functionalSettings: body.functionalSettings || {}
      }
    });

    // Проверяем, изменился ли токен
    const existingBot = botManager.getBot(id);
    const tokenChanged = existingBot && existingBot.bot.token !== body.botToken;
    
    logger.info('🔍 ПРОВЕРКА ИЗМЕНЕНИЯ ТОКЕНА', {
      projectId: id,
      existingBot: existingBot ? {
        token: '***' + existingBot.bot.token.slice(-4),
        isActive: existingBot.isActive,
        isPolling: existingBot.isPolling
      } : null,
      newToken: '***' + body.botToken.slice(-4),
      tokenChanged,
      allBotsInManager: botManager.getAllBotsStatus(),
      component: 'bot-api'
    });
    
    if (tokenChanged) {
      // Если токен изменился, экстренно останавливаем ВСЕ боты с новым токеном
      try {
        logger.info('🔄 ТОКЕН ИЗМЕНИЛСЯ, ЭКСТРЕННАЯ ОСТАНОВКА', {
          projectId: id,
          oldToken: existingBot.bot.token ? '***' + existingBot.bot.token.slice(-4) : 'none',
          newToken: '***' + body.botToken.slice(-4),
          component: 'bot-api'
        });

        // Экстренно останавливаем все боты с новым токеном
        await botManager.emergencyStopBotsWithToken(body.botToken);
        
        // Останавливаем текущий бот
        await botManager.stopBot(id);
        
        // Ждем для полной очистки Telegram API
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Создаем новый бот с новым токеном
        await botManager.createBot(id, {
          id: body.id,
          projectId: id,
          botToken: body.botToken,
          botUsername: body.botUsername,
          functionalSettings: body.functionalSettings || {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        logger.info('Бот успешно пересоздан с новым токеном', {
          projectId: id,
          component: 'bot-api'
        });
      } catch (botError) {
        const errorMessage = botError instanceof Error ? botError.message : 'Unknown error';
        
        // Специальная обработка 409 конфликтов
        if (errorMessage.includes('409') || errorMessage.includes('terminated by other getUpdates')) {
          logger.warn(
            '409 конфликт при обновлении бота - возможно запущен другой экземпляр',
            {
              projectId: id,
              error: errorMessage,
              component: 'bot-api'
            }
          );
          
          // Возвращаем успех, так как настройки сохранены
          return NextResponse.json(
            {
              ...botSettings,
              message: 'Настройки бота обновлены. Возможен конфликт с другим экземпляром бота.',
              warning: '409 Conflict: возможно запущен другой экземпляр бота с тем же токеном'
            },
            { headers: createCorsHeaders(request) }
          );
        }
        
        logger.warn(
          'Не удалось пересоздать бота, но настройки обновлены',
          {
            projectId: id,
            error: errorMessage
          },
          'bot-api'
        );
      }
    } else {
      // Если токен не изменился, просто обновляем настройки
      try {
        await botManager.updateBot(id, {
          id: body.id,
          projectId: id,
          botToken: body.botToken,
          botUsername: body.botUsername,
          functionalSettings: body.functionalSettings || {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        logger.info('Настройки бота обновлены', {
          projectId: id,
          component: 'bot-api'
        });
      } catch (botError) {
        logger.warn(
          'Не удалось обновить настройки бота',
          {
            projectId: id,
            error: botError instanceof Error ? botError.message : 'Unknown error'
          },
          'bot-api'
        );
      }
    }

    logger.info('Настройки бота обновлены', { projectId: id }, 'bot-api');

    return NextResponse.json(
      {
        ...botSettings,
        message: 'Настройки бота успешно обновлены'
      },
      { headers: createCorsHeaders(request) }
    );
  } catch (error) {
    const { id: projectId } = await context.params;
    logger.error(
      'Ошибка обновления настроек бота',
      { 
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        component: 'bot-api'
      }
    );
    return NextResponse.json(
      { error: 'Ошибка обновления настроек бота' },
      { status: 500, headers: createCorsHeaders(request) }
    );
  }
}

// DELETE /api/projects/[id]/bot - Удаление настроек бота
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Проверяем существование проекта
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404, headers: createCorsHeaders(request) }
      );
    }

    // Проверяем существование настроек
    const existingSettings = await db.botSettings.findUnique({
      where: { projectId: id }
    });

    if (!existingSettings) {
      return NextResponse.json(
        { error: 'Настройки бота не найдены' },
        { status: 404, headers: createCorsHeaders(request) }
      );
    }

    // Удаляем настройки бота
    await db.botSettings.delete({
      where: { projectId: id }
    });

    // Останавливаем бота
    try {
      await botManager.stopBot(id);
      logger.info('Бот успешно остановлен', { projectId: id }, 'bot-api');
    } catch (botError) {
      logger.warn(
        'Не удалось остановить бота',
        {
          projectId: id,
          error: botError instanceof Error ? botError.message : 'Unknown error'
        },
        'bot-api'
      );
    }

    logger.info('Настройки бота удалены', { projectId: id }, 'bot-api');

    return NextResponse.json(
      { message: 'Настройки бота успешно удалены' },
      { headers: createCorsHeaders(request) }
    );
  } catch (error) {
    logger.error(
      'Ошибка удаления настроек бота',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'bot-api'
    );
    return NextResponse.json(
      { error: 'Ошибка удаления настроек бота' },
      { status: 500, headers: createCorsHeaders(request) }
    );
  }
}
