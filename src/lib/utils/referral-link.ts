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


