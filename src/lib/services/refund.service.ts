import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { decryptMarkCode, hashMarkCode } from '@/lib/marking/code-crypto';
import { markCodeToGs1m, parseGs1DataMatrix } from '@/lib/marking/gs1';
import type {
  YooKassaCreateRefundPayload,
  YooKassaMeasure,
  YooKassaPaymentSubject,
  YooKassaReceiptItem,
  YooKassaVatCode
} from '@/lib/yookassa/types';
import { getActiveYooKassaFiscalIntegration } from './yookassa-fiscal-integration.service';

export class RefundConflictError extends Error {}

const money = (value: number) => value.toFixed(2);

export class RefundService {
  static async identifyReturnedUnit(params: {
    projectId: string;
    orderId: string;
    code: string;
  }) {
    let codeHash: string;
    try {
      codeHash = hashMarkCode(parseGs1DataMatrix(params.code).raw);
    } catch (error) {
      throw new RefundConflictError(
        error instanceof Error ? error.message : 'Некорректный Data Matrix'
      );
    }
    const unit = await db.markedUnit.findFirst({
      where: {
        projectId: params.projectId,
        orderId: params.orderId,
        codeHash,
        status: 'SOLD'
      },
      include: {
        orderItem: { select: { name: true } }
      }
    });
    if (!unit) {
      throw new RefundConflictError(
        'Эта упаковка не числится проданной в выбранном заказе или уже возвращена'
      );
    }
    return {
      id: unit.id,
      gtin: unit.gtin,
      serial: unit.serial,
      itemName: unit.orderItem?.name ?? 'Товар'
    };
  }

  static async queue(params: {
    projectId: string;
    orderId: string;
    reason: string;
    unitIds?: string[];
  }) {
    await getActiveYooKassaFiscalIntegration(params.projectId);
    const order = await db.order.findFirst({
      where: { id: params.orderId, projectId: params.projectId },
      include: {
        fiscalReceipts: true,
        markedUnits: { where: { status: 'SOLD' } }
      }
    });
    if (!order || !order.providerPaymentId)
      throw new RefundConflictError('Оплаченный заказ не найден');
    if (
      !order.fiscalReceipts.some(
        (receipt) =>
          receipt.type === 'SETTLEMENT' && receipt.status === 'SUCCEEDED'
      )
    ) {
      throw new RefundConflictError(
        'Возврат возможен после успешного чека полного расчёта'
      );
    }
    if (
      order.fiscalReceipts.some(
        (receipt) =>
          receipt.type === 'REFUND' &&
          ['NEW', 'PENDING'].includes(receipt.status)
      )
    ) {
      throw new RefundConflictError('Предыдущий возврат ещё обрабатывается');
    }
    const successfulRefundExists = order.fiscalReceipts.some(
      (receipt) => receipt.type === 'REFUND' && receipt.status === 'SUCCEEDED'
    );
    if (successfulRefundExists && !params.unitIds?.length) {
      throw new RefundConflictError(
        'После частичного возврата выбирайте оставшиеся упаковки отдельно'
      );
    }
    const selectedIds = params.unitIds?.length
      ? [...new Set(params.unitIds)]
      : order.markedUnits.map((unit) => unit.id);
    if (
      selectedIds.some(
        (id) => !order.markedUnits.some((unit) => unit.id === id)
      )
    ) {
      throw new RefundConflictError(
        'Для возврата выбрана упаковка, не проданная в этом заказе'
      );
    }
    const id = randomUUID();
    const idempotencyKey = `refund:${order.id}:${selectedIds.sort().join(',') || 'full'}`;
    return db.$transaction(async (tx) => {
      const previous = await tx.fiscalReceipt.findUnique({
        where: { idempotencyKey }
      });
      const receipt = previous
        ? await tx.fiscalReceipt.update({
            where: { id: previous.id },
            data: {
              status: 'NEW',
              lastError: null,
              requestPayload: {
                reason: params.reason,
                unitIds: selectedIds,
                full: !params.unitIds?.length
              }
            }
          })
        : await tx.fiscalReceipt.create({
            data: {
              id,
              projectId: params.projectId,
              orderId: order.id,
              providerPaymentId: order.providerPaymentId!,
              type: 'REFUND',
              status: 'NEW',
              idempotencyKey,
              requestPayload: {
                reason: params.reason,
                unitIds: selectedIds,
                full: !params.unitIds?.length
              }
            }
          });
      await tx.fiscalOutbox.upsert({
        where: { idempotencyKey },
        create: {
          projectId: params.projectId,
          orderId: order.id,
          receiptId: receipt.id,
          type: 'CREATE_REFUND',
          idempotencyKey,
          payload: { receiptId: receipt.id }
        },
        update: {
          receiptId: receipt.id,
          status: 'PENDING',
          attemptCount: 0,
          nextAttemptAt: new Date(),
          lockedAt: null,
          lastError: null
        }
      });
      if (selectedIds.length) {
        await tx.markedUnit.updateMany({
          where: { id: { in: selectedIds }, status: 'SOLD' },
          data: { status: 'RETURN_PENDING' }
        });
      }
      return receipt;
    });
  }

