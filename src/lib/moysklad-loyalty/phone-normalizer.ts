/**
 * @file: phone-normalizer.ts
 * @description: Утилита для нормализации номеров телефонов в формат E.164
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 */

/**
 * Нормализует номер телефона в формат E.164 (+7XXXXXXXXXX)
 *
 * Поддерживаемые форматы:
 * - +7XXXXXXXXXX
 * - 8XXXXXXXXXX
 * - 7XXXXXXXXXX
 * - +7 (XXX) XXX-XX-XX
 * - 8 (XXX) XXX-XX-XX
 *
 * @param phone - Номер телефона в любом формате
 * @returns Нормализованный номер в формате +7XXXXXXXXXX или null если формат неверный
 */
export function normalizePhoneNumber(phone: string): string | null {
  // Удаляем все нецифровые символы
  const cleaned = phone.replace(/\D/g, '');

  // Проверяем длину (должно быть 11 цифр)
  if (cleaned.length !== 11) {
    return null;
  }

  // Проверяем что начинается с 7 или 8
  if (!cleaned.startsWith('7') && !cleaned.startsWith('8')) {
    return null;
  }

  // Заменяем 8 на 7 и добавляем +
  const normalized = cleaned.startsWith('8')
    ? '+7' + cleaned.substring(1)
    : '+' + cleaned;

  return normalized;
}

/**
 * Проверяет валидность номера телефона
 *
 * @param phone - Номер телефона для проверки
 * @returns true если номер валиден, false иначе
 */
export function isValidPhoneNumber(phone: string): boolean {
  return normalizePhoneNumber(phone) !== null;
}

/**
 * Форматирует номер телефона для отображения
 *
 * @param phone - Номер телефона в формате E.164
 * @returns Отформатированный номер: +7 (XXX) XXX-XX-XX
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return phone;
  }

  // +7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
  const digits = normalized.substring(2); // Убираем +7
  return `+7 (${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 8)}-${digits.substring(8, 10)}`;
}
