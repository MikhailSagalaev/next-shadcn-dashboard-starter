/**
 * @file: src/lib/utils/referral-link.ts
 * @description: Утилиты для формирования реферальных ссылок в UI
 * @project: SaaS Bonus System
 * @dependencies: none
 * @created: 2025-11-15
 */

/**
 * Нормализует домен проекта и гарантирует протокол.
 */
export function normalizeProjectDomain(domain?: string | null): string {
  const fallback = 'https://ваш-домен.ru';

  if (!domain || !domain.trim()) {
    return fallback;
  }

  let normalized = domain.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  return normalized.replace(/\/+$/, '');
}

/**
 * Возвращает пример реферальной ссылки с подстановкой userId.
 */
export function getReferralLinkExample(domain?: string | null): string {
  return `${normalizeProjectDomain(domain)}/?utm_ref=<userId>`;
}

/**
 * Формирует реферальную ссылку конкретного пользователя для UI
 * (админка). Совпадает по схеме с ReferralService.generateReferralLink:
 * базовый домен проекта + `utm_ref=<userId>`. Для мульти-сетей сервер
 * дополнительно добавляет `utm_org`, но для админ-ссылки достаточно
 * `utm_ref` — именно по нему система атрибутирует реферала.
 */
export function buildReferralLink(
  domain: string | null | undefined,
  userId: string
): string {
  return `${normalizeProjectDomain(domain)}/?utm_ref=${userId}`;
}


