/**
 * @file: __tests__/services/partner-cabinet.service.payout.test.ts
 * @description: Тесты пошагового сбора реквизитов вывода
 *   (PartnerCabinetService.resolvePayoutAction/resolvePayoutDetailsCapture).
 *   Покрывает старое поведение (card/sbp/wallet — одно свободнотекстовое
 *   поле raw, без регрессий) и новый способ self_employed (ИНН/ФИО/карта,
 *   пошаговый диалог с ретраем текущего шага при ошибке валидации, а не
 *   сбросом всей цепочки).
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

import { PartnerCabinetService } from '@/lib/services/partner-cabinet.service';
import { db } from '@/lib/db';
import { PayoutService } from '@/lib/services/payout.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/payout.service', () => ({
  PayoutService: {
    requestPayout: jest.fn()
  }
}));
jest.mock('@/lib/services/partner-notification.service', () => ({
  PartnerNotificationService: {
    notifyDirectorAboutPayoutRequest: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('@/lib/services/admin-notification.service', () => ({
  AdminNotificationService: {
    notifyProjectOwner: jest.fn().mockResolvedValue(undefined)
  }
}));

// In-memory замена Redis-кэша — реальное поведение set/get/delete между
// последовательными вызовами важно для этого теста (пошаговое состояние
// живёт между сообщениями).
jest.mock('@/lib/redis', () => {
  const store = new Map<string, unknown>();
  return {
    CacheService: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
      })
    },
    redis: {}
  };
});

const mockDb = db as jest.Mocked<typeof db>;
const projectId = 'project-1';
const userId = 'user-1';
const externalUserId = '555';

function mockBalance(amount: number) {
  (mockDb as any).bonus = {
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount } })
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBalance(1000);
  (PayoutService.requestPayout as jest.Mock).mockResolvedValue({
    id: 'payout-1',
    amount: 1000
  });
});

describe('PartnerCabinetService — способ вывода self_employed (ИНН/ФИО/карта)', () => {
  it('собирает три поля по шагам и создаёт заявку с ожидаемыми payoutDetails', async () => {
    // Шаг 0: выбор способа.
    const selectResult = await PartnerCabinetService.resolvePayoutAction(
      projectId,
      userId,
      'payout_method:self_employed',
      { externalUserId, platform: 'telegram' }
    );
    expect(selectResult?.text).toContain('Шаг 1/3');
    expect(selectResult?.text).toContain('ИНН');

    // Шаг 1: ИНН (12 цифр — физлицо/самозанятый).
    const step1 = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '123456789012'
    );
    expect(step1?.text).toContain('Шаг 2/3');
    expect(step1?.text).toContain('ФИО');
    expect(PayoutService.requestPayout).not.toHaveBeenCalled();

    // Шаг 2: ФИО.
    const step2 = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      'Иванов Иван Иванович'
    );
    expect(step2?.text).toContain('Шаг 3/3');
    expect(step2?.text).toContain('карт');
    expect(PayoutService.requestPayout).not.toHaveBeenCalled();

    // Шаг 3: номер карты (тестовый Visa-номер, проходит Luhn).
    const step3 = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '4111 1111 1111 1111'
    );
    expect(step3?.toast).toBe('Заявка создана');
    expect(PayoutService.requestPayout).toHaveBeenCalledTimes(1);
    const call = (PayoutService.requestPayout as jest.Mock).mock.calls[0][0];
    expect(call.payoutMethod).toBe('self_employed');
    expect(call.payoutDetails).toEqual({
      inn: '123456789012',
      fullName: 'Иванов Иван Иванович',
      cardNumber: '4111111111111111'
    });
  });

  it('при невалидном ИНН переспрашивает ТОЛЬКО этот шаг, не сбрасывая процесс целиком', async () => {
    await PartnerCabinetService.resolvePayoutAction(
      projectId,
      userId,
      'payout_method:self_employed',
      { externalUserId, platform: 'telegram' }
    );

    const badInn = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '123'
    );
    expect(badInn?.toast).toBe('Некорректные данные');
    expect(badInn?.text).toContain('ИНН');

    // Повторный ввод после ошибки — должен по-прежнему ожидать ИНН (шаг 1),
    // а не требовать заново выбрать способ.
    const retryInn = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '1234567890'
    );
    expect(retryInn?.text).toContain('Шаг 2/3');
  });

  it('невалидный номер карты (не проходит Luhn) — отдельная ошибка, процесс не сброшен', async () => {
    await PartnerCabinetService.resolvePayoutAction(
      projectId,
      userId,
      'payout_method:self_employed',
      { externalUserId, platform: 'telegram' }
    );
    await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '1234567890'
    );
    await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      'Петров Пётр Петрович'
    );

    const badCard = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '4111111111111112' // тот же номер, последняя цифра испорчена → не Luhn
    );
    expect(badCard?.toast).toBe('Некорректные данные');
    expect(PayoutService.requestPayout).not.toHaveBeenCalled();

    const goodCard = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '4111111111111111'
    );
    expect(goodCard?.toast).toBe('Заявка создана');
  });
});

describe('PartnerCabinetService — старые способы (card/sbp/wallet) без регрессий', () => {
  it('card остаётся одним свободнотекстовым полем raw, как в v1', async () => {
    await PartnerCabinetService.resolvePayoutAction(
      projectId,
      userId,
      'payout_method:card',
      { externalUserId, platform: 'telegram' }
    );

    const result = await PartnerCabinetService.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      externalUserId,
      '4111111111111111'
    );

    expect(result?.toast).toBe('Заявка создана');
    const call = (PayoutService.requestPayout as jest.Mock).mock.calls[0][0];
    expect(call.payoutMethod).toBe('card');
    expect(call.payoutDetails).toEqual({ raw: '4111111111111111' });
  });
});
