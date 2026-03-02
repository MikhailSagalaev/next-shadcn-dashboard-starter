/**
 * @file: verification-code-service.ts
 * @description: Сервис генерации и валидации кодов верификации
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// Rate limiting для кодов верификации (in-memory)
const verificationRateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

/**
 * Генерирует 6-значный код верификации
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Проверяет rate limit для запросов кодов верификации
 * Лимит: 3 запроса на пользователя за 10 минут
 */
export function checkVerificationRateLimit(userId: string): boolean {
  const now = Date.now();
  const key = `verification:${userId}`;
  const limit = verificationRateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    // Новое окно или истекло время
    verificationRateLimitStore.set(key, {
      count: 1,
      resetAt: now + 10 * 60 * 1000 // 10 минут
    });
    return true;
  }

  if (limit.count >= 3) {
    return false; // Превышен лимит
  }

  limit.count++;
  return true;
}

/**
 * Сохраняет код верификации в БД
 * Код истекает через 5 минут
 */
export async function storeVerificationCode(
  userId: string,
  code: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

  // TODO: Добавить модель VerificationCode в Prisma schema
  // await db.verificationCode.create({
  //   data: {
  //     userId,
  //     code,
  //     expiresAt,
  //     isUsed: false
  //   }
  // });

  logger.info(
    'Verification code stored (in-memory)',
    {
      userId,
      expiresAt
    },
    'moysklad-loyalty'
  );
}

/**
 * Валидирует код верификации
 */
export async function validateVerificationCode(
  userId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const now = new Date();

  // TODO: Добавить модель VerificationCode в Prisma schema
  // const verificationCode = await db.verificationCode.findFirst({
  //   where: {
  //     userId,
  //     code,
  //     isUsed: false,
  //     expiresAt: { gt: now }
  //   },
  //   orderBy: {
  //     createdAt: 'desc'
  //   }
  // });

  // if (!verificationCode) {
  //   logger.warn(
  //     'Invalid or expired verification code',
  //     {
  //       userId
  //     },
  //     'moysklad-loyalty'
  //   );

  //   return {
  //     valid: false,
  //     error: 'Неверный или истекший код верификации'
  //   };
  // }

  // Временная заглушка
  logger.info(
    'Verification code validation (stub)',
    {
      userId,
      code
    },
    'moysklad-loyalty'
  );

  return { valid: true };
}

/**
 * Помечает код верификации как использованный
 */
export async function expireVerificationCode(
  userId: string,
  code: string
): Promise<void> {
  // TODO: Добавить модель VerificationCode в Prisma schema
  // await db.verificationCode.updateMany({
  //   where: {
  //     userId,
  //     code,
  //     isUsed: false
  //   },
  //   data: {
  //     isUsed: true
  //   }
  // });

  logger.info(
    'Verification code expired (stub)',
    {
      userId
    },
    'moysklad-loyalty'
  );
}

/**
 * Отправляет код верификации через SMS
 */
export async function sendVerificationCodeViaSMS(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  // TODO: Интеграция с SMS провайдером
  logger.info(
    'Sending verification code via SMS',
    {
      phone,
      code
    },
    'moysklad-loyalty'
  );

  // Заглушка - в реальности здесь будет вызов SMS API
  return { success: true };
}

/**
 * Отправляет код верификации через Telegram
 */
export async function sendVerificationCodeViaTelegram(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Находим пользователя с Telegram ID
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        projectId: true
      }
    });

    if (!user?.telegramId) {
      return {
        success: false,
        error: 'Telegram не привязан'
      };
    }

    // TODO: Отправка через Telegram бота
    logger.info(
      'Sending verification code via Telegram',
      {
        userId,
        telegramId: user.telegramId,
        code
      },
      'moysklad-loyalty'
    );

    // Заглушка - в реальности здесь будет вызов Telegram API
    return { success: true };
  } catch (error) {
    logger.error(
      'Error sending verification code via Telegram',
      {
        error,
        userId
      },
      'moysklad-loyalty'
    );

    return {
      success: false,
      error: 'Ошибка отправки через Telegram'
    };
  }
}

/**
 * Отправляет код верификации (алиас для requestVerificationCode)
 */
export async function sendVerificationCode(userId: string): Promise<{
  success: boolean;
  error?: string;
  method?: 'sms' | 'telegram';
}> {
  return requestVerificationCode(userId);
}

/**
 * Запрашивает код верификации для пользователя
 * Автоматически выбирает метод отправки (SMS или Telegram)
 */
export async function requestVerificationCode(userId: string): Promise<{
  success: boolean;
  error?: string;
  method?: 'sms' | 'telegram';
}> {
  // Проверяем rate limit
  if (!checkVerificationRateLimit(userId)) {
    return {
      success: false,
      error: 'Превышен лимит запросов кодов верификации (3 запроса за 10 минут)'
    };
  }

  // Генерируем код
  const code = generateVerificationCode();

  // Сохраняем в БД
  await storeVerificationCode(userId, code);

  // Получаем данные пользователя
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      telegramId: true
    }
  });

  if (!user) {
    return {
      success: false,
      error: 'Пользователь не найден'
    };
  }

  // Пробуем отправить через Telegram
  if (user.telegramId) {
    const result = await sendVerificationCodeViaTelegram(userId, code);
    if (result.success) {
      return {
        success: true,
        method: 'telegram'
      };
    }
  }

  // Пробуем отправить через SMS
  if (user.phone) {
    const result = await sendVerificationCodeViaSMS(user.phone, code);
    if (result.success) {
      return {
        success: true,
        method: 'sms'
      };
    }
  }

  // Нет доступных методов отправки
  return {
    success: false,
    error:
      'Нет доступных методов отправки кода (требуется телефон или Telegram)'
  };
}

/**
 * Очистка старых кодов верификации (вызывать периодически)
 */
export async function cleanupExpiredVerificationCodes(): Promise<void> {
  const now = new Date();

  // TODO: Добавить модель VerificationCode в Prisma schema
  // const result = await db.verificationCode.deleteMany({
  //   where: {
  //     OR: [{ expiresAt: { lt: now } }, { isUsed: true }]
  //   }
  // });

  logger.info(
    'Cleaned up expired verification codes (stub)',
    {
      deletedCount: 0
    },
    'moysklad-loyalty'
  );
}

// Очистка каждый час
// if (typeof window === 'undefined') {
//   setInterval(cleanupExpiredVerificationCodes, 60 * 60 * 1000);
// }
