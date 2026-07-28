import { db } from '@/lib/db';
import { encryptMarkCode, hashMarkCode } from '@/lib/marking/code-crypto';
import { parseGs1DataMatrix } from '@/lib/marking/gs1';
import type {
  ComplianceDocumentKind,
  StockUnitHoldResolution,
  WriteOffReason
} from '@prisma/client';

export class StockUnitResolutionConflictError extends Error {}

type ResolveAction =
  | 'RELEASE_TO_STOCK'
  | 'RETURN_TO_SUPPLIER'
  | 'WRITE_OFF'
  | 'REMARK';

function kindFor(action: ResolveAction): ComplianceDocumentKind {
  if (action === 'RELEASE_TO_STOCK') return 'RETURN_TO_CIRCULATION';
  if (action === 'RETURN_TO_SUPPLIER') return 'RETURN_TO_SUPPLIER';
  if (action === 'REMARK') return 'REMARKING';
  return 'WRITE_OFF';
}

export class StockUnitResolutionService {
  static async resolve(params: {
    projectId: string;
    unitId: string;
    action: ResolveAction;
    comment: string;
    actorId: string;
    newCode?: string;
    writeOffReason?: WriteOffReason;
  }) {
    const [unit, integration] = await Promise.all([
      db.markedUnit.findFirst({
        where: {
          id: params.unitId,
          projectId: params.projectId,
          status: 'QUARANTINED'
        },
        include: {
          holds: {
            where: { status: { in: ['OPEN', 'PENDING_EXTERNAL'] } },
            orderBy: { openedAt: 'desc' },
            take: 1
          }
        }
      }),
      db.complianceIntegration.findUnique({
        where: { projectId: params.projectId }
      })
    ]);
    if (!unit) {
      throw new StockUnitResolutionConflictError(
        'Упаковка не найдена или уже вышла из карантина'
      );
    }
    if (!params.comment.trim()) {
      throw new StockUnitResolutionConflictError(
        'Укажите результат проверки и основание решения'
      );
    }

    let replacement:
      | {
          raw: string;
          gtin: string;
          serial: string;
          hash: string;
        }
      | undefined;
    if (params.action === 'REMARK') {
      if (!params.newCode) {
        throw new StockUnitResolutionConflictError(
          'Отсканируйте новый Data Matrix'
        );
      }
      let parsed: ReturnType<typeof parseGs1DataMatrix>;
      try {
        parsed = parseGs1DataMatrix(params.newCode);
      } catch {
        throw new StockUnitResolutionConflictError(
          'Новый Data Matrix не распознан. Отсканируйте полный код упаковки'
        );
      }
      if (parsed.gtin !== unit.gtin) {
        throw new StockUnitResolutionConflictError(
          `GTIN нового кода ${parsed.gtin} не совпадает с упаковкой ${unit.gtin}`
        );
      }
      const hash = hashMarkCode(parsed.raw);
      const duplicate = await db.markedUnit.findUnique({
        where: { codeHash: hash }
      });
      if (duplicate) {
        throw new StockUnitResolutionConflictError(
          'Новый Data Matrix уже используется'
        );
      }
      replacement = {
        raw: parsed.raw,
        gtin: parsed.gtin,
        serial: parsed.serial,
        hash
      };
    }

    return db.$transaction(async (tx) => {
      const documentNumber = `${kindFor(params.action).slice(0, 3)}-${Date.now()}`;
      let replacementUnitId: string | undefined;
      if (replacement) {
        const next = await tx.markedUnit.create({
          data: {
            projectId: params.projectId,
            productId: unit.productId,
            codeHash: replacement.hash,
            codeEncrypted: encryptMarkCode(replacement.raw),
            gtin: replacement.gtin,
            serial: replacement.serial,
            status: 'QUARANTINED',
            scannedBy: params.actorId,
            quarantinedAt: new Date(),
            metadata: {
              replacesUnitId: unit.id,
              reason: params.comment
            }
          }
        });
        replacementUnitId = next.id;
      }

      const kind = kindFor(params.action);
      const useGateway =
        integration?.isActive &&
        integration.provider === 'CUSTOM_GATEWAY' &&
        integration.gatewayUrl &&
        integration.credentialEncrypted;
      const document = await tx.complianceDocument.create({
        data: {
          projectId: params.projectId,
          kind,
          status: useGateway ? 'SUBMITTED' : 'READY_TO_SIGN',
          provider: useGateway ? 'CUSTOM_GATEWAY' : 'MANUAL',
          reason:
            kind === 'WRITE_OFF'
              ? (params.writeOffReason ?? 'DAMAGE')
              : undefined,
          documentNumber,
          idempotencyKey: `stock-resolution:${unit.id}:${params.action}`,
          createdBy: params.actorId,
          submittedAt: useGateway ? new Date() : null,
          lastError: useGateway
            ? null
            : 'Документ подготовлен. Подпишите и отправьте его у оператора, затем подтвердите результат.',
          payload: {
            action: params.action,
            comment: params.comment,
            oldUnitId: unit.id,
            newUnitId: replacementUnitId ?? null
          },
          units: {
            create: [
              { markedUnitId: unit.id, previousStatus: unit.status },
              ...(replacementUnitId
                ? [
                    {
                      markedUnitId: replacementUnitId,
                      previousStatus: 'QUARANTINED' as const
                    }
                  ]
                : [])
            ]
          }
        }
      });
      await tx.markedUnit.update({
        where: { id: unit.id },
        data: {
          status:
            params.action === 'WRITE_OFF' ? 'WRITE_OFF_PENDING' : 'QUARANTINED'
        }
      });
      const hold =
        unit.holds[0] ??
        (await tx.stockUnitHold.create({
          data: {
            projectId: params.projectId,
            markedUnitId: unit.id,
            source: 'MANUAL_REVIEW',
            reason: params.comment,
            openedBy: params.actorId
          }
        }));
      await tx.stockUnitHold.update({
        where: { id: hold.id },
        data: {
          status: 'PENDING_EXTERNAL',
          resolution: params.action as StockUnitHoldResolution,
          resolutionComment: params.comment,
          complianceDocumentId: document.id
        }
      });
      if (useGateway) {
        await tx.complianceOutbox.create({
          data: {
            projectId: params.projectId,
            documentId: document.id,
            type: 'SUBMIT_DOCUMENT',
            idempotencyKey: `stock-resolution:${document.id}`,
            payload: { documentId: document.id }
          }
        });
      }
      return { document, replacementUnitId };
    });
  }
}
