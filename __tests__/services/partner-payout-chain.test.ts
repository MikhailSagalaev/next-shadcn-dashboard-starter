/**
 * @file: partner-payout-chain.test.ts
 * @description: План 005 — детерминированная маршрутизация выплат по явной
 *   ссылке partnerParentId. Доказываем, что эвристика «первый менеджер по дате»
 *   убрана: с двумя менеджерами в организации деньги идут ИМЕННО привязанному.
 * @project: SaaS Bonus System
 */

import { PartnerTeamService } from '@/lib/services/partner-team.service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

type Node = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  referredBy: string | null;
  partnerParentId: string | null;
  partnerRole: 'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR';
  organizationId: string | null;
};

const mockDb = db as jest.Mocked<typeof db>;
const projectId = 'project-1';

function node(partial: Partial<Node> & { id: string }): Node {
  return {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    referredBy: null,
    partnerParentId: null,
    partnerRole: 'TRAINER',
    organizationId: 'org-1',
    ...partial
  };
}

function wireDb(nodes: Node[], enablePartnerRoles = true) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  (mockDb as any).project = {
    findUnique: jest.fn().mockResolvedValue({ enablePartnerRoles })
  };
  mockDb.user.findFirst = jest
    .fn()
    .mockImplementation(async ({ where }: any) => byId.get(where.id) ?? null);
}

describe('PartnerTeamService.resolvePayoutChain (план 005: явные ссылки)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('линейная цепочка тренер→менеджер→директор по partnerParentId', async () => {
    wireDb([
      node({ id: 't', partnerRole: 'TRAINER', partnerParentId: 'm' }),
      node({ id: 'm', partnerRole: 'MANAGER', partnerParentId: 'd' }),
      node({ id: 'd', partnerRole: 'DIRECTOR' })
    ]);

    const chain = await PartnerTeamService.resolvePayoutChain(
      't',
      projectId,
      3
    );

    expect(chain.map((c) => c.id)).toEqual(['t', 'm', 'd']);
  });

  it('два менеджера в организации: тренер привязан к B → платим B, не A', async () => {
    // mgrA зарегистрирован раньше — старая эвристика выбрала бы его.
    wireDb([
      node({ id: 't', partnerRole: 'TRAINER', partnerParentId: 'mgrB' }),
      node({ id: 'mgrA', partnerRole: 'MANAGER', partnerParentId: 'd' }),
      node({ id: 'mgrB', partnerRole: 'MANAGER', partnerParentId: 'd' }),
      node({ id: 'd', partnerRole: 'DIRECTOR' })
    ]);

    const chain = await PartnerTeamService.resolvePayoutChain(
      't',
      projectId,
      3
    );
    const ids = chain.map((c) => c.id);

    expect(ids).toContain('mgrB');
    expect(ids).not.toContain('mgrA');
    expect(ids).toEqual(['t', 'mgrB', 'd']);
  });

  it('оборванная ссылка: цепочка стопается и логирует warn, не платит чужому', async () => {
    wireDb([
      // тренер без partnerParentId и без referredBy — родитель не задан
      node({
        id: 't',
        partnerRole: 'TRAINER',
        partnerParentId: null,
        referredBy: null
      }),
      // посторонний менеджер в той же организации — его НЕ должны выбрать
      node({ id: 'mgrX', partnerRole: 'MANAGER', partnerParentId: 'd' })
    ]);

    const chain = await PartnerTeamService.resolvePayoutChain(
      't',
      projectId,
      3
    );

    expect(chain.map((c) => c.id)).toEqual(['t']);
    expect(chain.map((c) => c.id)).not.toContain('mgrX');
    expect(logger.warn as jest.Mock).toHaveBeenCalledWith(
      'payout chain broken: missing parent link',
      expect.objectContaining({ userId: 't', partnerRole: 'TRAINER' })
    );
  });

  it('referredBy как graceful fallback, пока backfill не прошёл', async () => {
    wireDb([
      node({
        id: 't',
        partnerRole: 'TRAINER',
        partnerParentId: null,
        referredBy: 'm'
      }),
      node({ id: 'm', partnerRole: 'MANAGER', partnerParentId: 'd' }),
      node({ id: 'd', partnerRole: 'DIRECTOR' })
    ]);

    const chain = await PartnerTeamService.resolvePayoutChain(
      't',
      projectId,
      3
    );

    expect(chain.map((c) => c.id)).toEqual(['t', 'm', 'd']);
  });
});
