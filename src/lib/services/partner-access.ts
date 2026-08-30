import type { PartnerRole } from '@prisma/client';

export interface PartnerAccessMembership {
  level: number | null;
  canManage: boolean;
}

export interface PartnerAccessInput<
  TMembership extends PartnerAccessMembership
> {
  enablePartnerRoles: boolean;
  partnerRole?: PartnerRole | null;
  memberships: TMembership[];
}

export interface PartnerAccess<TMembership extends PartnerAccessMembership> {
  isPartner: boolean;
  canManageOrganization: boolean;
  canUseReferralProgram: boolean;
  partnerMenuKind: 'CLIENT' | 'MEMBER' | 'MANAGER';
  partnerMemberships: TMembership[];
}

/**
 * Membership with no level and no management grant represents a customer
 * attributed to an organization. It must never unlock partner UI or actions.
 */
export function resolvePartnerAccess<
  TMembership extends PartnerAccessMembership
>(input: PartnerAccessInput<TMembership>): PartnerAccess<TMembership> {
  const partnerMemberships = input.memberships.filter(
    (membership) => membership.canManage || membership.level !== null
  );
  const canManageOrganization = partnerMemberships.some(
    (membership) => membership.canManage
  );
  const hasPartnerRole = Boolean(
    input.partnerRole && input.partnerRole !== 'CLIENT'
  );
  // In B2B the organization membership is the source of truth. A stale
  // compatibility role must not leak partner capabilities to a customer.
  const isPartner = input.enablePartnerRoles
    ? partnerMemberships.length > 0
    : hasPartnerRole || partnerMemberships.length > 0;

  return {
    isPartner,
    canManageOrganization,
    canUseReferralProgram: input.enablePartnerRoles ? isPartner : true,
    partnerMenuKind: canManageOrganization
      ? 'MANAGER'
      : isPartner
        ? 'MEMBER'
        : 'CLIENT',
    partnerMemberships
  };
}
