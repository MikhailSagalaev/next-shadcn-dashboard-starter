import { db } from '@/lib/db';

type Metadata = Record<string, unknown>;

function readPendingOrganizationId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const pending = (metadata as Metadata).pendingReferral;
  if (!pending || typeof pending !== 'object') return null;
  const organizationId = (pending as Metadata).organizationId;
  return typeof organizationId === 'string' && organizationId.trim()
    ? organizationId
    : null;
}

async function main() {
  const projectIdIndex = process.argv.indexOf('--project-id');
  const projectId =
    projectIdIndex >= 0 ? process.argv[projectIdIndex + 1]?.trim() : null;
  if (!projectId) {
    throw new Error('Укажите --project-id <id проекта>');
  }

  const [organizations, users, existingMemberships] = await Promise.all([
    db.partnerOrganization.findMany({
      where: { projectId },
      select: { id: true }
    }),
    db.user.findMany({
      where: { projectId },
      select: { id: true, organizationId: true, metadata: true }
    }),
    db.partnerOrganizationMembership.findMany({
      where: { projectId },
      select: { organizationId: true, userId: true }
    })
  ]);
  const organizationIds = new Set(
    organizations.map((organization) => organization.id)
  );
  const membershipKeys = new Set(
    existingMemberships.map(
      (membership) => `${membership.organizationId}:${membership.userId}`
    )
  );
  let membershipsCreated = 0;
  let primaryOrganizationsFilled = 0;
  let skippedConflicts = 0;

  for (const user of users) {
    const pendingOrganizationId = readPendingOrganizationId(user.metadata);
    const targetOrganizationId = user.organizationId ?? pendingOrganizationId;
    if (!targetOrganizationId || !organizationIds.has(targetOrganizationId)) {
      continue;
    }
    if (
      user.organizationId &&
      pendingOrganizationId &&
      user.organizationId !== pendingOrganizationId
    ) {
      skippedConflicts += 1;
      continue;
    }

    const membershipKey = `${targetOrganizationId}:${user.id}`;
    await db.$transaction(async (tx) => {
      if (!user.organizationId && pendingOrganizationId) {
        await tx.user.update({
          where: { id: user.id },
          data: { organizationId: pendingOrganizationId }
        });
      }
      await tx.partnerOrganizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: targetOrganizationId,
            userId: user.id
          }
        },
        update: {},
        create: {
          projectId,
          organizationId: targetOrganizationId,
          userId: user.id,
          level: null,
          canManage: false
        }
      });
    });
    if (!membershipKeys.has(membershipKey)) {
      membershipsCreated += 1;
      membershipKeys.add(membershipKey);
    }
    if (!user.organizationId && pendingOrganizationId) {
      primaryOrganizationsFilled += 1;
    }
  }

  console.log(
    JSON.stringify({
      projectId,
      membershipsCreated,
      primaryOrganizationsFilled,
      skippedConflicts
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
