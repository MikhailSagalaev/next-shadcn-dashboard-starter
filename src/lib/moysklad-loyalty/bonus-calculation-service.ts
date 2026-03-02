/**
 * @file: bonus-calculation-service.ts
 * @description: Сервис расчета бонусов для МойСклад Loyalty API
 * @project: SaaS Bonus System
 * @created: 2026-03-02
 * @author: AI Assistant
 *
 * Реализует логику BonusBehavior:
 * - SPEND_AND_EARN: начисляем на (total - spent) если бонусы использованы
 * - SPEND_ONLY: НЕ начисляем если бонусы использованы
 * - EARN_ONLY: НЕ разрешаем списание бонусов
 */

import { BonusBehavior } from '@prisma/client';
import { db } from '@/lib/db';

export interface BonusCalculationParams {
  totalAmount: number;
  spentBonuses: number;
  bonusPercentage: number;
  bonusBehavior: BonusBehavior;
}

export interface MaxSpendableParams {
  totalAmount: number;
  maxSpendPercent: number;
  userBalance: number;
}

/**
 * Рассчитывает начисляемые бонусы на основе суммы и процента
 */
export function calculateEarnedBonuses(
  amount: number,
  percentage: number
): number {
  const earned = (amount * percentage) / 100;
  return Math.round(earned * 100) / 100; // Округляем до 2 знаков
}

/**
 * Рассчитывает максимум бонусов, которые можно потратить
 */
export function calculateMaxSpendableBonuses(
  params: MaxSpendableParams
): number {
  const { totalAmount, maxSpendPercent, userBalance } = params;

  // Максимум по проценту от суммы
  const maxByPercent = (totalAmount * maxSpendPercent) / 100;

  // Минимум из доступного баланса и лимита
  const maxSpendable = Math.min(maxByPercent, userBalance);

  return Math.round(maxSpendable * 100) / 100;
}

/**
 * Применяет логику BonusBehavior для расчета начисляемых бонусов
 *
 * КРИТИЧНО: Логика зависит от того, использовал ли клиент бонусы при оплате
 *
 * Если клиент НЕ использовал бонусы:
 * - Все режимы: начисляем на полную сумму
 *
 * Если клиент использовал бонусы:
 * - SPEND_AND_EARN: начисляем на (total - spent)
 * - SPEND_ONLY: НЕ начисляем
 * - EARN_ONLY: не должно произойти (бонусы нельзя тратить)
 */
export function applyBonusBehavior(params: BonusCalculationParams): number {
  const { totalAmount, spentBonuses, bonusPercentage, bonusBehavior } = params;

  // Если клиент НЕ использовал бонусы
  if (spentBonuses === 0) {
    // Все режимы: начисляем на полную сумму
    return calculateEarnedBonuses(totalAmount, bonusPercentage);
  }

  // Если клиент использовал бонусы
  switch (bonusBehavior) {
    case 'SPEND_AND_EARN':
      // Начисляем на остаток (сумма - списанные бонусы)
      const remainder = totalAmount - spentBonuses;
      return calculateEarnedBonuses(remainder, bonusPercentage);

    case 'SPEND_ONLY':
      // НЕ начисляем
      return 0;

    case 'EARN_ONLY':
      // Не должно произойти (бонусы нельзя тратить в этом режиме)
      throw new Error('Cannot spend bonuses in EARN_ONLY mode');

    default:
      throw new Error(`Unknown bonus behavior: ${bonusBehavior}`);
  }
}

/**
 * Получает текущий доступный баланс пользователя
 * (исключая истекшие бонусы)
 */
export async function getUserAvailableBalance(userId: string): Promise<number> {
  const now = new Date();

  const result = await db.bonus.aggregate({
    where: {
      userId,
      isUsed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    _sum: {
      amount: true
    }
  });

  const balance = result._sum.amount || 0;
  return Number(balance);
}

/**
 * Проверяет достаточность баланса для списания
 */
export async function checkSufficientBalance(
  userId: string,
  requiredAmount: number
): Promise<{ sufficient: boolean; available: number }> {
  const available = await getUserAvailableBalance(userId);

  return {
    sufficient: available >= requiredAmount,
    available
  };
}

/**
 * Распределяет скидку пропорционально по позициям
 */
export function distributeDiscountAcrossPositions(
  positions: Array<{ quantity: number; price: number }>,
  totalDiscount: number
): Array<{ discount: number }> {
  // Рассчитываем общую сумму
  const totalSum = positions.reduce(
    (sum, pos) => sum + pos.quantity * pos.price,
    0
  );

  if (totalSum === 0) {
    return positions.map(() => ({ discount: 0 }));
  }

  // Распределяем скидку пропорционально
  return positions.map((pos) => {
    const positionSum = pos.quantity * pos.price;
    const positionDiscount = (positionSum / totalSum) * totalDiscount;
    return {
      discount: Math.round(positionDiscount * 100) / 100
    };
  });
}
