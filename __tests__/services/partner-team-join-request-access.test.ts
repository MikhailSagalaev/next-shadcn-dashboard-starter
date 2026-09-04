import { db } from '@/lib/db';
import { PartnerTeamService } from '@/lib/services/partner-team.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

const mockDb = db as jest.Mocked<typeof db>;
const projectId = 'project-1';
const organizationId = 'organization-1';

function setupUsers() {
  const users = new Map([
    [
      'referrer',
      {
        partnerRole: 'MANAGER',
        organizationId,
        referredBy: 'director'
      }
    ],
    [
      'other-partner',
      {
        partnerRole: 'TRAINER',
        organizationId,
        referredBy: 'director'
      }
    ],
    [
      'manager',
      {
        partnerRole: 'DIRECTOR',
        organizationId,
        referredBy: null
      }
    ],
    [
      'client-referrer',
      {
        partnerRole: 'CLIENT',
        organizationId,
        referredBy: 'referrer'
      }
    ]
  ]);

  mockDb.user.findFirst = jest.fn().mockImplementation(async ({ where }) => {
    if (where.projectId !== projectId || where.isActive !== true) return null;
    return users.get(where.id) ?? null;
  });
}

function setupMemberships() {
  const memberships = new Map([
    ['referrer', { level: 2, canManage: false }],
    ['other-partner', { level: 1, canManage: false }],
    ['manager', { level: null, canManage: true }],
    ['client-referrer', { level: null, canManage: false }]
  ]);

  Object.defineProperty(mockDb, 'partnerOrganizationMembership', {
    configurable: true,
    value: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const key = where.organizationId_userId;
        if (key.organizationId !== organizationId) return null;
        return memberships.get(key.userId) ?? null;
      })
    }
  });
}

describe('PartnerTeamService.canReviewJoinRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.project.findUnique = jest.fn().mockResolvedValue({
      enablePartnerRoles: true,
      enablePartnerTeamManagement: true,
      referralJoinRequiresApproval: true
    });
    setupUsers();
    setupMemberships();
  });

  it('allows an organization partner to review a request addressed to them', async () => {
    await expect(
      PartnerTeamService.canReviewJoinRequest(
        projectId,
        'referrer',
        'referrer',
        organizationId
      )
    ).resolves.toBe(true);
  });

  it('does not allow an ordinary partner to review another partner request', async () => {
    await expect(
      PartnerTeamService.canReviewJoinRequest(
        projectId,
        'other-partner',
        'referrer',
        organizationId
      )
    ).resolves.toBe(false);
  });

  it('allows an organization manager to review another partner request', async () => {
    await expect(
      PartnerTeamService.canReviewJoinRequest(
        projectId,
        'manager',
        'referrer',
        organizationId
      )
    ).resolves.toBe(true);
  });

  it('does not let a client approve a request even when named as referrer', async () => {
    await expect(
      PartnerTeamService.canReviewJoinRequest(
        projectId,
        'client-referrer',
        'client-referrer',
        organizationId
      )
    ).resolves.toBe(false);
  });
});
