import { db } from '@/lib/db';
import { MarkingService } from '@/lib/services/marking.service';
import {
  createYooKassaReceipt,
  getMerchantYooKassaPayment,
  getYooKassaReceipt
} from '@/lib/yookassa/client';
import { getActiveYooKassaFiscalIntegration } from '@/lib/services/yookassa-fiscal-integration.service';

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
  if (status === 'succeeded') {
    await db.$transaction([
      db.fiscalReceipt.update({
        where: { id: receipt.id },
        data: { status: 'SUCCEEDED', succeededAt: new Date(), lastError: null }
      }),
      db.order.update({
        where: { id: receipt.orderId },
        data: { fiscalState: 'SETTLED', fulfillmentState: 'READY_TO_SHIP' }
      }),
      db.markedUnit.updateMany({
        where: { orderId: receipt.orderId, status: 'ASSIGNED' },
        data: { status: 'SOLD', soldAt: new Date(), receiptId: receipt.id }
      })
    ]);
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
  if (entry.type === 'CREATE_SETTLEMENT_RECEIPT') {
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
