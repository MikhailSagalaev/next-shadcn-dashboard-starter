/**
 * @file: referral-commission.service.depth.test.ts
 * @description: Комиссионные планы поддерживают произвольную глубину.
 * @project: SaaS Bonus System
 */

import { ReferralCommissionService } from '@/lib/services/referral-commission.service';
import { db } from '@/lib/db';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

describe('ReferralCommissionService.createPlan (произвольная глубина)', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const projectId = 'project-1';

  let createPlanMock: jest.Mock;
  let createManyMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    createPlanMock = jest.fn().mockResolvedValue({ id: 'plan-1' });
    createManyMock = jest.fn().mockResolvedValue({ count: 0 });

    const tx = {
      referralCommissionPlan: {
        create: createPlanMock,
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'plan-1', maxPayoutDepth: 3, levels: [] })
      },
      referralCommissionPlanLevel: {
        createMany: createManyMock
      }
    };

    // $transaction вызывает наш колбэк с мок-tx
    (mockDb as any).$transaction = jest.fn((cb: any) => cb(tx));
  });

  it('сохраняет maxPayoutDepth больше 3', async () => {
    await ReferralCommissionService.createPlan(
      projectId,
      'Слишком глубокий план',
      [{ level: 1, percent: 10 }],
      6
    );

    expect(createPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxPayoutDepth: 6 })
      })
    );
  });

  it('сохраняет уровень 4 без клампа', async () => {
    await ReferralCommissionService.createPlan(
      projectId,
      'План с уровнем 4',
      [
        { level: 1, percent: 10 },
        { level: 2, percent: 5 },
        { level: 4, percent: 99 }
      ],
      3
    );

    expect(createManyMock).toHaveBeenCalledTimes(1);
    const persistedLevels = createManyMock.mock.calls[0][0].data as Array<{
      level: number;
    }>;
    const levelNumbers = persistedLevels.map((l) => l.level);

    expect(levelNumbers).toContain(4);
  });
});
