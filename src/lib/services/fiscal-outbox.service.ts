import { db } from '@/lib/db';
import { MarkingService } from '@/lib/services/marking.service';
import {
  createYooKassaRefund,
  createYooKassaReceipt,
  getMerchantYooKassaPayment,
  getYooKassaRefund,
  getYooKassaReceipt
} from '@/lib/yookassa/client';
import { getActiveYooKassaFiscalIntegration } from '@/lib/services/yookassa-fiscal-integration.service';
import { RefundService } from '@/lib/services/refund.service';

const MAX_ATTEMPTS = 10;

function retryAt(attempt: number): Date {
  const seconds = Math.min(3600, 15 * 2 ** Math.min(attempt, 8));
  return new Date(Date.now() + seconds * 1000);
}

async function fail(entryId: string, attempt: number, message: string) {
  const exhausted = attempt >= MAX_ATTEMPTS;
  await db.fiscalOutbox.update({
    where: { id: entryId },
    data: {
      status: exhausted ? 'FAILED' : 'PENDING',
      attemptCount: attempt,
      nextAttemptAt: retryAt(attempt),
      lockedAt: null,
      lastError: message
    }
  });
  return exhausted;
}

async function applyReceiptStatus(receiptId: string, status: string) {
  const receipt = await db.fiscalReceipt.findUniqueOrThrow({
    where: { id: receiptId }
  });
  if (receipt.type === 'REFUND') {
    await RefundService.applyStatus(receiptId, status);
    return;
  }
  if (status === 'succeeded') {
    if (receipt.status === 'SUCCEEDED' && receipt.succeededAt) return;
    await db.$transaction(async (tx) => {
      const units = await tx.markedUnit.findMany({
        where: { orderId: receipt.orderId, status: 'ASSIGNED' }
      });
      await tx.fiscalReceipt.update({
        where: { id: receipt.id },
        data: { status: 'SUCCEEDED', succeededAt: new Date(), lastError: null }
      });
      await tx.order.update({
        where: { id: receipt.orderId },
        data: { fiscalState: 'SETTLED', fulfillmentState: 'READY_TO_SHIP' }
      });
      await tx.markedUnit.updateMany({
        where: { orderId: receipt.orderId, status: 'ASSIGNED' },
        data: { status: 'SOLD', soldAt: new Date(), receiptId: receipt.id }
      });
      const stockUnits = units.filter(
        (unit) => unit.goodsReceiptItemId && unit.productId
      );
      for (const productId of new Set(
        stockUnits.map((unit) => unit.productId!)
      )) {
        const quantity = stockUnits.filter(
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
            idempotencyKey: `sale:${receipt.id}:${productId}`
          },
          create: {
            projectId: receipt.projectId,
            productId,
            orderId: receipt.orderId,
            type: 'SALE',
            quantity: -quantity,
            balanceAfter: product.stockOnHand,
            reason: 'Успешный чек полного расчёта',
            idempotencyKey: `sale:${receipt.id}:${productId}`
          },
          update: {}
        });
      }
      if (units.length) {
        await tx.stockUnitEvent.createMany({
          data: units.map((unit) => ({
            projectId: receipt.projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            orderId: receipt.orderId,
            fromStatus: 'ASSIGNED' as const,
            toStatus: 'SOLD' as const,
            reason: 'Успешный чек полного расчёта'
          }))
        });
      }
    });
  } else if (status === 'canceled') {
    await db.$transaction([
      db.fiscalReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'CANCELED',
          lastError: 'ЮKassa отменила регистрацию чека'
        }
      }),
      db.order.update({
        where: { id: receipt.orderId },
        data: { fiscalState: 'FAILED' }
      })
    ]);
  } else {
    await db.fiscalReceipt.update({
      where: { id: receipt.id },
      data: { status: 'PENDING' }
    });
  }
}