  static async buildPayload(
    receiptId: string
  ): Promise<YooKassaCreateRefundPayload> {
    const receipt = await db.fiscalReceipt.findUnique({
      where: { id: receiptId },
      include: {
        order: {
          include: {
            items: {
              include: {
                markedUnits: {
                  where: { status: { in: ['SOLD', 'RETURN_PENDING'] } }
                }
              }
            }
          }
        }
      }
    });
    if (!receipt || receipt.type !== 'REFUND')
      throw new RefundConflictError('Возврат не найден');
    const request = (receipt.requestPayload ?? {}) as {
      unitIds?: string[];
      full?: boolean;
      reason?: string;
    };
    const selected = new Set(request.unitIds ?? []);
    const metadata = (receipt.order.metadata ?? {}) as Record<string, unknown>;
    const email = String(metadata.customerEmail ?? '').trim();
    if (!email) throw new RefundConflictError('У покупателя не указан email');
    const items: YooKassaReceiptItem[] = [];
    let amount = 0;
    for (const item of receipt.order.items) {
      const unitPrice = Number(item.total) / item.quantity;
      if (item.markingStatus === 'MARKED_REQUIRED') {
        for (const unit of item.markedUnits) {
          if (!request.full && !selected.has(unit.id)) continue;
          amount += unitPrice;
          items.push({
            description: item.name.slice(0, 128),
            quantity: '1.000',
            amount: { value: money(unitPrice), currency: 'RUB' },
            vat_code: item.vatCode as YooKassaVatCode,
            payment_mode: 'full_payment',
            payment_subject: 'marked',
            measure: item.measure as YooKassaMeasure,
            mark_mode: '0',
            mark_code_info: {
              gs_1m: markCodeToGs1m(decryptMarkCode(unit.codeEncrypted))
            }
          });
        }
      } else if (request.full) {
        amount += Number(item.total);
        items.push({
          description: item.name.slice(0, 128),
          quantity: item.quantity.toFixed(3),
          amount: { value: money(Number(item.total)), currency: 'RUB' },
          vat_code: item.vatCode as YooKassaVatCode,
          payment_mode: 'full_payment',
          payment_subject: (item.paymentSubject ||
            'commodity') as YooKassaPaymentSubject,
          measure: item.measure as YooKassaMeasure
        });
      }
    }
    if (request.full) {
      const delivery = Number(receipt.order.totalAmount) - amount;
      if (delivery > 0.009) {
        const { integration } = await getActiveYooKassaFiscalIntegration(
          receipt.projectId
        );
        if (!integration.deliveryVatCode)
          throw new RefundConflictError('Не настроен НДС доставки');
        amount += delivery;
        items.push({
          description: 'Доставка',
          quantity: '1.000',
          amount: { value: money(delivery), currency: 'RUB' },
          vat_code: integration.deliveryVatCode as YooKassaVatCode,
          payment_mode: 'full_payment',
          payment_subject: 'service',
          measure: 'piece'
        });
      }
    }
    if (!items.length || amount <= 0)
      throw new RefundConflictError('В возврате нет позиций');
    return {
      payment_id: receipt.providerPaymentId,
      amount: { value: money(amount), currency: 'RUB' },
      description: request.reason?.slice(0, 250),
      receipt: { customer: { email }, items }
    };
  }

