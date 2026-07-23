import { db } from '@/lib/db';

export class StockReservationConflictError extends Error {}

export class StockReservationService {
  static async reserveOrder(
    projectId: string,
    orderId: string,
    actorId: string
  ) {
    return db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, projectId },
        include: { items: true, markedUnits: true }
      });
      if (!order) throw new StockReservationConflictError('Заказ не найден');
      const result: Array<{ orderItemId: string; unitIds: string[] }> = [];
      for (const item of order.items) {
        if (!item.productId) continue;
        const reservationKey = `reserve:${order.id}:${item.id}`;
        const existingMovement = await tx.inventoryMovement.findUnique({
          where: { idempotencyKey: reservationKey },
          select: { id: true }
        });
        if (existingMovement) continue;
        const already = order.markedUnits.filter(
          (unit) =>
            unit.orderItemId === item.id &&
            ['RESERVED', 'ASSIGNED', 'SOLD'].includes(unit.status)
        ).length;
        const needed = Math.max(0, item.quantity - already);
        if (!needed) continue;
        const product = await tx.product.findUniqueOrThrow({
          where: { id: item.productId }
        });
        if (
          item.markingStatus !== 'MARKED_REQUIRED' &&
          product.stockOnHand - product.stockReserved < needed
        ) {
          throw new StockReservationConflictError(
            `Недостаточно остатка «${item.name}»: нужно ${needed}, доступно ${Math.max(
              0,
              product.stockOnHand - product.stockReserved
            )}`
          );
        }
        if (item.markingStatus === 'MARKED_REQUIRED') {
          const units = await tx.markedUnit.findMany({
            where: {
              projectId,
              productId: item.productId,
              gtin: item.gtin ?? undefined,
              status: 'AVAILABLE',
              orderId: null
            },
            orderBy: { availableAt: 'asc' },
            take: needed
          });
          if (units.length !== needed) {
            throw new StockReservationConflictError(
              `Недостаточно доступных маркированных упаковок «${item.name}»: нужно ${needed}, доступно ${units.length}`
            );
          }
          const ids = units.map((unit) => unit.id);
          const claimed = await tx.markedUnit.updateMany({
            where: { id: { in: ids }, status: 'AVAILABLE', orderId: null },
            data: {
              status: 'RESERVED',
              orderId,
              orderItemId: item.id,
              reservedAt: new Date()
            }
          });
          if (claimed.count !== ids.length) {
            throw new StockReservationConflictError(
              'Одна из упаковок уже зарезервирована другим заказом. Повторите операцию.'
            );
          }
          await tx.stockUnitEvent.createMany({
            data: units.map((unit) => ({
              projectId,
              markedUnitId: unit.id,
              productId: unit.productId,
              orderId,
              fromStatus: 'AVAILABLE' as const,
              toStatus: 'RESERVED' as const,
              reason: `Резерв заказа ${order.orderNumber}`,
              actorId
            }))
          });
          result.push({ orderItemId: item.id, unitIds: ids });
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stockReserved: { increment: needed } }
        });
        await tx.inventoryMovement.create({
          data: {
            projectId,
            productId: item.productId,
            orderId,
            type: 'RESERVE',
            quantity: needed,
            reason: `Резерв заказа ${order.orderNumber}`,
            idempotencyKey: reservationKey,
            createdBy: actorId
          }
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentState: 'PICKING' }
      });
      return result;
    });
  }

  static async releaseOrder(
    projectId: string,
    orderId: string,
    actorId: string
  ) {
    return db.$transaction(async (tx) => {
      const units = await tx.markedUnit.findMany({
        where: { projectId, orderId, status: 'RESERVED' }
      });
      for (const unit of units) {
        await tx.markedUnit.update({
          where: { id: unit.id },
          data: {
            status: 'AVAILABLE',
            orderId: null,
            orderItemId: null,
            reservedAt: null
          }
        });
        if (unit.productId) {
          await tx.product.update({
            where: { id: unit.productId },
            data: { stockReserved: { decrement: 1 } }
          });
        }
        await tx.stockUnitEvent.create({
          data: {
            projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            orderId,
            fromStatus: 'RESERVED',
            toStatus: 'AVAILABLE',
            reason: 'Резерв заказа снят',
            actorId
          }
        });
      }
      return { released: units.length };
    });
  }
}