async function processEntry(entry: {
  id: string;
  projectId: string;
  receiptId: string | null;
  type: string;
  idempotencyKey: string;
  attemptCount: number;
}) {
  if (!entry.receiptId) throw new Error('Outbox entry has no receipt');
  const { credentials } = await getActiveYooKassaFiscalIntegration(
    entry.projectId
  );
  if (entry.type === 'CREATE_REFUND') {
    const payload = await RefundService.buildPayload(entry.receiptId);
    const response = await createYooKassaRefund(
      payload,
      entry.idempotencyKey,
      credentials
    );
    if ('status' in response) {
      throw new Error(`ЮKassa ${response.status}: ${response.body}`);
    }
    await db.fiscalReceipt.update({
      where: { id: entry.receiptId },
      data: {
        providerRefundId: response.data.id,
        status:
          response.data.status === 'succeeded'
            ? 'SUCCEEDED'
            : response.data.status === 'canceled'
              ? 'CANCELED'
              : 'PENDING',
        responsePayload: JSON.parse(JSON.stringify(response.data)),
        submittedAt: new Date(),
        attemptCount: { increment: 1 }
      }
    });
    await applyReceiptStatus(entry.receiptId, response.data.status);
    if (response.data.status === 'pending') {
      const receipt = await db.fiscalReceipt.findUniqueOrThrow({
        where: { id: entry.receiptId }
      });
      await db.fiscalOutbox.upsert({
        where: { idempotencyKey: `sync-refund:${entry.receiptId}` },
        create: {
          projectId: receipt.projectId,
          orderId: receipt.orderId,
          receiptId: receipt.id,
          type: 'SYNC_REFUND',
          idempotencyKey: `sync-refund:${entry.receiptId}`,
          payload: { receiptId: receipt.id },
          nextAttemptAt: new Date(Date.now() + 30_000)
        },
        update: {
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() + 30_000)
        }
      });
    }
  } else if (entry.type === 'SYNC_REFUND') {
    const receipt = await db.fiscalReceipt.findUniqueOrThrow({
      where: { id: entry.receiptId }
    });
    if (!receipt.providerRefundId)
      throw new Error('Provider refund id missing');
    const response = await getYooKassaRefund(
      receipt.providerRefundId,
      credentials
    );
    if ('status' in response) {
      throw new Error(`ЮKassa ${response.status}: ${response.body}`);
    }
    await applyReceiptStatus(receipt.id, response.data.status);
    if (response.data.status === 'pending') {
      await db.fiscalOutbox.update({
        where: { id: entry.id },
        data: {
          status: 'PENDING',
          attemptCount: { increment: 1 },
          nextAttemptAt: retryAt(entry.attemptCount + 1),
          lockedAt: null
        }
      });
      return false;
    }
  } else if (entry.type === 'CREATE_SETTLEMENT_RECEIPT') {
    const payload = await MarkingService.buildSettlementPayload(
      entry.receiptId
    );
    if (!payload.payment_id) throw new Error('YooKassa payment id missing');
    const payment = await getMerchantYooKassaPayment(
      payload.payment_id,
      credentials
    );
    if ('status' in payment) {
      throw new Error(
        `Платёж не найден в ЮKassa этого проекта (${payment.status})`
      );
    }
    const expectedAmount = payload.settlements?.[0]?.amount;
    if (
      payment.data.status !== 'succeeded' ||
      payment.data.paid === false ||
      !expectedAmount ||
      payment.data.amount.currency !== expectedAmount.currency ||
      Math.round(Number(payment.data.amount.value) * 100) !==
        Math.round(Number(expectedAmount.value) * 100)
    ) {
      throw new Error(
        'Платёж ЮKassa проекта не завершён или его сумма не совпадает с заказом'
      );
    }
    const response = await createYooKassaReceipt(
      payload,
      entry.idempotencyKey,
      credentials
    );
    if ('status' in response) {
      throw new Error(`ЮKassa ${response.status}: ${response.body}`);
    }
    await db.fiscalReceipt.update({
      where: { id: entry.receiptId },
      data: {
        providerReceiptId: response.data.id,
        status:
          response.data.status === 'succeeded'
            ? 'SUCCEEDED'
            : response.data.status === 'canceled'
              ? 'CANCELED'
              : 'PENDING',
        responsePayload: {
          id: response.data.id,
          status: response.data.status,
          paymentId: response.data.payment_id
        },
        submittedAt: new Date(),
        attemptCount: { increment: 1 }
      }
    });
    await applyReceiptStatus(entry.receiptId, response.data.status);
    if (response.data.status === 'pending') {
      await db.fiscalOutbox.upsert({
        where: { idempotencyKey: `sync:${entry.receiptId}` },
        create: {
          projectId: (
            await db.fiscalReceipt.findUniqueOrThrow({
              where: { id: entry.receiptId }
            })
          ).projectId,
          orderId: (
            await db.fiscalReceipt.findUniqueOrThrow({
              where: { id: entry.receiptId }
            })
          ).orderId,
          receiptId: entry.receiptId,
          type: 'SYNC_RECEIPT',
          idempotencyKey: `sync:${entry.receiptId}`,
          payload: { receiptId: entry.receiptId },
          nextAttemptAt: new Date(Date.now() + 30_000)
        },
        update: {
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() + 30_000)
        }
      });
    }
  } else if (entry.type === 'SYNC_RECEIPT') {
    const receipt = await db.fiscalReceipt.findUniqueOrThrow({
      where: { id: entry.receiptId }
    });
    if (!receipt.providerReceiptId)
      throw new Error('Provider receipt id missing');
    const response = await getYooKassaReceipt(
      receipt.providerReceiptId,
      credentials
    );
    if ('status' in response) {
      throw new Error(`ЮKassa ${response.status}: ${response.body}`);
    }
    await applyReceiptStatus(receipt.id, response.data.status);
    if (response.data.status === 'pending') {
      await db.fiscalOutbox.update({
        where: { id: entry.id },
        data: {
          status: 'PENDING',
          attemptCount: { increment: 1 },
          nextAttemptAt: retryAt(entry.attemptCount + 1),
          lockedAt: null
        }
      });
      return false;
    }
  } else {
    throw new Error(`Unknown fiscal outbox type: ${entry.type}`);
  }
  return true;
}

