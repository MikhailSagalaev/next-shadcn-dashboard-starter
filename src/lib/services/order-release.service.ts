import { db } from '@/lib/db';

export class OrderReleaseConflictError extends Error {}

export class OrderReleaseService {
  static async reconcile(projectId: string, orderId: string) {
    return db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, projectId },
        include: {
          markedUnits: {
            where: { status: { in: ['ASSIGNED', 'RESERVED'] } }
          },
          fiscalReceipts: {
            where: { type: 'SETTLEMENT', status: 'SUCCEEDED' }
          },
          complianceDocuments: {
            where: { kind: 'DISTANCE_SALE', status: 'SUCCEEDED' }
          }
        }
      });
      if (!order) throw new OrderReleaseConflictError('Заказ не найден');

      const fiscalReady = order.fiscalReceipts.length > 0;
      const withdrawalReady =
        order.withdrawalState === 'NOT_REQUIRED' ||
        (order.withdrawalMode === 'KKT_MARKED_RECEIPT' &&
          fiscalReady &&
          order.fiscalReceipts.some((receipt) => receipt.includesMarkCodes)) ||
        (order.withdrawalMode === 'GIS_MT_DISTANCE_SALE' &&
          order.complianceDocuments.length > 0);
      if (
        order.paymentStatus !== 'PAID' ||
        !['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState) ||
        !fiscalReady ||
        !withdrawalReady
      ) {
        return { released: false, order };
      }

      const units = order.markedUnits;
      if (order.fulfillmentState === 'READY_TO_SHIP' && units.length === 0) {
        return { released: false, order };
      }
      if (units.length) {
        const claimed = await tx.markedUnit.updateMany({
          where: {
            id: { in: units.map((unit) => unit.id) },
            status: { in: ['ASSIGNED', 'RESERVED'] }
          },
          data: { status: 'SOLD', soldAt: new Date() }
        });
        if (claimed.count !== units.length) {
          return { released: false, order };
        }
      }
      for (const productId of new Set(
        units.map((unit) => unit.productId).filter(Boolean) as string[]
      )) {
        const quantity = units.filter(
          (unit) => unit.productId === productId
        ).length;
        const current = await tx.product.findUniqueOrThrow({
          where: { id: productId }
        });
        const product = await tx.product.update({
          where: { id: productId },
          data: {
            stockOnHand: Math.max(0, current.stockOnHand - quantity),
            stockReserved: Math.max(0, current.stockReserved - quantity)
          }
        });
        await tx.inventoryMovement.upsert({
          where: {
            idempotencyKey: `sale:${order.id}:${productId}`
          },
          create: {
            projectId,
            productId,
            orderId: order.id,
            type: 'SALE',
            quantity: -quantity,
            balanceAfter: product.stockOnHand,
            reason:
              'Продажа подтверждена фискально и в выбранном канале маркировки',
            idempotencyKey: `sale:${order.id}:${productId}`
          },
          update: {}
        });
      }
      if (units.length) {
        await tx.stockUnitEvent.createMany({
          data: units.map((unit) => ({
            projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            orderId: order.id,
            fromStatus: unit.status,
            toStatus: 'SOLD' as const,
            reason:
              'Оплата, чек и выбранный способ вывода из оборота подтверждены'
          })),
          skipDuplicates: true
        });
      }
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          fiscalState: 'SETTLED',
          withdrawalState:
            order.withdrawalState === 'NOT_REQUIRED'
              ? 'NOT_REQUIRED'
              : 'SUCCEEDED',
          fulfillmentState: 'READY_TO_SHIP'
        }
      });
      return { released: true, order: updated };
    });
  }
}
