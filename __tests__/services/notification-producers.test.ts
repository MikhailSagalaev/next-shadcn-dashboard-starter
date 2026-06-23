/**
 * @file: __tests__/services/notification-producers.test.ts
 * @description: Тесты STEP 2 плана 010 — проводка high-signal продьюсеров к
 *   in-app колокольчику (AdminNotificationService). Самый чистый для unit-теста
 *   путь — `PartnerTeamService.createJoinRequest`:
 *     1) после создания заявки вызывается `notifyProjectOwner` с
 *        type:'referral_join_request';
 *     2) fire-and-forget: ошибка из `notifyProjectOwner` НЕ всплывает наружу —
 *        метод всё равно резолвится, заявка создаётся.
 *   Остальные три продьюсера (payout_requested/cancelled, integration_error,
 *   subscription) проверены вручную по тому же паттерну `void ...catch(...)`.
 *
 *   Паттерн моков `@/lib/db` (auto-mock + `(mockDb as any).model = {...}`) —
 *   как в `referral-commission.service.grants.test.ts`.
 * @project: SaaS Bonus System
 */

import { PartnerTeamService } from '@/lib/services/partner-team.service';
import { AdminNotificationService } from '@/lib/services/admin-notification.service';
import { PartnerNotificationService } from '@/lib/services/partner-notification.service';
import { db } from '@/lib/db';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/admin-notification.service', () => ({
  AdminNotificationService: {
    notifyProjectOwner: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(null)
  }
}));
// createJoinRequest также дёргает партнёрское уведомление — глушим, чтобы не
// тянуть ботов в unit-тест.
jest.mock('@/lib/services/partner-notification.service', () => ({
  PartnerNotificationService: {
    notifyJoinRequestPending: jest.fn().mockResolvedValue(undefined)
  }
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyProjectOwner =
  AdminNotificationService.notifyProjectOwner as jest.Mock;

const PARAMS = {
  projectId: 'project-1',
  userId: 'user-1',
  referrerId: 'referrer-1',
  organizationId: null as string | null
};

const CREATED_REQUEST = {
  id: 'jr-1',
  projectId: PARAMS.projectId,
  userId: PARAMS.userId,
  referrerId: PARAMS.referrerId,
  organizationId: null,
  status: 'PENDING'
};

function setupDb() {
  (mockDb as any).partnerJoinRequest = {
    // нет существующей заявки → пойдём по ветке create
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(CREATED_REQUEST),
    update: jest.fn().mockResolvedValue(CREATED_REQUEST)
  };
}

describe('Notification producers — referral_join_request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifyProjectOwner.mockResolvedValue(null);
    setupDb();
  });

  it('создаёт заявку и вызывает notifyProjectOwner с type referral_join_request', async () => {
    const result = await PartnerTeamService.createJoinRequest(PARAMS);

    expect((mockDb as any).partnerJoinRequest.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(CREATED_REQUEST);

    expect(mockNotifyProjectOwner).toHaveBeenCalledTimes(1);
    const [projectIdArg, payload] = mockNotifyProjectOwner.mock.calls[0];
    expect(projectIdArg).toBe(PARAMS.projectId);
    expect(payload).toMatchObject({
      type: 'referral_join_request',
      severity: 'warning'
    });
    expect(payload.metadata).toMatchObject({
      requestId: CREATED_REQUEST.id,
      userId: PARAMS.userId,
      referrerId: PARAMS.referrerId
    });
  });

  it('fire-and-forget: ошибка notifyProjectOwner не всплывает наружу', async () => {
    mockNotifyProjectOwner.mockRejectedValueOnce(new Error('boom'));

    // Метод должен резолвиться без выброса, заявка — создаться.
    const result = await PartnerTeamService.createJoinRequest(PARAMS);

    expect(result).toEqual(CREATED_REQUEST);
    expect((mockDb as any).partnerJoinRequest.create).toHaveBeenCalledTimes(1);
    expect(mockNotifyProjectOwner).toHaveBeenCalledTimes(1);

    // Дать микротаскам отыграть отклонённый промис — отсутствие unhandled
    // rejection подтверждает, что .catch(...) на месте.
    await Promise.resolve();
  });
});