export async function processFiscalOutboxBatch(limit = 20): Promise<number> {
  await db.fiscalOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }
    },
    data: {
      status: 'PENDING',
      lockedAt: null,
      lastError: 'Задание восстановлено после остановки worker'
    }
  });
  const entries = await db.fiscalOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      projectId: true,
      receiptId: true,
      type: true,
      idempotencyKey: true,
      attemptCount: true
    }
  });
  let processed = 0;
  for (const entry of entries) {
    const claimed = await db.fiscalOutbox.updateMany({
      where: { id: entry.id, status: 'PENDING' },
      data: { status: 'PROCESSING', lockedAt: new Date() }
    });
    if (!claimed.count) continue;
    try {
      const completed = await processEntry(entry);
      if (completed) {
        await db.fiscalOutbox.update({
          where: { id: entry.id },
          data: { status: 'COMPLETED', lockedAt: null, lastError: null }
        });
      }
      processed += 1;
    } catch (error) {
      const attempt = entry.attemptCount + 1;
      const message =
        error instanceof Error ? error.message : 'Unknown fiscal worker error';
      const exhausted = await fail(entry.id, attempt, message);
      if (entry.receiptId) {
        const receipt = await db.fiscalReceipt.update({
          where: { id: entry.receiptId },
          data: {
            status: exhausted ? 'FAILED' : 'PENDING',
            lastError: message,
            attemptCount: { increment: 1 }
          },
          select: { orderId: true }
        });
        if (exhausted) {
          await db.order.update({
            where: { id: receipt.orderId },
            data: { fiscalState: 'FAILED' }
          });
        }
      }
    }
  }
  return processed;
}
