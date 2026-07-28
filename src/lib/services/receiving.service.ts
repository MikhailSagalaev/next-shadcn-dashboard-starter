import { db } from '@/lib/db';
import { encryptMarkCode, hashMarkCode } from '@/lib/marking/code-crypto';
import { parseGs1DataMatrix } from '@/lib/marking/gs1';
import type { GoodsReceiptSource } from '@prisma/client';

export class ReceivingConflictError extends Error {}

type ReceiptItemInput = {
  productId?: string;
  name: string;
  gtin: string;
  expectedQuantity: number;
  unitCost?: number;
};

const receiptInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      units: {
        select: {
          id: true,
          gtin: true,
          serial: true,
          status: true,
          scannedAt: true,
          availableAt: true,
          quarantinedAt: true,
          productId: true
        }
      }
    }
  },
  discrepancies: {
    include: {
      markedUnit: {
        include: {
          product: { select: { id: true, name: true, sku: true, gtin: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' as const }
  },
  complianceDocuments: { orderBy: { createdAt: 'desc' as const } }
};

function presentReceipt(receipt: any) {
  const itemUnits = receipt.items.flatMap((item: any) =>
    item.units.map((unit: any) => ({
      ...unit,
      itemId: item.id,
      productName: item.name,
      product: item.product,
      createdAt: unit.scannedAt,
      maskedCode: unit.serial
        ? `••••${String(unit.serial).slice(-6)}`
        : 'Код сохранён'
    }))
  );
  const knownIds = new Set(itemUnits.map((unit: any) => unit.id));
  const detachedUnits = receipt.discrepancies
    .map((item: any) => item.markedUnit)
    .filter((unit: any) => unit && !knownIds.has(unit.id))
    .map((unit: any) => ({
      ...unit,
      product: unit.product,
      productName: unit.product?.name,
      createdAt: unit.scannedAt,
      maskedCode: unit.serial
        ? `••••${String(unit.serial).slice(-6)}`
        : 'Код сохранён'
    }));
  const units = [...itemUnits, ...detachedUnits];
  const metadata = (receipt.metadata ?? {}) as Record<string, unknown>;
  return {
    ...receipt,
    discrepancies: receipt.discrepancies.map((discrepancy: any) => ({
      id: discrepancy.id,
      type: discrepancy.type,
      message: discrepancy.message,
      resolution: discrepancy.resolution,
      resolutionComment: discrepancy.resolutionComment,
      resolvedAt: discrepancy.resolvedAt,
      createdAt: discrepancy.createdAt,
      markedUnit: discrepancy.markedUnit
        ? {
            id: discrepancy.markedUnit.id,
            gtin: discrepancy.markedUnit.gtin,
            serial: discrepancy.markedUnit.serial,
            status: discrepancy.markedUnit.status,
            productId: discrepancy.markedUnit.productId,
            goodsReceiptItemId: discrepancy.markedUnit.goodsReceiptItemId,
            product: discrepancy.markedUnit.product
          }
        : null
    })),
    units,
    expectedUnits:
      receipt.items.reduce(
        (sum: number, item: any) => sum + item.expectedQuantity,
        0
      ) || Number(metadata.expectedUnits ?? 0),
    scannedUnits: units.length,
    acceptedUnits: receipt.items.reduce(
      (sum: number, item: any) => sum + item.acceptedQuantity,
      0
    ),
    discrepancyCount: receipt.discrepancies.filter(
      (item: any) => !item.resolvedAt
    ).length,
    notes: metadata.notes ?? null,
    quarantinedUnits: units.filter((unit: any) => unit.status === 'QUARANTINED')
      .length,
    availableUnits: units.filter((unit: any) =>
      ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'SOLD'].includes(unit.status)
    ).length
  };
}

export class ReceivingService {
  static async list(projectId: string) {
    const receipts = await db.goodsReceipt.findMany({
      where: { projectId },
      include: receiptInclude,
      orderBy: { createdAt: 'desc' }
    });
    return receipts.map(presentReceipt);
  }

  static async get(projectId: string, receiptId: string) {
    const receipt = await db.goodsReceipt.findFirst({
      where: { id: receiptId, projectId },
      include: receiptInclude
    });
    if (!receipt) throw new ReceivingConflictError('Приёмка не найдена');
    return presentReceipt(receipt);
  }

  static async create(params: {
    projectId: string;
    supplierName: string;
    supplierInn?: string;
    documentNumber: string;
    documentDate?: Date;
    source?: GoodsReceiptSource;
    expectedUnits?: number;
    notes?: string;
    items?: ReceiptItemInput[];
  }) {
    return db.goodsReceipt.create({
      data: {
        projectId: params.projectId,
        supplierName: params.supplierName,
        supplierInn: params.supplierInn || null,
        documentNumber: params.documentNumber,
        documentDate: params.documentDate ?? new Date(),
        source: params.source ?? 'MANUAL',
        status: 'DRAFT',
        metadata: {
          expectedUnits: params.expectedUnits ?? 0,
          notes: params.notes || null
        },
        items: params.items?.length
          ? {
              create: params.items.map((item) => ({
                productId: item.productId,
                name: item.name,
                gtin: item.gtin.padStart(14, '0'),
                expectedQuantity: item.expectedQuantity,
                unitCost: item.unitCost
              }))
            }
          : undefined
      },
      include: receiptInclude
    });
  }

  static async validateCode(params: {
    projectId: string;
    receiptId: string;
    code: string;
  }) {
    let parsed: ReturnType<typeof parseGs1DataMatrix>;
    try {
      parsed = parseGs1DataMatrix(params.code);
    } catch (error) {
      throw new ReceivingConflictError(
        error instanceof Error ? error.message : 'Некорректный Data Matrix'
      );
    }
    const receipt = await db.goodsReceipt.findFirst({
      where: { id: params.receiptId, projectId: params.projectId },
      include: { items: true }
    });
    if (!receipt) throw new ReceivingConflictError('Приёмка не найдена');
    const item = receipt.items.find(
      (candidate) => candidate.gtin === parsed.gtin
    );
    if (!item) {
      throw new ReceivingConflictError(
        `В Data Matrix указан GTIN ${parsed.gtin}, которого нет в этой приёмке`
      );
    }
    return {
      gtin: parsed.gtin,
      serial: parsed.serial,
      productName: item.name,
      rawLength: parsed.raw.length
    };
  }

  static async scan(params: {
    projectId: string;
    receiptId: string;
    code: string;
    actorId: string;
    productId?: string;
  }) {
    let parsed: ReturnType<typeof parseGs1DataMatrix>;
    try {
      parsed = parseGs1DataMatrix(params.code);
    } catch (error) {
      throw new ReceivingConflictError(
        error instanceof Error ? error.message : 'Некорректный Data Matrix'
      );
    }
    const codeHash = hashMarkCode(parsed.raw);
    const [existingReceipt, duplicate] = await Promise.all([
      db.goodsReceipt.findFirst({
        where: { id: params.receiptId, projectId: params.projectId },
        select: { id: true, status: true }
      }),
      db.markedUnit.findUnique({ where: { codeHash }, select: { id: true } })
    ]);
    if (!existingReceipt)
      throw new ReceivingConflictError('Приёмка не найдена');
    if (duplicate) {
      await db.$transaction([
        db.goodsReceiptDiscrepancy.create({
          data: {
            projectId: params.projectId,
            goodsReceiptId: existingReceipt.id,
            type: 'DUPLICATE',
            message: 'Этот Data Matrix уже есть в складском реестре'
          }
        }),
        db.goodsReceipt.update({
          where: { id: existingReceipt.id },
          data: { status: 'DISCREPANCY' }
        })
      ]);
      throw new ReceivingConflictError(
        'Этот Data Matrix уже есть в складском реестре'
      );
    }
    return db.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findFirst({
        where: { id: params.receiptId, projectId: params.projectId },
        include: { items: true }
      });
      if (!receipt) throw new ReceivingConflictError('Приёмка не найдена');
      if (['ACCEPTED', 'REJECTED'].includes(receipt.status)) {
        throw new ReceivingConflictError('Завершённую приёмку нельзя изменять');
      }
      let item = receipt.items.find(
        (candidate) => candidate.gtin === parsed.gtin
      );
      if (!item) {
        const product = await tx.product.findFirst({
          where: {
            projectId: params.projectId,
            gtin: parsed.gtin,
            ...(params.productId ? { id: params.productId } : {})
          }
        });
        if (product) {
          item = await tx.goodsReceiptItem.create({
            data: {
              goodsReceiptId: receipt.id,
              productId: product.id,
              name: product.name,
              gtin: parsed.gtin,
              expectedQuantity: 0
            }
          });
        }
      }

      const quarantined = !item;
      const unit = await tx.markedUnit.create({
        data: {
          projectId: params.projectId,
          goodsReceiptItemId: item?.id,
          productId: item?.productId,
          codeHash,
          codeEncrypted: encryptMarkCode(parsed.raw),
          gtin: parsed.gtin,
          serial: parsed.serial,
          status: quarantined ? 'QUARANTINED' : 'SCANNED',
          scannedBy: params.actorId,
          quarantinedAt: quarantined ? new Date() : null
        }
      });
      await tx.stockUnitEvent.create({
        data: {
          projectId: params.projectId,
          markedUnitId: unit.id,
          productId: unit.productId,
          toStatus: unit.status,
          reason: 'Сканирование при приёмке',
          actorId: params.actorId
        }
      });
      if (quarantined) {
        await tx.goodsReceiptDiscrepancy.create({
          data: {
            projectId: params.projectId,
            goodsReceiptId: receipt.id,
            markedUnitId: unit.id,
            type: 'EXTRA',
            message: `GTIN ${parsed.gtin} отсутствует в документе и каталоге`
          }
        });
        await tx.stockUnitHold.create({
          data: {
            projectId: params.projectId,
            markedUnitId: unit.id,
            source: 'RECEIVING',
            reason: `GTIN ${parsed.gtin} отсутствует в документе и каталоге`,
            openedBy: params.actorId
          }
        });
      }
      await tx.goodsReceipt.update({
        where: { id: receipt.id },
        data: { status: quarantined ? 'DISCREPANCY' : 'SCANNING' }
      });
      return { ...unit, codeHash: undefined, codeEncrypted: undefined };
    });
  }

  static async resolveDiscrepancy(params: {
    projectId: string;
    receiptId: string;
    discrepancyId: string;
    resolution:
      | 'ACCEPTED'
      | 'RETURN_TO_SUPPLIER'
      | 'CORRECTED_DOCUMENT'
      | 'WRITE_OFF'
      | 'IGNORED';
    comment?: string;
    actorId: string;
    productId?: string;
  }) {
    const discrepancy = await db.goodsReceiptDiscrepancy.findFirst({
      where: {
        id: params.discrepancyId,
        goodsReceiptId: params.receiptId,
        projectId: params.projectId
      },
      include: { markedUnit: true }
    });
    if (!discrepancy)
      throw new ReceivingConflictError('Расхождение не найдено');
    if (discrepancy.resolvedAt) return discrepancy;
    if (params.resolution === 'IGNORED' && discrepancy.markedUnitId) {
      throw new ReceivingConflictError(
        'Физическую упаковку нельзя просто проигнорировать — выберите решение'
      );
    }
    return db.$transaction(async (tx) => {
      const now = new Date();
      let unit = discrepancy.markedUnit;
      if (
        unit &&
        ['ACCEPTED', 'CORRECTED_DOCUMENT'].includes(params.resolution)
      ) {
        if ((!unit.productId || !unit.goodsReceiptItemId) && params.productId) {
          const product = await tx.product.findFirst({
            where: { id: params.productId, projectId: params.projectId }
          });
          if (!product || product.gtin !== unit.gtin) {
            throw new ReceivingConflictError(
              'Выбранный товар не найден или его GTIN не совпадает'
            );
          }
          let item = await tx.goodsReceiptItem.findFirst({
            where: {
              goodsReceiptId: params.receiptId,
              productId: product.id,
              gtin: unit.gtin
            }
          });
          item ??= await tx.goodsReceiptItem.create({
            data: {
              goodsReceiptId: params.receiptId,
              productId: product.id,
              name: product.name,
              gtin: unit.gtin,
              expectedQuantity: 1
            }
          });
          unit = await tx.markedUnit.update({
            where: { id: unit.id },
            data: {
              productId: product.id,
              goodsReceiptItemId: item.id
            }
          });
        }
        if (!unit.productId || !unit.goodsReceiptItemId) {
          throw new ReceivingConflictError(
            'Сначала сопоставьте упаковку с товаром каталога'
          );
        }
        await tx.markedUnit.update({
          where: { id: unit.id },
          data: { status: 'SCANNED', quarantinedAt: null }
        });
        await tx.stockUnitEvent.create({
          data: {
            projectId: params.projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            fromStatus: unit.status,
            toStatus: 'SCANNED',
            reason: 'Расхождение приёмки разрешено',
            actorId: params.actorId
          }
        });
      } else if (unit && params.resolution === 'RETURN_TO_SUPPLIER') {
        await tx.markedUnit.update({
          where: { id: unit.id },
          data: { status: 'RETURNED_TO_SUPPLIER' }
        });
        await tx.stockUnitEvent.create({
          data: {
            projectId: params.projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            fromStatus: unit.status,
            toStatus: 'RETURNED_TO_SUPPLIER',
            reason: params.comment || 'Возврат поставщику при приёмке',
            actorId: params.actorId
          }
        });
      } else if (unit && params.resolution === 'WRITE_OFF') {
        const document = await tx.complianceDocument.create({
          data: {
            projectId: params.projectId,
            kind: 'WRITE_OFF',
            reason: 'DAMAGE',
            status: 'DRAFT',
            provider: 'MANUAL',
            documentNumber: `WO-${Date.now()}`,
            idempotencyKey: `receiving-write-off:${discrepancy.id}`,
            createdBy: params.actorId,
            payload: {
              comment: params.comment ?? discrepancy.message,
              source: 'RECEIVING_DISCREPANCY'
            },
            units: {
              create: {
                markedUnitId: unit.id,
                previousStatus: unit.status
              }
            }
          }
        });
        await tx.markedUnit.update({
          where: { id: unit.id },
          data: { status: 'WRITE_OFF_PENDING' }
        });
        await tx.stockUnitHold.updateMany({
          where: { markedUnitId: unit.id, status: 'OPEN' },
          data: {
            status: 'PENDING_EXTERNAL',
            resolution: 'WRITE_OFF',
            resolutionComment: params.comment,
            complianceDocumentId: document.id
          }
        });
      }
      const resolved = await tx.goodsReceiptDiscrepancy.update({
        where: { id: discrepancy.id },
        data: {
          resolution: params.resolution,
          resolutionComment: params.comment,
          resolvedAt: now,
          resolvedBy: params.actorId
        }
      });
      if (unit && params.resolution !== 'WRITE_OFF') {
        await tx.stockUnitHold.updateMany({
          where: { markedUnitId: unit.id, status: 'OPEN' },
          data: {
            status: 'RESOLVED',
            resolution:
              params.resolution === 'RETURN_TO_SUPPLIER'
                ? 'RETURN_TO_SUPPLIER'
                : 'RELEASE_TO_STOCK',
            resolutionComment: params.comment,
            resolvedAt: now,
            resolvedBy: params.actorId
          }
        });
      }
      const unresolved = await tx.goodsReceiptDiscrepancy.count({
        where: { goodsReceiptId: params.receiptId, resolvedAt: null }
      });
      await tx.goodsReceipt.update({
        where: { id: params.receiptId },
        data: { status: unresolved ? 'DISCREPANCY' : 'SCANNING' }
      });
      return resolved;
    });
  }

  static async accept(params: {
    projectId: string;
    receiptId: string;
    actorId: string;
  }) {
    return db.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findFirst({
        where: { id: params.receiptId, projectId: params.projectId },
        include: {
          items: { include: { units: true } },
          discrepancies: { where: { resolvedAt: null } },
          complianceDocuments: {
            where: { kind: 'UPD_RECEIPT' },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      if (!receipt) throw new ReceivingConflictError('Приёмка не найдена');
      if (receipt.discrepancies.length) {
        throw new ReceivingConflictError(
          'Сначала разберите все расхождения и карантин'
        );
      }
      const quarantined = receipt.items.some((item) =>
        item.units.some((unit) => unit.status === 'QUARANTINED')
      );
      if (quarantined) {
        throw new ReceivingConflictError(
          'В приёмке остались упаковки в карантине'
        );
      }
      const signed = receipt.complianceDocuments.some(
        (document) => document.status === 'SUCCEEDED'
      );
      if (!signed) {
        const document =
          receipt.complianceDocuments.find((item) =>
            ['READY_TO_SIGN', 'SUBMITTED', 'PROCESSING'].includes(item.status)
          ) ??
          (await tx.complianceDocument.create({
            data: {
              projectId: params.projectId,
              goodsReceiptId: receipt.id,
              kind: 'UPD_RECEIPT',
              status: 'READY_TO_SIGN',
              provider: 'MANUAL',
              documentNumber: receipt.documentNumber,
              idempotencyKey: `upd-receipt:${receipt.id}`,
              createdBy: params.actorId,
              payload: { source: receipt.source }
            }
          }));
        await tx.goodsReceipt.update({
          where: { id: receipt.id },
          data: { status: 'ACCEPTANCE_PENDING' }
        });
        return { accepted: false, requiresSignature: true, document };
      }

      const expectedByLines = receipt.items.reduce(
        (sum, item) => sum + item.expectedQuantity,
        0
      );
      const metadata = (receipt.metadata ?? {}) as Record<string, unknown>;
      const expectedTotal =
        expectedByLines || Number(metadata.expectedUnits ?? 0);
      const scannedTotal = receipt.items.reduce(
        (sum, item) =>
          sum + item.units.filter((unit) => unit.status === 'SCANNED').length,
        0
      );
      if (expectedTotal > 0 && scannedTotal !== expectedTotal) {
        throw new ReceivingConflictError(
          `Отсканировано ${scannedTotal} из ${expectedTotal} ожидаемых упаковок`
        );
      }

      for (const item of receipt.items) {
        const eligible = item.units.filter((unit) => unit.status === 'SCANNED');
        if (
          item.expectedQuantity > 0 &&
          eligible.length !== item.expectedQuantity
        ) {
          throw new ReceivingConflictError(
            `По позиции «${item.name}» принято ${eligible.length} из ${item.expectedQuantity}`
          );
        }
        if (!item.productId && eligible.length) {
          throw new ReceivingConflictError(
            `Свяжите позицию «${item.name}» с товаром каталога`
          );
        }
        if (!eligible.length) continue;
        const now = new Date();
        await tx.markedUnit.updateMany({
          where: { id: { in: eligible.map((unit) => unit.id) } },
          data: { status: 'AVAILABLE', availableAt: now }
        });
        await tx.goodsReceiptItem.update({
          where: { id: item.id },
          data: { acceptedQuantity: eligible.length }
        });
        const product = await tx.product.update({
          where: { id: item.productId! },
          data: { stockOnHand: { increment: eligible.length } }
        });
        await tx.inventoryMovement.create({
          data: {
            projectId: params.projectId,
            productId: item.productId!,
            type: 'RECEIPT',
            quantity: eligible.length,
            balanceAfter: product.stockOnHand,
            reason: `Приёмка ${receipt.documentNumber}`,
            idempotencyKey: `receipt:${receipt.id}:${item.id}`,
            createdBy: params.actorId
          }
        });
        await tx.stockUnitEvent.createMany({
          data: eligible.map((unit) => ({
            projectId: params.projectId,
            markedUnitId: unit.id,
            productId: item.productId,
            fromStatus: unit.status,
            toStatus: 'AVAILABLE' as const,
            reason: `Принято по документу ${receipt.documentNumber}`,
            actorId: params.actorId
          }))
        });
      }
      const accepted = await tx.goodsReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedBy: params.actorId,
          externalStatus:
            receipt.complianceDocuments.find(
              (document) => document.status === 'SUCCEEDED'
            )?.provider === 'CUSTOM_GATEWAY'
              ? 'CONFIRMED_BY_EDO'
              : 'CONFIRMED_MANUALLY'
        }
      });
      return { accepted: true, requiresSignature: false, receipt: accepted };
    });
  }
}
