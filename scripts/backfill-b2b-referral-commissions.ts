/**
 * Idempotently restores B2B referral commissions for already-accounted paid orders.
 *
 * Dry-run is the default:
 *   npx tsx scripts/backfill-b2b-referral-commissions.ts --project-id=<id>
 *
 * Apply:
 *   npx tsx scripts/backfill-b2b-referral-commissions.ts --project-id=<id> --apply
 */

import { db } from '@/lib/db';
import { ReferralService } from '@/lib/services/referral.service';

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main() {
  const projectId = readArgument('project-id');
  const apply = process.argv.includes('--apply');

  if (!projectId) {
    throw new Error('--project-id is required');
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, referralPlansEnabled: true }
  });
  if (!project) throw new Error('Project not found');
  if (!project.referralPlansEnabled) {
    throw new Error('B2B referral plans are disabled for this project');
  }

  const orders = await db.order.findMany({
    where: {
      projectId,
      userId: { not: null },
      paymentStatus: 'PAID',
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
      accountingState: { in: ['APPLIED', 'LEGACY'] }
    },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      orderNumber: true,
      userId: true,
      totalAmount: true,
      paidAmount: true,
      accountedPurchaseAmount: true,
      user: {
        select: {
          referralAttribution: {
            select: { id: true }
          }
        }
      }
    }
  });

  const eligible = orders
    .filter((order) => Boolean(order.user?.referralAttribution))
    .map((order) => ({
      orderNumber: order.orderNumber,
      userId: order.userId as string,
      purchaseAmount:
        Number(order.accountedPurchaseAmount) ||
        Number(order.paidAmount) ||
        Number(order.totalAmount)
    }))
    .filter((order) => order.purchaseAmount > 0);

  const existing = await db.transaction.findMany({
    where: {
      isReferralBonus: true,
      type: 'EARN',
      externalId: { not: null },
      user: { projectId }
    },
    select: { externalId: true }
  });
  const existingOrderNumbers = new Set(
    existing
      .map(
        (entry) => entry.externalId?.match(/^referral_(.+)_[^_]+_L\d+$/)?.[1]
      )
      .filter((value): value is string => Boolean(value))
  );

  const pending = eligible.filter(
    (order) => !existingOrderNumbers.has(order.orderNumber)
  );
  const purchaseTotal = pending.reduce(
    (sum, order) => sum + order.purchaseAmount,
    0
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        projectId: project.id,
        projectName: project.name,
        eligibleOrders: eligible.length,
        alreadyPaidOrders: eligible.length - pending.length,
        pendingOrders: pending.length,
        pendingPurchaseTotal: purchaseTotal
      },
      null,
      2
    )
  );

  if (!apply || eligible.length === 0) return;

  let paidOrders = 0;
  let paidAmount = 0;
  let skippedOrders = 0;

  // Re-run every eligible order: deterministic external IDs skip completed payouts
  // and allow a previously interrupted multi-level chain to finish.
  for (const order of eligible) {
    const result = await ReferralService.processReferralBonus(
      order.userId,
      order.purchaseAmount,
      order.orderNumber
    );
    if (result.bonusAwarded) {
      paidOrders += 1;
      paidAmount += result.totalBonus ?? 0;
    } else {
      skippedOrders += 1;
    }
  }

  console.log(
    JSON.stringify({ paidOrders, paidAmount, skippedOrders }, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
