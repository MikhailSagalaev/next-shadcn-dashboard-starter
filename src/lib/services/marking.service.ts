import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import {
  decryptMarkCode,
  encryptMarkCode,
  hashMarkCode
} from '@/lib/marking/code-crypto';
import { markCodeToGs1m, parseGs1DataMatrix } from '@/lib/marking/gs1';
import type {
  YooKassaCreateReceiptPayload,
  YooKassaMeasure,
  YooKassaPaymentSubject,
  YooKassaReceiptItem,
  YooKassaVatCode
} from '@/lib/yookassa/types';
import {
  getActiveYooKassaFiscalIntegration,
  YooKassaFiscalConfigurationError
} from '@/lib/services/yookassa-fiscal-integration.service';

export class MarkingConflictError extends Error {}

function money(value: number): string {
  return value.toFixed(2);
}

function splitCents(total: number, quantity: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / quantity);
  const remainder = cents - base * quantity;
  return Array.from(
    { length: quantity },
    (_, index) => base + (index < remainder ? 1 : 0)
  );
}

export class MarkingService {
  static async assignCode(params: {
    projectId: string;
    orderId: string;
    orderItemId: string;
    code: string;
    scannedBy: string;
  }) {
    const parsed = parseGs1DataMatrix(params.code);
    const codeHash = hashMarkCode(parsed.raw);
    return db.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: params.orderItemId,
          orderId: params.orderId,
          order: { projectId: params.projectId }
        },
        include: { order: true }
      });
      if (!item) throw new MarkingConflictError('Позиция заказа не найдена');
      if (item.markingStatus !== 'MARKED_REQUIRED') {
        throw new MarkingConflictError(
          'Для этой позиции Data Matrix не требуется'
        );
      }
      if (!item.gtin)
        throw new MarkingConflictError('Для товара не настроен GTIN');
      if (item.gtin !== parsed.gtin) {
        throw new MarkingConflictError(
          `GTIN кода ${parsed.gtin} не совпадает с товаром ${item.gtin}`
        );
      }
      const assigned = await tx.markedUnit.count({
        where: {
          orderItemId: item.id,
          status: { in: ['SCANNED', 'ASSIGNED', 'SOLD'] }
        }
      });
      if (assigned >= item.quantity) {
        throw new MarkingConflictError(
          'Все единицы этой позиции уже отсканированы'
        );
      }
      const duplicate = await tx.markedUnit.findUnique({ where: { codeHash } });
      if (duplicate) throw new MarkingConflictError('Этот код уже использован');

      const unit = await tx.markedUnit.create({
        data: {
          projectId: params.projectId,
          orderId: params.orderId,
          orderItemId: item.id,
          productId: item.productId,
          codeHash,
          codeEncrypted: encryptMarkCode(parsed.raw),
          gtin: parsed.gtin,
          serial: parsed.serial,
          status: 'ASSIGNED',
          scannedBy: params.scannedBy
        }
      });
      await this.refreshMarkingState(tx, params.orderId);
      return { ...unit, codeEncrypted: undefined, codeHash: undefined };
    });
  }

  static async removeCode(params: {
    projectId: string;
    orderId: string;
    unitId: string;
  }) {
    return db.$transaction(async (tx) => {
      const unit = await tx.markedUnit.findFirst({
        where: {
          id: params.unitId,
          orderId: params.orderId,
          projectId: params.projectId
        }
      });
      if (!unit)
        throw new MarkingConflictError('Отсканированный код не найден');
      if (unit.status === 'SOLD' || unit.receiptId) {
        throw new MarkingConflictError(
          'Код уже передан в чек и не может быть удалён'
        );
      }
      await tx.markedUnit.delete({ where: { id: unit.id } });
      await this.refreshMarkingState(tx, params.orderId);
    });
  }

  private static async refreshMarkingState(
    tx: Prisma.TransactionClient,
    orderId: string
  ) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: {
        _count: {
          select: {
            markedUnits: {
              where: { status: { in: ['SCANNED', 'ASSIGNED', 'SOLD'] } }
            }
          }
        }
      }
    });
    if (items.some((item) => item.markingStatus === 'UNKNOWN')) {
      await tx.order.update({
        where: { id: orderId },
        data: { markingState: 'UNCONFIGURED' }
      });
      return;
    }
    const required = items.filter(
      (item) => item.markingStatus === 'MARKED_REQUIRED'
    );
    const scanned = required.reduce(
      (sum, item) => sum + item._count.markedUnits,
      0
    );
    const expected = required.reduce((sum, item) => sum + item.quantity, 0);
    const markingState =
      expected === 0
        ? 'NOT_REQUIRED'
        : scanned === 0
          ? 'PENDING'
          : scanned < expected
            ? 'PARTIAL'
            : 'COMPLETE';
    await tx.order.update({ where: { id: orderId }, data: { markingState } });
  }

  static async queueSettlement(params: { projectId: string; orderId: string }) {
    try {
      await getActiveYooKassaFiscalIntegration(params.projectId);
    } catch (error) {
      if (error instanceof YooKassaFiscalConfigurationError) {
        throw new MarkingConflictError(error.message);
      }
      throw error;
    }
    const order = await db.order.findFirst({
      where: { id: params.orderId, projectId: params.projectId },
      include: { fiscalReceipts: true }
    });
    if (!order) throw new MarkingConflictError('Заказ не найден');
    if (order.paymentStatus !== 'PAID' || !order.providerPaymentId) {
      throw new MarkingConflictError(
        'У заказа нет подтверждённого платежа ЮKassa'
      );
    }
    if (!['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState)) {
      throw new MarkingConflictError(
        'Сначала завершите маркировку всех позиций'
      );
    }
    const existing = order.fiscalReceipts.find(
      (receipt) =>
        receipt.type === 'SETTLEMENT' && receipt.status !== 'CANCELED'
    );
    if (existing && existing.status !== 'FAILED') return existing;
    if (existing?.status === 'FAILED') {
      return db.$transaction(async (tx) => {
        const receipt = await tx.fiscalReceipt.update({
          where: { id: existing.id },
          data: { status: 'NEW', lastError: null }
        });
        await tx.fiscalOutbox.upsert({
          where: { idempotencyKey: existing.idempotencyKey },
          create: {
            projectId: params.projectId,
            orderId: order.id,
            receiptId: receipt.id,
            type: 'CREATE_SETTLEMENT_RECEIPT',
            idempotencyKey: existing.idempotencyKey,
            payload: { receiptId: receipt.id }
          },
          update: {
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: new Date(),
            lockedAt: null,
            lastError: null
          }
        });
        await tx.order.update({
          where: { id: order.id },
          data: { fiscalState: 'SETTLEMENT_PENDING' }
        });
        return receipt;
      });
    }
    if (
      order.fiscalReceipts.some(
        (receipt) =>
          receipt.type === 'SETTLEMENT' && receipt.status === 'CANCELED'
      )
    ) {
      throw new MarkingConflictError(
        'ЮKassa отклонила закрывающий чек; исправьте причину перед повторной отправкой'
      );
    }

    const receiptId = randomUUID();
    const idempotencyKey = `settlement:${order.id}`;
    return db.$transaction(async (tx) => {
      const receipt = await tx.fiscalReceipt.create({
        data: {
          id: receiptId,
          projectId: params.projectId,
          orderId: order.id,
          providerPaymentId: order.providerPaymentId!,
          type: 'SETTLEMENT',
          status: 'NEW',
          idempotencyKey,
          requestPayload: { orderId: order.id, codeStorage: 'encrypted' }
        }
      });
      await tx.fiscalOutbox.create({
        data: {
          projectId: params.projectId,
          orderId: order.id,
          receiptId: receipt.id,
          type: 'CREATE_SETTLEMENT_RECEIPT',
          idempotencyKey,
          payload: { receiptId: receipt.id }
        }
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          fiscalState: 'SETTLEMENT_PENDING',
          fulfillmentState: 'READY_TO_SHIP'
        }
      });
      return receipt;
    });
  }

  static async buildSettlementPayload(
    receiptId: string
  ): Promise<YooKassaCreateReceiptPayload> {
    const receipt = await db.fiscalReceipt.findUnique({
      where: { id: receiptId },
      include: {
        order: {
          include: {
            items: {
              include: {
                markedUnits: {
                  where: { status: { in: ['ASSIGNED', 'SOLD'] } },
                  orderBy: { scannedAt: 'asc' }
                }
              }
            }
          }
        }
      }
    });
    if (!receipt) throw new Error('Fiscal receipt not found');
    const { order } = receipt;
    const { integration } = await getActiveYooKassaFiscalIntegration(
      order.projectId
    );
    if (!order.providerPaymentId)
      throw new Error('YooKassa payment id missing');
    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const email = String(metadata.customerEmail ?? '').trim();
    if (!email)
      throw new Error('Customer email is required for YooKassa receipt');

    const items: YooKassaReceiptItem[] = [];
    let itemTotal = 0;
    for (const item of order.items) {
      if (!item.vatCode)
        throw new Error(`VAT is not configured for ${item.name}`);
      const cents = splitCents(Number(item.total), item.quantity);
      itemTotal += Number(item.total);
      for (let index = 0; index < item.quantity; index += 1) {
        const marked = item.markingStatus === 'MARKED_REQUIRED';
        const unit = marked ? item.markedUnits[index] : undefined;
        if (marked && !unit)
          throw new Error(`Mark code missing for ${item.name}`);
        items.push({
          description: item.name.slice(0, 128),
          quantity: '1.000',
          amount: { value: money(cents[index] / 100), currency: 'RUB' },
          vat_code: item.vatCode as YooKassaVatCode,
          payment_mode: 'full_payment',
          payment_subject: (marked
            ? 'marked'
            : item.paymentSubject || 'commodity') as YooKassaPaymentSubject,
          measure: item.measure as YooKassaMeasure,
          ...(unit
            ? {
                mark_mode: '0' as const,
                mark_code_info: {
                  gs_1m: markCodeToGs1m(decryptMarkCode(unit.codeEncrypted))
                }
              }
            : {})
        });
      }
    }
    const delivery = Number(order.totalAmount) - itemTotal;
    if (delivery < -0.01) throw new Error('Order items exceed the paid amount');
    if (delivery > 0.009) {
      const deliveryVat = integration.deliveryVatCode;
      if (
        !Number.isInteger(deliveryVat) ||
        deliveryVat < 1 ||
        deliveryVat > 12
      ) {
        throw new Error('Укажите НДС доставки в интеграции ЮKassa проекта');
      }
      items.push({
        description: 'Доставка',
        quantity: '1.000',
        amount: { value: money(delivery), currency: 'RUB' },
        vat_code: deliveryVat as YooKassaVatCode,
        payment_mode: 'full_payment',
        payment_subject: 'service',
        measure: 'piece'
      });
    }
    if (items.length > 80)
      throw new Error('YooKassa receipt cannot contain more than 80 items');
    return {
      type: 'payment',
      payment_id: order.providerPaymentId,
      customer: { email },
      items,
      send: true,
      internet: true,
      timezone: integration.receiptTimezone,
      settlements: [
        {
          type: 'prepayment',
          amount: { value: money(Number(order.totalAmount)), currency: 'RUB' }
        }
      ]
    };
  }
}
