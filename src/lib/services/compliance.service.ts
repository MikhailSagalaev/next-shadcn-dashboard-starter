import { db } from '@/lib/db';
import { encryptIntegrationSecret } from '@/lib/integrations/credential-encryption';
import { hashMarkCode } from '@/lib/marking/code-crypto';
import { parseGs1DataMatrix } from '@/lib/marking/gs1';
import type {
  ComplianceProvider,
  DistanceSaleMode,
  WriteOffReason
} from '@prisma/client';

export class ComplianceConflictError extends Error {}

const reasonAliases: Record<string, WriteOffReason> = {
  DAMAGED: 'DAMAGE',
  LOST: 'LOSS',
  DESTROYED: 'DESTRUCTION'
};

function validateGatewayUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ComplianceConflictError('Для шлюза нужен корректный HTTPS-адрес');
  }
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (url.protocol !== 'https:' || privateHost) {
    throw new ComplianceConflictError(
      'Шлюз должен иметь публичный HTTPS-адрес'
    );
  }
  return url.toString();
}

export class ComplianceService {
  static async getIntegration(projectId: string) {
    const integration = await db.complianceIntegration.findUnique({
      where: { projectId }
    });
    return integration
      ? {
          ...integration,
          credentialEncrypted: undefined,
          hasCredential: Boolean(integration.credentialEncrypted)
        }
      : null;
  }

  static async saveIntegration(params: {
    projectId: string;
    provider: ComplianceProvider;
    isActive: boolean;
    distanceSaleMode: DistanceSaleMode;
    gatewayUrl?: string;
    credential?: string;
  }) {
    const gatewayUrl =
      params.provider === 'CUSTOM_GATEWAY'
        ? validateGatewayUrl(params.gatewayUrl || '')
        : undefined;
    const current = await db.complianceIntegration.findUnique({
      where: { projectId: params.projectId }
    });
    const credentialEncrypted = params.credential
      ? encryptIntegrationSecret(params.credential)
      : current?.credentialEncrypted;
    if (
      params.provider === 'CUSTOM_GATEWAY' &&
      params.isActive &&
      !credentialEncrypted
    ) {
      throw new ComplianceConflictError('Укажите ключ доступа к шлюзу');
    }
    const integration = await db.complianceIntegration.upsert({
      where: { projectId: params.projectId },
      create: {
        projectId: params.projectId,
        provider: params.provider,
        isActive: params.isActive,
        distanceSaleMode: params.distanceSaleMode,
        gatewayUrl,
        credentialEncrypted
      },
      update: {
        provider: params.provider,
        isActive: params.isActive,
        distanceSaleMode: params.distanceSaleMode,
        gatewayUrl,
        ...(params.credential ? { credentialEncrypted } : {})
      }
    });
    return {
      ...integration,
      credentialEncrypted: undefined,
      hasCredential: Boolean(credentialEncrypted)
    };
  }

