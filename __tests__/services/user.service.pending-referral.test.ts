/**
 * @file: __tests__/services/user.service.pending-referral.test.ts
 * @description: Тесты отложенной привязки реферера до подтверждения
 *   контакта в боте. Раньше `createUser` создавал PartnerJoinRequest сразу
 *   при веб-регистрации — менеджер мог одобрить заявку до того, как
 *   заявитель вообще открыл бота, и notifyApplicantAboutJoinDecision молча
 *   не отправляла уведомление об одобрении (нет telegramId/maxId), теряя
 *   его навсегда. Теперь для WITH_BOT-проектов (где подтверждение контакта
 *   вообще происходит) createJoinRequest откладывается до
 *   resolvePendingReferralOnActivation(), вызываемой из всех трёх мест,
 *   где привязывается telegramId/maxId.
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

import { UserService } from '@/lib/services/user.service';
import { db } from '@/lib/db';
import { PartnerTeamService } from '@/lib/services/partner-team.service';
import { ReferralService } from '@/lib/services/referral.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/telegram/notifications');
jest.mock('@/lib/services/partner-team.service', () => ({
  PartnerTeamService: {
    getProjectPartnerFlags: jest.fn(),
    createJoinRequest: jest.fn().mockResolvedValue({ id: 'request-1' }),
    linkReferralWithPolicy: jest
      .fn()
      .mockResolvedValue({ linked: true, pending: false })
  }
}));
jest.mock('@/lib/services/partner-organization.service', () => ({
  PartnerOrganizationService: {
    resolveOrganizationIdForRegistration: jest.fn().mockResolvedValue(null)
  }
}));
jest.mock('@/lib/services/referral.service', () => ({
  ReferralService: {
    findReferrer: jest.fn()
  }
}));

const mockDb = db as jest.Mocked<typeof db>;
const projectId = 'project-1';
const referrerId = 'referrer-1';

function mockProject(overrides: Record<string, unknown>) {
  (mockDb as any).project = {
    findUnique: jest.fn().mockResolvedValue({
      operationMode: 'WITH_BOT',
      enablePartnerRoles: true,
      enablePartnerTeamManagement: true,
      referralJoinRequiresApproval: true,
      ...overrides
    })
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (ReferralService.findReferrer as jest.Mock).mockResolvedValue({
    id: referrerId
  });
  (PartnerTeamService.getProjectPartnerFlags as jest.Mock).mockResolvedValue({
    enablePartnerRoles: true,
    enablePartnerTeamManagement: true,
    referralJoinRequiresApproval: true
  });
});

describe('UserService.createUser — отложенная заявка (WITH_BOT + требуется одобрение)', () => {
  it('НЕ создаёт заявку сразу, а кладёт pendingReferral в metadata', async () => {
    mockProject({ operationMode: 'WITH_BOT' });
    mockDb.user.create = jest.fn().mockResolvedValue({
      id: 'user-1',
      projectId,
      metadata: { pendingReferral: { referrerId, organizationId: null } }
    });

    await UserService.createUser({
      projectId,
      email: 'trainer@example.com',
      phone: '+79001234567',
      utmSource: referrerId
    } as any);

    expect(PartnerTeamService.createJoinRequest).not.toHaveBeenCalled();

    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.isActive).toBe(false);
    expect(createCall.data.referredBy).toBeUndefined();
    expect(createCall.data.metadata).toEqual({
      pendingReferral: { referrerId, organizationId: null }
    });
  });

  it('WITHOUT_BOT (isActive=true сразу) — создаёт заявку немедленно, как раньше', async () => {
    mockProject({ operationMode: 'WITHOUT_BOT' });
    mockDb.user.create = jest.fn().mockResolvedValue({
      id: 'user-2',
      projectId
    });

    await UserService.createUser({
      projectId,
      email: 'client@example.com',
      phone: '+79007654321',
      utmSource: referrerId
    } as any);

    expect(PartnerTeamService.createJoinRequest).toHaveBeenCalledWith(
      expect.objectContaining({ projectId, userId: 'user-2', referrerId })
    );

    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.metadata?.pendingReferral).toBeUndefined();
  });

  it('referralJoinRequiresApproval выключен — привязывает реферера сразу, без заявки и без pendingReferral', async () => {
    mockProject({
      operationMode: 'WITH_BOT',
      referralJoinRequiresApproval: false
    });
    (PartnerTeamService.getProjectPartnerFlags as jest.Mock).mockResolvedValue({
      enablePartnerRoles: true,
      enablePartnerTeamManagement: true,
      referralJoinRequiresApproval: false
    });
    mockDb.user.create = jest.fn().mockResolvedValue({
      id: 'user-3',
      projectId,
      referredBy: referrerId
    });

    await UserService.createUser({
      projectId,
      email: 'direct@example.com',
      phone: '+79009998877',
      utmSource: referrerId
    } as any);

    expect(PartnerTeamService.createJoinRequest).not.toHaveBeenCalled();
    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.referredBy).toBe(referrerId);
    expect(createCall.data.metadata?.pendingReferral).toBeUndefined();
  });
});

describe('UserService.resolvePendingReferralOnActivation', () => {
  it('резолвит pendingReferral через linkReferralWithPolicy и очищает metadata', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      projectId,
      metadata: {
        utmOrg: 'blog15',
        pendingReferral: { referrerId, organizationId: 'org-1' }
      }
    });
    mockDb.user.update = jest.fn().mockResolvedValue({});

    await UserService.resolvePendingReferralOnActivation('user-1');

    expect(PartnerTeamService.linkReferralWithPolicy).toHaveBeenCalledWith({
      userId: 'user-1',
      projectId,
      referrerId,
      organizationId: 'org-1'
    });

    const updateCall = (mockDb.user.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.metadata).toEqual({ utmOrg: 'blog15' });
  });

  it('нет pendingReferral в metadata — ничего не делает (идемпотентно)', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      projectId,
      metadata: { utmOrg: 'blog15' }
    });
    mockDb.user.update = jest.fn();

    await UserService.resolvePendingReferralOnActivation('user-1');

    expect(PartnerTeamService.linkReferralWithPolicy).not.toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it('пользователь не найден — не падает', async () => {
    mockDb.user.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      UserService.resolvePendingReferralOnActivation('missing-user')
    ).resolves.toBeUndefined();
    expect(PartnerTeamService.linkReferralWithPolicy).not.toHaveBeenCalled();
  });
});
