import { db } from '@/lib/db';
import { ReferralCommissionService } from '@/lib/services/referral-commission.service';
import { PartnerReferralGraphService } from '@/lib/services/partner-referral-graph.service';

type Metadata = Record<string, unknown>;

function hasPendingReferral(metadata: unknown): boolean {
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      (metadata as Metadata).pendingReferral
  );
}

async function main() {
  const projectIdIndex = process.argv.indexOf('--project-id');
  const projectId =
    projectIdIndex >= 0 ? process.argv[projectIdIndex + 1]?.trim() : null;
  const apply = process.argv.includes('--apply');
  if (!projectId) throw new Error('Укажите --project-id <id проекта>');

  const memberships = await db.partnerOrganizationMembership.findMany({
    where: { projectId },
    select: {
      organizationId: true,
      userId: true,
      user: {
        select: {
          id: true,
          utmSource: true,
          referredBy: true,
          metadata: true,
          partnerRole: true
        }
      }
    }
  });
  const memberKeys = new Set(
    memberships.map((item) => `${item.organizationId}:${item.userId}`)
  );
  const partnerIds = new Set(
    memberships
      .filter((item) => item.user.partnerRole !== 'CLIENT')
      .map((item) => item.userId)
  );
  const existingLinks = await db.partnerReferralLink.findMany({
    where: { projectId },
    select: { organizationId: true, childUserId: true }
  });
  const linkedChildren = new Set(
    existingLinks.map((link) => `${link.organizationId}:${link.childUserId}`)
  );

  const candidates = memberships.filter((membership) => {
    const referrerId = membership.user.utmSource?.trim();
    if (!referrerId || referrerId === membership.userId) return false;
    if (
      membership.user.referredBy ||
      hasPendingReferral(membership.user.metadata)
    ) {
      return false;
    }
    if (!partnerIds.has(referrerId)) return false;
    if (!memberKeys.has(`${membership.organizationId}:${referrerId}`))
      return false;
    return !linkedChildren.has(
      `${membership.organizationId}:${membership.userId}`
    );
  });

  let linked = 0;
  if (apply) {
    for (const candidate of candidates) {
      const referrerId = candidate.user.utmSource!.trim();
      await PartnerReferralGraphService.replaceLinks({
        projectId,
        organizationId: candidate.organizationId,
        childUserId: candidate.userId,
        links: [{ referrerId, sharePercent: 100, isPrimary: true }]
      });
      await ReferralCommissionService.syncAttributionForInvitedUser({
        invitedUserId: candidate.userId,
        projectId,
        referrerId,
        organizationId: candidate.organizationId
      });
      linked += 1;
    }
  }

  console.log(
    JSON.stringify({
      projectId,
      mode: apply ? 'apply' : 'dry-run',
      candidates: candidates.length,
      linked
    })
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
