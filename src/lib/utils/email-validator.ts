/**
 * @file: src/lib/utils/email-validator.ts
 * @description: Утилита для валидации email адресов
 * @project: SaaS Bonus System
 * @dependencies: none
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

export interface EmailValidationResult {
  valid: boolean;
  email?: string;
  error?: string;
}

/**
 * Регулярное выражение для валидации email
 * Поддерживает стандартные форматы: local@domain.tld
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Валидирует email адрес
 * @param input - строка для валидации
 * @returns результат валидации с нормализованным email или ошибкой
 */
export function validateEmail(input: string): EmailValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      error: 'Пожалуйста, введите email адрес'
    };
  }

  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return {
      valid: false,
      error: 'Пожалуйста, введите email адрес'
    };
  }

  // Проверка на наличие @
  if (!trimmed.includes('@')) {
    return {
      valid: false,
      error: 'Неверный формат email. Пример: example@mail.ru'
    };
  }

  // Проверка на наличие домена
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[1].includes('.')) {
    return {
      valid: false,
      error: 'Неверный формат email. Пример: example@mail.ru'
    };
  }

  // Полная проверка регулярным выражением
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Неверный формат email. Пример: example@mail.ru'
    };
  }

  return {
    valid: true,
    email: trimmed
  };
}

/**
 * Проверяет, похожа ли строка на email (для быстрой проверки)
 */
export function looksLikeEmail(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  const trimmed = input.trim();
  return trimmed.includes('@') && trimmed.includes('.');
}

/**
 * EmailValidator класс для использования в workflow
 */
export class EmailValidator {
  validate(input: string): EmailValidationResult {
    return validateEmail(input);
  }

  looksLikeEmail(input: string): boolean {
    return looksLikeEmail(input);
  }
}

export const emailValidator = new EmailValidator();
