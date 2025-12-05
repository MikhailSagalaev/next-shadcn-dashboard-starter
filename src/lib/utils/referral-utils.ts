/**
 * @file: referral-utils.ts
 * @description: Утилиты для обработки данных рефералов
 * @project: SaaS Bonus System
 * @dependencies: None
 * @created: 2025-12-05
 * @author: AI Assistant + User
 */

/**
 * Интерфейс реферала
 */
export interface ReferralUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  registeredAt: string;
  bonusBalance: number;
  totalEarned: number;
  referralCount: number;
  level: number;
}

/**
 * Группа рефералов по уровню
 */
export interface ReferralLevelGroup {
  level: number;
  count: number;
  referrals: ReferralUser[];
}

/**
 * Статистика по рефералам
 */
export interface ReferralStats {
  totalReferrals: number;
  totalBonusesEarned: number;
  referralsByLevel: { level: number; count: number }[];
}

/**
 * Группирует рефералов по уровням
 * @param referrals - массив рефералов
 * @returns массив групп по уровням
 */
export function groupReferralsByLevel(
  referrals: ReferralUser[]
): ReferralLevelGroup[] {
  const levelMap = new Map<number, ReferralUser[]>();

  for (const referral of referrals) {
    const existing = levelMap.get(referral.level) || [];
    existing.push(referral);
    levelMap.set(referral.level, existing);
  }

  const groups: ReferralLevelGroup[] = [];
  for (const [level, refs] of levelMap.entries()) {
    groups.push({
      level,
      count: refs.length,
      referrals: refs
    });
  }

  // Сортируем по уровню
  return groups.sort((a, b) => a.level - b.level);
}

/**
 * Вычисляет статистику по рефералам
 * @param referrals - массив рефералов
 * @param bonusesEarned - общая сумма заработанных бонусов от рефералов
 * @returns статистика по рефералам
 */
export function calculateReferralStats(
  referrals: ReferralUser[],
  bonusesEarned: number = 0
): ReferralStats {
  const levelCounts = new Map<number, number>();

  for (const referral of referrals) {
    const current = levelCounts.get(referral.level) || 0;
    levelCounts.set(referral.level, current + 1);
  }

  const referralsByLevel: { level: number; count: number }[] = [];
  for (const [level, count] of levelCounts.entries()) {
    referralsByLevel.push({ level, count });
  }

  // Сортируем по уровню
  referralsByLevel.sort((a, b) => a.level - b.level);

  return {
    totalReferrals: referrals.length,
    totalBonusesEarned: bonusesEarned,
    referralsByLevel
  };
}

/**
 * Форматирует данные реферала для отображения
 * @param referral - данные реферала
 * @returns отформатированный объект для UI
 */
export function formatReferralUser(referral: ReferralUser): {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  registeredAt: string;
  formattedDate: string;
  bonusBalance: string;
  totalEarned: string;
  referralCount: number;
  hasChildren: boolean;
  level: number;
} {
  // Формируем отображаемое имя
  const displayName = formatDisplayName(
    referral.firstName,
    referral.lastName,
    referral.email
  );

  // Форматируем дату
  const date = new Date(referral.registeredAt);
  const formattedDate = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return {
    id: referral.id,
    displayName,
    email: referral.email,
    phone: referral.phone,
    registeredAt: referral.registeredAt,
    formattedDate,
    bonusBalance: formatNumber(referral.bonusBalance),
    totalEarned: formatNumber(referral.totalEarned),
    referralCount: referral.referralCount,
    hasChildren: referral.referralCount > 0,
    level: referral.level
  };
}

/**
 * Форматирует отображаемое имя пользователя
 */
function formatDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  if (lastName) {
    return lastName;
  }
  if (email) {
    return email;
  }
  return 'Без имени';
}

/**
 * Форматирует число с разделителями тысяч
 */
function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Проверяет, есть ли у реферала дочерние рефералы
 */
export function hasChildReferrals(referral: ReferralUser): boolean {
  return referral.referralCount > 0;
}

/**
 * Получает общее количество рефералов из групп по уровням
 */
export function getTotalFromGroups(groups: ReferralLevelGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