  static async listWriteOffs(projectId: string) {
    const documents = await db.complianceDocument.findMany({
      where: { projectId, kind: 'WRITE_OFF' },
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return documents.map((document) => {
      const payload = (document.payload ?? {}) as Record<string, unknown>;
      const uiReason =
        document.reason === 'DAMAGE'
          ? 'DAMAGED'
          : document.reason === 'LOSS'
            ? 'LOST'
            : document.reason === 'DESTRUCTION'
              ? 'DESTROYED'
              : document.reason;
      return {
        id: document.id,
        number: document.documentNumber,
        reason: uiReason,
        status:
          document.status === 'SUCCEEDED'
            ? 'ACCEPTED'
            : document.status === 'READY_TO_SIGN'
              ? 'READY'
              : ['SUBMITTED', 'PROCESSING'].includes(document.status)
                ? 'SUBMITTING'
                : document.status,
        codesCount: document._count.units,
        createdAt: document.createdAt,
        submittedAt: document.submittedAt,
        comment: payload.comment,
        error: document.lastError
      };
    });
  }

  static async createWriteOff(params: {
    projectId: string;
    reason: string;
    comment?: string | null;
    codes: string[];
    actorId: string;
  }) {
    const reason = (reasonAliases[params.reason] ??
      params.reason) as WriteOffReason;
    const allowed: WriteOffReason[] = [
      'DAMAGE',
      'LOSS',
      'DESTRUCTION',
      'EXPIRED',
      'OWN_USE',
      'PRODUCTION_USE',
      'OTHER'
    ];
    if (!allowed.includes(reason))
      throw new ComplianceConflictError('Неизвестная причина списания');
    const hashes = params.codes.map((code) => {
      try {
        return hashMarkCode(parseGs1DataMatrix(code).raw);
      } catch {
        throw new ComplianceConflictError(
          'Один из Data Matrix не распознан. Сканируйте полный код упаковки'
        );
      }
    });
    if (new Set(hashes).size !== hashes.length)
      throw new ComplianceConflictError('В списке есть повторяющиеся коды');
    const units = await db.markedUnit.findMany({
      where: {
        projectId: params.projectId,
        codeHash: { in: hashes },
        status: { in: ['AVAILABLE', 'QUARANTINED', 'RETURNED'] }
      }
    });
    if (units.length !== hashes.length) {
      throw new ComplianceConflictError(
        'Часть кодов отсутствует на складе, зарезервирована или уже выбыла'
      );
    }
    return db.$transaction(async (tx) => {
      const document = await tx.complianceDocument.create({
        data: {
          projectId: params.projectId,
          kind: 'WRITE_OFF',
          status: 'DRAFT',
          reason,
          documentNumber: `WO-${Date.now()}`,
          idempotencyKey: `write-off:${params.projectId}:${Date.now()}`,
          createdBy: params.actorId,
          payload: { comment: params.comment ?? null },
          units: {
            create: units.map((unit) => ({
              markedUnitId: unit.id,
              previousStatus: unit.status
            }))
          }
        },
        include: { _count: { select: { units: true } } }
      });
      await tx.markedUnit.updateMany({
        where: { id: { in: units.map((unit) => unit.id) } },
        data: { status: 'WRITE_OFF_PENDING' }
      });
      await tx.stockUnitEvent.createMany({
        data: units.map((unit) => ({
          projectId: params.projectId,
          markedUnitId: unit.id,
          productId: unit.productId,
          fromStatus: unit.status,
          toStatus: 'WRITE_OFF_PENDING' as const,
          reason: `Добавлено в документ ${document.documentNumber}`,
          actorId: params.actorId
        }))
      });
      return document;
    });
  }

  static async submitWriteOff(projectId: string, documentId: string) {
    const document = await db.complianceDocument.findFirst({
      where: { id: documentId, projectId, kind: 'WRITE_OFF' },
      include: { units: { include: { markedUnit: true } } }
    });
    if (!document)
      throw new ComplianceConflictError('Документ списания не найден');
    if (document.status === 'SUCCEEDED') return document;
    const integration = await db.complianceIntegration.findUnique({
      where: { projectId }
    });
    if (
      !integration?.isActive ||
      integration.provider === 'MANUAL' ||
      !integration.gatewayUrl ||
      !integration.credentialEncrypted
    ) {
      return db.complianceDocument.update({
        where: { id: document.id },
        data: {
          status: 'READY_TO_SIGN',
          provider: 'MANUAL',
          lastError:
            'Документ подготовлен. Подпишите его УКЭП и отправьте через оператора ЭДО/ГИС МТ.'
        }
      });
    }

    return db.$transaction(async (tx) => {
      await tx.complianceOutbox.upsert({
        where: { idempotencyKey: `write-off:${document.id}` },
        create: {
          projectId,
          documentId: document.id,
          type: 'SUBMIT_DOCUMENT',
          idempotencyKey: `write-off:${document.id}`,
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
      return tx.complianceDocument.update({
        where: { id: document.id },
        data: {
          status: 'SUBMITTED',
          provider: integration.provider,
          submittedAt: document.submittedAt ?? new Date(),
          lastError: null
        }
      });
    });
  }

  static async completeWriteOff(
    documentId: string,
    responsePayload: Record<string, unknown>
  ) {
    return db.$transaction(async (tx) => {
      const document = await tx.complianceDocument.findUnique({
        where: { id: documentId },
        include: { units: { include: { markedUnit: true } } }
      });
      if (!document) throw new ComplianceConflictError('Документ не найден');
      if (document.status === 'SUCCEEDED') return document;
      const now = new Date();
      for (const { markedUnit: unit, previousStatus } of document.units) {
        if (unit.productId && previousStatus === 'AVAILABLE') {
          const product = await tx.product.update({
            where: { id: unit.productId },
            data: { stockOnHand: { decrement: 1 } }
          });
          await tx.inventoryMovement.create({
            data: {
              projectId: document.projectId,
              productId: unit.productId,
              type: 'WRITE_OFF',
              quantity: -1,
              balanceAfter: product.stockOnHand,
              reason: `Документ ${document.documentNumber}`,
              idempotencyKey: `write-off:${document.id}:${unit.id}`
            }
          });
        }
        await tx.markedUnit.update({
          where: { id: unit.id },
          data: { status: 'WRITTEN_OFF', writtenOffAt: now }
        });
        await tx.stockUnitEvent.create({
          data: {
            projectId: document.projectId,
            markedUnitId: unit.id,
            productId: unit.productId,
            fromStatus: unit.status,
            toStatus: 'WRITTEN_OFF',
            reason: `Подтверждено ГИС МТ: ${document.documentNumber}`
          }
        });
      }
      await tx.stockUnitHold.updateMany({
        where: {
          complianceDocumentId: document.id,
          status: { in: ['OPEN', 'PENDING_EXTERNAL'] }
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
          succeededAt: now,
          submittedAt: document.submittedAt ?? now,
          responsePayload: responsePayload as any,
          externalId: responsePayload.id
            ? String(responsePayload.id)
            : document.externalId,
          lastError: null
        }
      });
    });
  }
}
