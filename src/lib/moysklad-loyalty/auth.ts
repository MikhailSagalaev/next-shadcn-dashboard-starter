/**
 * @file: auth.ts
 * @description: Утилиты для аутентификации МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

/**
 * Генерирует уникальный auth token для интеграции
 *
 * @returns Случайный токен (32 символа hex)
 */
export function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Хеширует auth token с помощью bcrypt
 *
 * @param token - Токен для хеширования
 * @returns Хешированный токен
 */
export async function hashAuthToken(token: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(token, saltRounds);
}

/**
 * Проверяет auth token против хешированного значения
 *
 * @param token - Токен для проверки
 * @param hashedToken - Хешированный токен из БД
 * @returns true если токен валиден, false иначе
 */
export async function verifyAuthToken(
  token: string,
  hashedToken: string
): Promise<boolean> {
  return await bcrypt.compare(token, hashedToken);
}

/**
 * Генерирует base URL для Loyalty API
 *
 * @param projectId - ID проекта
 * @returns Base URL в формате https://gupil.ru/api/moysklad-loyalty/[projectId]
 */
export function generateBaseUrl(projectId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gupil.ru';
  return `${baseUrl}/api/moysklad-loyalty/${projectId}`;
}
