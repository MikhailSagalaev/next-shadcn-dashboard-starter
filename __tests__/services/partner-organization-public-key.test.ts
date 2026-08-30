import { db } from '@/lib/db';
import { PartnerOrganizationService } from '@/lib/services/partner-organization.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

describe('PartnerOrganizationService public attribution key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(db, 'partnerOrganization', {
      configurable: true,
      value: { findFirst: jest.fn() }
    });
  });

  it('resolves both stable ids and legacy slugs for active organizations', async () => {
    (db.partnerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: 'organization-id'
    });

    await expect(
      PartnerOrganizationService.resolveOrganizationIdForRegistration({
        projectId: 'project-id',
        utmOrgSlug: 'Organization-ID'
      })
    ).resolves.toBe('organization-id');

    expect(db.partnerOrganization.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-id',
        isActive: true,
        OR: [{ id: 'Organization-ID' }, { slug: 'organization-id' }]
      }
    });
  });
});