  static async applyStatus(receiptId: string, status: string) {
    const receipt = await db.fiscalReceipt.findUniqueOrThrow({
      where: { id: receiptId }
    });
    const request = (receipt.requestPayload ?? {}) as {
      unitIds?: string[];
      full?: boolean;
    };
    const unitIds = request.unitIds ?? [];
    if (status === 'succeeded') {
      if (receipt.status === 'SUCCEEDED' && receipt.succeededAt) return;
      await db.$transaction(async (tx) => {
        const now = new Date();
        await tx.fiscalReceipt.update({
          where: { id: receipt.id },
          data: { status: 'SUCCEEDED', succeededAt: now, lastError: null }
        });
        await tx.order.update({
          where: { id: receipt.orderId },
          data: {
            fiscalState: request.full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            paymentStatus: request.full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            status: request.full ? 'REFUNDED' : undefined,
            fulfillmentState: request.full ? 'RETURNED' : undefined
          }
        });
        if (unitIds.length) {
          const units = await tx.markedUnit.findMany({
            where: { id: { in: unitIds }, orderId: receipt.orderId }
          });
          await tx.markedUnit.updateMany({
            where: { id: { in: unitIds } },
            data: {
              status: 'QUARANTINED',
              returnedAt: now,
              quarantinedAt: now,
              receiptId: receipt.id
            }
          });
          await tx.stockUnitEvent.createMany({
            data: units.map((unit) => ({
              projectId: receipt.projectId,
              markedUnitId: unit.id,
              productId: unit.productId,
              orderId: receipt.orderId,
              fromStatus: unit.status,
              toStatus: 'QUARANTINED' as const,
              reason: 'Возврат покупателя: требуется проверка упаковки'
            }))
          });
          await tx.stockUnitHold.createMany({
            data: units.map((unit) => ({
              projectId: receipt.projectId,
              markedUnitId: unit.id,
              source: 'CUSTOMER_RETURN' as const,
              reason: 'Возврат покупателя: требуется проверка упаковки и кода'
            }))
          });
        }
      });
    } else if (status === 'canceled') {
      await db.$transaction([
        db.fiscalReceipt.update({
          where: { id: receipt.id },
          data: { status: 'CANCELED', lastError: 'ЮKassa отклонила возврат' }
        }),
        db.markedUnit.updateMany({
          where: { id: { in: unitIds }, status: 'RETURN_PENDING' },
          data: { status: 'SOLD' }
        })
      ]);
    } else {
      await db.fiscalReceipt.update({
        where: { id: receipt.id },
        data: { status: 'PENDING' }
      });
    }
  }

  static async fail(receiptId: string, message: string) {
    const receipt = await db.fiscalReceipt.findUnique({
      where: { id: receiptId }
    });
    if (!receipt || receipt.type !== 'REFUND') return;
    const request = (receipt.requestPayload ?? {}) as { unitIds?: string[] };
    const unitIds = request.unitIds ?? [];
    await db.$transaction([
      db.fiscalReceipt.update({
        where: { id: receipt.id },
        data: { status: 'FAILED', lastError: message }
      }),
      db.markedUnit.updateMany({
        where: { id: { in: unitIds }, status: 'RETURN_PENDING' },
        data: { status: 'SOLD' }
      })
    ]);
  }
}
