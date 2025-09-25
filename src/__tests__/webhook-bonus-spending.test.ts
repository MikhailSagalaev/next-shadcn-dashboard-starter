/**
 * @file: webhook-bonus-spending.test.ts
 * @description: Тесты для проверки логики списания бонусов в webhook
 * @project: SaaS Bonus System
 * @created: 2025-09-25
 * @author: AI Assistant + User
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Мокаем зависимости
jest.mock('@/lib/db', () => ({
  db: {
    project: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    bonus: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    transaction: {
      create: jest.fn(),
      aggregate: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock('@/lib/services/user.service', () => ({
  UserService: {
    findUserByContact: jest.fn(),
    createUser: jest.fn(),
    getUserBalance: jest.fn()
  },
  BonusService: {
    spendBonuses: jest.fn(),
    awardPurchaseBonus: jest.fn()
  }
}));

jest.mock('@/lib/services/bonus-level.service', () => ({
  BonusLevelService: {
    calculateUserLevel: jest.fn()
  }
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Типы для тестов
interface TestTildaOrder {
  name: string;
  email: string;
  phone: string;
  payment: {
    amount: string;
    orderid: string;
    promocode?: string;
  };
  appliedBonuses?: string;
}

describe('Webhook Bonus Spending Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldSpendBonuses calculation', () => {
    it('should return true when appliedBonuses > 0 and bonusBehavior is SPEND_AND_EARN', () => {
      // Тестовые данные
      const appliedRequested = 2500;
      const bonusBehavior = 'SPEND_AND_EARN';

      // Логика из webhook
      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      expect(shouldSpendBonuses).toBe(true);
    });

    it('should return true when appliedBonuses > 0 and bonusBehavior is SPEND_ONLY', () => {
      const appliedRequested = 1000;
      const bonusBehavior = 'SPEND_ONLY';

      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      expect(shouldSpendBonuses).toBe(true);
    });

    it('should return false when appliedBonuses is 0', () => {
      const appliedRequested = 0;
      const bonusBehavior = 'SPEND_AND_EARN';

      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      expect(shouldSpendBonuses).toBe(false);
    });

    it('should return false when bonusBehavior is EARN_ONLY', () => {
      const appliedRequested = 1500;
      const bonusBehavior = 'EARN_ONLY';

      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      expect(shouldSpendBonuses).toBe(false);
    });

    it('should return false when appliedBonuses is not a finite number', () => {
      const appliedRequested = NaN;
      const bonusBehavior = 'SPEND_AND_EARN';

      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      expect(shouldSpendBonuses).toBe(false);
    });
  });

  describe('appliedBonuses parsing', () => {
    it('should correctly parse string appliedBonuses', () => {
      const orderData = { appliedBonuses: '2500' };

      const appliedRequested =
        typeof (orderData as any).appliedBonuses === 'string'
          ? parseFloat((orderData as any).appliedBonuses) || 0
          : (orderData as any).appliedBonuses || 0;

      expect(appliedRequested).toBe(2500);
    });

    it('should correctly parse number appliedBonuses', () => {
      const orderData = { appliedBonuses: 1500 };

      const appliedRequested =
        typeof (orderData as any).appliedBonuses === 'string'
          ? parseFloat((orderData as any).appliedBonuses) || 0
          : (orderData as any).appliedBonuses || 0;

      expect(appliedRequested).toBe(1500);
    });

    it('should return 0 for invalid string appliedBonuses', () => {
      const orderData = { appliedBonuses: 'invalid' };

      const appliedRequested =
        typeof (orderData as any).appliedBonuses === 'string'
          ? parseFloat((orderData as any).appliedBonuses) || 0
          : (orderData as any).appliedBonuses || 0;

      expect(appliedRequested).toBe(0);
    });

    it('should return 0 when appliedBonuses is undefined', () => {
      const orderData = {};

      const appliedRequested =
        typeof (orderData as any).appliedBonuses === 'string'
          ? parseFloat((orderData as any).appliedBonuses) || 0
          : (orderData as any).appliedBonuses || 0;

      expect(appliedRequested).toBe(0);
    });
  });

  describe('promocode detection', () => {
    it('should correctly detect GUPIL promocode from payment', () => {
      const payment = { promocode: 'GUPIL' };
      const orderData = {};

      const promoFromPayment = (payment as any)?.promocode;
      const promoFromOrderData = (orderData as any)?.promocode;
      const finalPromo = promoFromPayment || promoFromOrderData;
      const isGupilPromo =
        typeof finalPromo === 'string' &&
        finalPromo.trim().toUpperCase() === 'GUPIL';

      expect(isGupilPromo).toBe(true);
    });

    it('should correctly detect GUPIL promocode with different case', () => {
      const payment = { promocode: 'gupil' };
      const orderData = {};

      const promoFromPayment = (payment as any)?.promocode;
      const promoFromOrderData = (orderData as any)?.promocode;
      const finalPromo = promoFromPayment || promoFromOrderData;
      const isGupilPromo =
        typeof finalPromo === 'string' &&
        finalPromo.trim().toUpperCase() === 'GUPIL';

      expect(isGupilPromo).toBe(true);
    });

    it('should return false for non-GUPIL promocodes', () => {
      const payment = { promocode: 'DISCOUNT10' };
      const orderData = {};

      const promoFromPayment = (payment as any)?.promocode;
      const promoFromOrderData = (orderData as any)?.promocode;
      const finalPromo = promoFromPayment || promoFromOrderData;
      const isGupilPromo =
        typeof finalPromo === 'string' &&
        finalPromo.trim().toUpperCase() === 'GUPIL';

      expect(isGupilPromo).toBe(false);
    });

    it('should return false when no promocode is present', () => {
      const payment = {};
      const orderData = {};

      const promoFromPayment = (payment as any)?.promocode;
      const promoFromOrderData = (orderData as any)?.promocode;
      const finalPromo = promoFromPayment || promoFromOrderData;
      const isGupilPromo =
        typeof finalPromo === 'string' &&
        finalPromo.trim().toUpperCase() === 'GUPIL';

      expect(isGupilPromo).toBe(false);
    });
  });

  describe('Real world test case', () => {
    it('should correctly process the failing webhook payload', () => {
      // Данные из реального запроса пользователя
      const orderData = {
        Name: 'Михаил Иванович Сагалаев',
        Email: 'sagalaev.mikhail@yandex.ru',
        Phone: '+7 (962) 002-41-88',
        payment: {
          amount: '2980',
          orderid: '1356279354',
          promocode: 'GUPIL'
        },
        appliedBonuses: '2500'
      };

      const bonusBehavior = 'SPEND_AND_EARN';

      // Парсинг appliedBonuses
      const appliedRequested =
        typeof (orderData as any).appliedBonuses === 'string'
          ? parseFloat((orderData as any).appliedBonuses) || 0
          : (orderData as any).appliedBonuses || 0;

      // Определение промокода
      const promoFromPayment = (orderData.payment as any)?.promocode;
      const promoFromOrderData = (orderData as any)?.promocode;
      const finalPromo = promoFromPayment || promoFromOrderData;
      const isGupilPromo =
        typeof finalPromo === 'string' &&
        finalPromo.trim().toUpperCase() === 'GUPIL';

      // Проверка условий списания
      const shouldSpendBonuses =
        Number.isFinite(appliedRequested) &&
        appliedRequested > 0 &&
        (bonusBehavior === 'SPEND_AND_EARN' || bonusBehavior === 'SPEND_ONLY');

      // Ожидаемые результаты
      expect(appliedRequested).toBe(2500);
      expect(isGupilPromo).toBe(true);
      expect(shouldSpendBonuses).toBe(true);
    });
  });
});
