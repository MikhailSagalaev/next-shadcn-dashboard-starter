import { db } from '@/lib/db';
import { decryptIntegrationSecret } from '@/lib/integrations/credential-encryption';
import { decryptMarkCode } from '@/lib/marking/code-crypto';
import type { Prisma } from '@prisma/client';
import { OrderReleaseService } from './order-release.service';

const MAX_ATTEMPTS = 10;

export class ComplianceGatewayConflictError extends Error {}

type GatewayResponse = {
  id?: string;
  status?: string;
  error?: string;
  fiscalReceiptStatus?: string;
  documents?: Array<{
    id: string;
    number: string;
    date: string;
    status?: string;
    supplierName: string;
    supplierInn?: string;
    notes?: string;
    items: Array<{
      name: string;
      gtin: string;
      quantity: number;
      unitCost?: number;
    }>;
  }>;
  [key: string]: unknown;
};

function retryAt(attempt: number) {
  const seconds = Math.min(3600, 15 * 2 ** Math.min(attempt, 8));
  return new Date(Date.now() + seconds * 1000);
}

function normalizedStatus(value: unknown) {
  return String(value ?? '').toUpperCase();
}

async function callGateway(
  projectId: string,
  idempotencyKey: string,
  payload: Record<string, unknown>
): Promise<GatewayResponse> {
  const integration = await db.complianceIntegration.findUnique({
    where: { projectId }
  });
  if (
    !integration?.isActive ||
    integration.provider !== 'CUSTOM_GATEWAY' ||
    !integration.gatewayUrl ||
    !integration.credentialEncrypted
  ) {
    throw new ComplianceGatewayConflictError(
      'API-шлюз ЭДО/ГИС МТ не подключён для этого проекта'
    );
  }
  const response = await fetch(integration.gatewayUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${decryptIntegrationSecret(
        integration.credentialEncrypted
      )}`,
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
  const body = (await response.json().catch(() => ({}))) as GatewayResponse;
  if (!response.ok) {
    throw new Error(body.error || `Gateway HTTP ${response.status}`);
  }
  return body;
}

async function applyDistanceSaleSuccess(
  documentId: string,
  response: GatewayResponse
) {
  const result = await db.$transaction(async (tx) => {
    const document = await tx.complianceDocument.findUnique({
      where: { id: documentId },
      include: { units: { include: { markedUnit: true } }, order: true }
    });
    if (!document?.order) {
      throw new ComplianceGatewayConflictError(
        'Заказ документа дистанционной продажи не найден'
      );
    }
    const now = new Date();
    await tx.complianceDocument.update({
      where: { id: document.id },
      data: {
        status: 'SUCCEEDED',
        externalId: response.id ? String(response.id) : document.externalId,
        responsePayload: response as Prisma.InputJsonValue,
        lastError: null,
        submittedAt: document.submittedAt ?? now,
        succeededAt: now
      }
    });
    await tx.order.update({
      where: { id: document.order.id },
      data: {
        withdrawalState: 'SUCCEEDED'
      }
    });
    return {
      projectId: document.projectId,
      orderId: document.order.id
    };
  });
  await OrderReleaseService.reconcile(result.projectId, result.orderId);
}

async function applyStockResolutionSuccess(
  documentId: string,
  response: GatewayResponse
) {
  return db.$transaction(async (tx) => {
    const document = await tx.complianceDocument.findUnique({
      where: { id: documentId },
      include: { units: { include: { markedUnit: true } } }
    });
    if (!document)
      throw new ComplianceGatewayConflictError('Документ не найден');
    const payload = (document.payload ?? {}) as {
      oldUnitId?: string;
      newUnitId?: string | null;
      comment?: string;
    };
    const oldLink = document.units.find(
      ({ markedUnitId }) => markedUnitId === payload.oldUnitId
    );
    const newLink = document.units.find(
      ({ markedUnitId }) => markedUnitId === payload.newUnitId
    );
    if (!oldLink) {
      throw new ComplianceGatewayConflictError(
        'В документе не найдена исходная упаковка'
      );
    }
    const now = new Date();
    let targetStatus: 'AVAILABLE' | 'RETURNED_TO_SUPPLIER' | 'VOID' =
      'AVAILABLE';
    if (document.kind === 'RETURN_TO_SUPPLIER') {
      targetStatus = 'RETURNED_TO_SUPPLIER';
    } else if (document.kind === 'REMARKING') {
      targetStatus = 'VOID';
    }
    await tx.markedUnit.update({
      where: { id: oldLink.markedUnitId },
      data: {
        status: targetStatus,
        ...(targetStatus === 'AVAILABLE'
          ? { availableAt: now, quarantinedAt: null }
          : {})
      }
    });
    await tx.stockUnitEvent.create({
      data: {
        projectId: document.projectId,
        markedUnitId: oldLink.markedUnitId,
        productId: oldLink.markedUnit.productId,
        fromStatus: oldLink.markedUnit.status,
        toStatus: targetStatus,
        reason: payload.comment || `Документ ${document.documentNumber}`
      }
    });

    let becomesAvailable = targetStatus === 'AVAILABLE';
    if (document.kind === 'REMARKING') {
      if (!newLink) {
        throw new ComplianceGatewayConflictError(
          'В документе перемаркировки не найден новый код'
        );
      }
      await tx.markedUnit.update({
        where: { id: newLink.markedUnitId },
        data: {
          status: 'AVAILABLE',
          availableAt: now,
          quarantinedAt: null
        }
      });
      await tx.stockUnitEvent.create({
        data: {
          projectId: document.projectId,
          markedUnitId: newLink.markedUnitId,
          productId: newLink.markedUnit.productId,
          fromStatus: newLink.markedUnit.status,
          toStatus: 'AVAILABLE',
          reason: `Перемаркировка по документу ${document.documentNumber}`
        }
      });
      becomesAvailable = true;
    }

    const productId =
      (document.kind === 'REMARKING'
        ? newLink?.markedUnit.productId
        : oldLink.markedUnit.productId) ?? null;
    if (productId) {
      const wasCounted = oldLink.previousStatus === 'AVAILABLE';
      const quantityDelta =
        becomesAvailable && !wasCounted
          ? 1
          : !becomesAvailable && wasCounted
            ? -1
            : 0;
      if (quantityDelta) {
        const current = await tx.product.findUniqueOrThrow({
          where: { id: productId }
        });
        const product = await tx.product.update({
          where: { id: productId },
          data: {
            stockOnHand: Math.max(0, current.stockOnHand + quantityDelta)
          }
        });
        await tx.inventoryMovement.upsert({
          where: {
            idempotencyKey: `stock-resolution:${document.id}:${productId}`
          },
          create: {
            projectId: document.projectId,
            productId,
            type: quantityDelta > 0 ? 'RETURN' : 'WRITE_OFF',
            quantity: quantityDelta,
            balanceAfter: product.stockOnHand,
            reason: `Документ ${document.documentNumber}`,
            idempotencyKey: `stock-resolution:${document.id}:${productId}`
          },
          update: {}
        });
      }
    }
    await tx.stockUnitHold.updateMany({
      where: {
        complianceDocumentId: document.id,
        status: 'PENDING_EXTERNAL'
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: now
      }
    });
    return tx.complianceDocument.update({
      where: { id: document.id },
      data: {
        status: 'SUCCEEDED',
        externalId: response.id ? String(response.id) : document.externalId,
        responsePayload: response as Prisma.InputJsonValue,
        submittedAt: document.submittedAt ?? now,
        succeededAt: now,
        lastError: null
      }
    });
  });
}

async function applyDocumentResponse(
  documentId: string,
  response: GatewayResponse
) {
  const document = await db.complianceDocument.findUnique({
    where: { id: documentId }
  });
  if (!document) throw new ComplianceGatewayConflictError('Документ не найден');
  const status = normalizedStatus(response.status);
  if (['SUCCEEDED', 'COMPLETED'].includes(status)) {
    if (document.kind === 'DISTANCE_SALE') {
      await applyDistanceSaleSuccess(document.id, response);
      return true;
    }
    const { ComplianceService } = await import('./compliance.service');
    if (document.kind === 'WRITE_OFF') {
      await ComplianceService.completeWriteOff(document.id, response);
      return true;
    }
    if (
      ['RETURN_TO_CIRCULATION', 'RETURN_TO_SUPPLIER', 'REMARKING'].includes(
        document.kind
      )
    ) {
      await applyStockResolutionSuccess(document.id, response);
      return true;
    }
    const completedDocument = await db.complianceDocument.update({
      where: { id: document.id },
      data: {
        status: 'SUCCEEDED',
        externalId: response.id ? String(response.id) : document.externalId,
        responsePayload: response as Prisma.InputJsonValue,
        submittedAt: document.submittedAt ?? new Date(),
        succeededAt: new Date(),
        lastError: null
      }
    });
    if (document.kind === 'UPD_RECEIPT' && completedDocument.goodsReceiptId) {
      const { ReceivingConflictError, ReceivingService } = await import(
        './receiving.service'
      );
      try {
        await ReceivingService.accept({
          projectId: document.projectId,
          receiptId: completedDocument.goodsReceiptId,
          actorId:
            typeof response.confirmedBy === 'string'
              ? response.confirmedBy
              : document.createdBy || 'compliance-gateway'
        });
      } catch (error) {
        if (!(error instanceof ReceivingConflictError)) throw error;
      }
    }
    return true;
  }
  if (['FAILED', 'REJECTED', 'CANCELED'].includes(status)) {
    await db.complianceDocument.update({
      where: { id: document.id },
      data: {
        status: status === 'CANCELED' ? 'CANCELED' : 'FAILED',
        responsePayload: response as Prisma.InputJsonValue,
        lastError: response.error || `Оператор вернул статус ${status}`
      }
    });
    if (document.orderId) {
      await db.order.update({
        where: { id: document.orderId },
        data: { withdrawalState: 'FAILED' }
      });
    }
    return true;
  }
  await db.complianceDocument.update({
    where: { id: document.id },
    data: {
      status: 'PROCESSING',
      externalId: response.id ? String(response.id) : document.externalId,
      responsePayload: response as Prisma.InputJsonValue,
      submittedAt: document.submittedAt ?? new Date(),
      lastError: null
    }
  });
  return false;
}

export class ComplianceGatewayService {
  static async testIntegration(projectId: string) {
    try {
      const response = await callGateway(
        projectId,
        `capabilities:${projectId}`,
        { kind: 'CAPABILITIES', contractVersion: '2026-07-28' }
      );
      await db.complianceIntegration.update({
        where: { projectId },
        data: { lastTestedAt: new Date(), lastError: null }
      });
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Шлюз недоступен';
      await db.complianceIntegration.update({
        where: { projectId },
        data: { lastTestedAt: new Date(), lastError: message }
      });
      throw error;
    }
  }

  static async confirmManualDocument(params: {
    projectId: string;
    documentId: string;
    externalId: string;
    actorId: string;
  }) {
    const document = await db.complianceDocument.findFirst({
      where: {
        id: params.documentId,
        projectId: params.projectId,
        provider: 'MANUAL',
        status: 'READY_TO_SIGN'
      }
    });
    if (!document) {
      throw new ComplianceGatewayConflictError(
        'Ручной документ не найден или уже обработан'
      );
    }
    if (document.kind === 'DISTANCE_SALE') {
      throw new ComplianceGatewayConflictError(
        'Для дистанционной продажи подтвердите также внешний закрывающий чек на странице заказа'
      );
    }
    await applyDocumentResponse(document.id, {
      id: params.externalId,
      status: 'SUCCEEDED',
      confirmedBy: params.actorId,
      confirmationMode: 'MANUAL'
    });
    return db.complianceDocument.findUniqueOrThrow({
      where: { id: document.id }
    });
  }

  static async createDistanceSale(params: {
    projectId: string;
    orderId: string;
    actorId: string;
  }) {
    const [integration, order] = await Promise.all([
      db.complianceIntegration.findUnique({
        where: { projectId: params.projectId }
      }),
      db.order.findFirst({
        where: { id: params.orderId, projectId: params.projectId },
        include: {
          items: true,
          markedUnits: {
            where: { status: { in: ['ASSIGNED', 'RESERVED'] } }
          },
          complianceDocuments: {
            where: { kind: 'DISTANCE_SALE' },
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);
    if (!order) throw new ComplianceGatewayConflictError('Заказ не найден');
    if (integration?.distanceSaleMode !== 'GIS_MT_DISTANCE_SALE') {
      throw new ComplianceGatewayConflictError(
        'Для проекта не выбран вывод через ГИС МТ «Дистанционная торговля»'
      );
    }
    if (order.paymentStatus !== 'PAID') {
      throw new ComplianceGatewayConflictError('Заказ ещё не оплачен');
    }
    if (!['COMPLETE', 'NOT_REQUIRED'].includes(order.markingState)) {
      throw new ComplianceGatewayConflictError(
        'Сначала отсканируйте все упаковки заказа'
      );
    }
    const requiredCount = order.items
      .filter((item) => item.markingStatus === 'MARKED_REQUIRED')
      .reduce((sum, item) => sum + item.quantity, 0);
    if (requiredCount !== order.markedUnits.length) {
      throw new ComplianceGatewayConflictError(
        `Для вывода требуется ${requiredCount} упаковок, выбрано ${order.markedUnits.length}`
      );
    }
    const existing = order.complianceDocuments[0];
    if (existing && !['FAILED', 'CANCELED'].includes(existing.status)) {
      return existing;
    }

    return db.$transaction(async (tx) => {
      const document =
        existing && ['FAILED', 'CANCELED'].includes(existing.status)
          ? await tx.complianceDocument.update({
              where: { id: existing.id },
              data: { status: 'DRAFT', lastError: null }
            })
          : await tx.complianceDocument.create({
              data: {
                projectId: params.projectId,
                orderId: order.id,
                kind: 'DISTANCE_SALE',
                status: 'DRAFT',
                provider: integration.provider,
                documentNumber: `DS-${order.orderNumber}`,
                idempotencyKey: `distance-sale:${params.projectId}:${order.id}`,
                createdBy: params.actorId,
                payload: {
                  orderNumber: order.orderNumber,
                  deliveryMethod: order.deliveryMethod,
                  deliveryAddress: order.deliveryAddress
                },
                units: {
                  create: order.markedUnits.map((unit) => ({
                    markedUnitId: unit.id,
                    previousStatus: unit.status
                  }))
                }
              }
            });

      if (
        !integration.isActive ||
        integration.provider === 'MANUAL' ||
        !integration.gatewayUrl ||
        !integration.credentialEncrypted
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            withdrawalMode: 'GIS_MT_DISTANCE_SALE',
            withdrawalState: 'PENDING'
          }
        });
        return tx.complianceDocument.update({
          where: { id: document.id },
          data: {
            status: 'READY_TO_SIGN',
            provider: 'MANUAL',
            lastError:
              'Документ подготовлен. Отправьте его в ГИС МТ, оформите закрывающий чек и затем подтвердите оба результата в Gupil.'
          }
        });
      }

      await tx.complianceOutbox.upsert({
        where: { idempotencyKey: `distance-sale:${document.id}` },
        create: {
          projectId: params.projectId,
          documentId: document.id,
          type: 'SUBMIT_DOCUMENT',
          idempotencyKey: `distance-sale:${document.id}`,
          payload: { documentId: document.id }
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
        data: {
          withdrawalMode: 'GIS_MT_DISTANCE_SALE',
          withdrawalState: 'PENDING'
        }
      });
      return tx.complianceDocument.update({
        where: { id: document.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() }
      });
    });
  }

  static async confirmManualDistanceSale(params: {
    projectId: string;
    orderId: string;
    externalId: string;
    actorId: string;
  }) {
    const document = await db.complianceDocument.findFirst({
      where: {
        projectId: params.projectId,
        orderId: params.orderId,
        kind: 'DISTANCE_SALE',
        status: 'READY_TO_SIGN'
      }
    });
    if (!document) {
      throw new ComplianceGatewayConflictError(
        'Подготовленный ручной документ не найден'
      );
    }
    await applyDistanceSaleSuccess(document.id, {
      id: params.externalId,
      status: 'SUCCEEDED',
      confirmedBy: params.actorId,
      confirmationMode: 'MANUAL'
    });
    return db.complianceDocument.findUniqueOrThrow({
      where: { id: document.id }
    });
  }

  static async submitDocument(documentId: string) {
    const document = await db.complianceDocument.findUnique({
      where: { id: documentId },
      include: {
        units: { include: { markedUnit: true } },
        order: true,
        goodsReceipt: true
      }
    });
    if (!document)
      throw new ComplianceGatewayConflictError('Документ не найден');
    const response = await callGateway(
      document.projectId,
      `${document.kind.toLowerCase()}:${document.id}`,
      {
        kind: document.kind,
        documentId: document.id,
        documentNumber: document.documentNumber,
        orderNumber: document.order?.orderNumber,
        reason: document.reason,
        payload: document.payload,
        codes: document.units.map(({ markedUnit }) =>
          decryptMarkCode(markedUnit.codeEncrypted)
        )
      }
    );
    return {
      completed: await applyDocumentResponse(document.id, response),
      response
    };
  }

  static async syncDocument(documentId: string) {
    const document = await db.complianceDocument.findUnique({
      where: { id: documentId }
    });
    if (!document)
      throw new ComplianceGatewayConflictError('Документ не найден');
    if (!document.externalId) {
      throw new ComplianceGatewayConflictError(
        'Оператор ещё не присвоил документу внешний номер'
      );
    }
    const response = await callGateway(
      document.projectId,
      `status:${document.id}`,
      {
        kind: 'DOCUMENT_STATUS',
        documentId: document.id,
        externalId: document.externalId,
        documentKind: document.kind
      }
    );
    return {
      completed: await applyDocumentResponse(document.id, response),
      response
    };
  }

  static async syncIncomingUpd(projectId: string) {
    const response = await callGateway(projectId, `upd-sync:${projectId}`, {
      kind: 'SYNC_INCOMING_UPD'
    });
    if (!Array.isArray(response.documents)) {
      throw new ComplianceGatewayConflictError(
        'Шлюз не вернул список входящих УПД'
      );
    }
    let created = 0;
    let updated = 0;
    for (const incoming of response.documents) {
      if (
        !incoming.id ||
        !incoming.number ||
        !incoming.supplierName ||
        !Array.isArray(incoming.items)
      ) {
        continue;
      }
      const documentDate = new Date(incoming.date);
      if (Number.isNaN(documentDate.getTime())) continue;
      const incomingStatus = normalizedStatus(incoming.status);
      const isConfirmed = [
        'SIGNED',
        'ACCEPTED',
        'CONFIRMED',
        'SUCCEEDED',
        'COMPLETED'
      ].includes(incomingStatus);
      const existing = await db.goodsReceipt.findFirst({
        where: { projectId, externalDocumentId: incoming.id }
      });
      const items = incoming.items
        .filter(
          (item) =>
            item.name &&
            /^\d{8,14}$/.test(String(item.gtin ?? '').trim()) &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0
        )
        .map((item) => ({
          name: item.name,
          gtin: String(item.gtin).trim().padStart(14, '0'),
          expectedQuantity: item.quantity,
          unitCost: item.unitCost
        }));
      if (!items.length) continue;
      if (existing) {
        if (
          ['DRAFT', 'SCANNING', 'DISCREPANCY', 'ACCEPTANCE_PENDING'].includes(
            existing.status
          )
        ) {
          await db.goodsReceipt.update({
            where: { id: existing.id },
            data: {
              externalStatus: incoming.status,
              metadata: { notes: incoming.notes ?? null }
            }
          });
          updated += 1;
        }
        if (isConfirmed) {
          await db.complianceDocument.upsert({
            where: {
              idempotencyKey: `incoming-upd:${projectId}:${incoming.id}`
            },
            create: {
              projectId,
              goodsReceiptId: existing.id,
              kind: 'UPD_RECEIPT',
              status: 'SUCCEEDED',
              provider: 'CUSTOM_GATEWAY',
              documentNumber: incoming.number,
              idempotencyKey: `incoming-upd:${projectId}:${incoming.id}`,
              externalId: incoming.id,
              responsePayload: incoming as unknown as Prisma.InputJsonValue,
              submittedAt: new Date(),
              succeededAt: new Date()
            },
            update: {
              status: 'SUCCEEDED',
              externalId: incoming.id,
              responsePayload: incoming as unknown as Prisma.InputJsonValue,
              succeededAt: new Date(),
              lastError: null
            }
          });
        }
        continue;
      }
      const receipt = await db.goodsReceipt.create({
        data: {
          projectId,
          supplierName: incoming.supplierName,
          supplierInn: incoming.supplierInn,
          documentNumber: incoming.number,
          documentDate,
          source: 'EDO',
          status: 'DRAFT',
          externalDocumentId: incoming.id,
          externalStatus: incoming.status,
          metadata: { notes: incoming.notes ?? null },
          items: { create: items }
        }
      });
      if (isConfirmed) {
        await db.complianceDocument.create({
          data: {
            projectId,
            goodsReceiptId: receipt.id,
            kind: 'UPD_RECEIPT',
            status: 'SUCCEEDED',
            provider: 'CUSTOM_GATEWAY',
            documentNumber: incoming.number,
            idempotencyKey: `incoming-upd:${projectId}:${incoming.id}`,
            externalId: incoming.id,
            responsePayload: incoming as unknown as Prisma.InputJsonValue,
            submittedAt: new Date(),
            succeededAt: new Date()
          }
        });
      }
      created += 1;
    }
    await db.complianceIntegration.update({
      where: { projectId },
      data: { lastSyncAt: new Date(), lastError: null }
    });
    return { created, updated, received: response.documents.length };
  }
}

export async function processComplianceOutboxBatch(limit = 20) {
  await db.complianceOutbox.updateMany({
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
  const entries = await db.complianceOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit
  });
  let processed = 0;
  for (const entry of entries) {
    const claimed = await db.complianceOutbox.updateMany({
      where: { id: entry.id, status: 'PENDING' },
      data: { status: 'PROCESSING', lockedAt: new Date() }
    });
    if (!claimed.count) continue;
    try {
      const result =
        entry.type === 'SYNC_DOCUMENT'
          ? await ComplianceGatewayService.syncDocument(entry.documentId)
          : await ComplianceGatewayService.submitDocument(entry.documentId);
      if (result.completed) {
        await db.complianceOutbox.update({
          where: { id: entry.id },
          data: { status: 'COMPLETED', lockedAt: null, lastError: null }
        });
      } else {
        await db.complianceOutbox.update({
          where: { id: entry.id },
          data: {
            type: 'SYNC_DOCUMENT',
            status: 'PENDING',
            attemptCount: { increment: 1 },
            nextAttemptAt: retryAt(entry.attemptCount + 1),
            lockedAt: null,
            lastError: null
          }
        });
      }
      processed += 1;
    } catch (error) {
      const attempt = entry.attemptCount + 1;
      const exhausted = attempt >= MAX_ATTEMPTS;
      const message =
        error instanceof Error ? error.message : 'Ошибка шлюза ЭДО/ГИС МТ';
      await db.complianceOutbox.update({
        where: { id: entry.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attemptCount: attempt,
          nextAttemptAt: retryAt(attempt),
          lockedAt: null,
          lastError: message
        }
      });
      await db.complianceDocument.update({
        where: { id: entry.documentId },
        data: {
          status: exhausted ? 'FAILED' : 'PROCESSING',
          lastError: message
        }
      });
      const document = await db.complianceDocument.findUnique({
        where: { id: entry.documentId },
        select: { orderId: true }
      });
      if (exhausted && document?.orderId) {
        await db.order.update({
          where: { id: document.orderId },
          data: { withdrawalState: 'FAILED' }
        });
      }
    }
  }
  return processed;
}

export async function retryComplianceOutbox(params: {
  projectId: string;
  entryId: string;
}) {
  const entry = await db.complianceOutbox.findFirst({
    where: { id: params.entryId, projectId: params.projectId }
  });
  if (!entry) throw new ComplianceGatewayConflictError('Задание не найдено');
  return db.complianceOutbox.update({
    where: { id: entry.id },
    data: {
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lastError: null
    }
  });
}
