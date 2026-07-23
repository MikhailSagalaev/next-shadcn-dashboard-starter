import { db } from '@/lib/db';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret
} from '@/lib/integrations/credential-encryption';
import { decryptMarkCode, hashMarkCode } from '@/lib/marking/code-crypto';
import { parseGs1DataMatrix } from '@/lib/marking/gs1';
import type { ComplianceProvider, WriteOffReason } from '@prisma/client';

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
      ? { ...integration, credentialEncrypted: undefined, hasCredential: true }
      : null;
  }

  static async saveIntegration(params: {
    projectId: string;
    provider: ComplianceProvider;
    isActive: boolean;
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
        gatewayUrl,
        credentialEncrypted
      },
      update: {
        provider: params.provider,
        isActive: params.isActive,
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
          createdBy: params.actorId,
          payload: { comment: params.comment ?? null },
          units: {
            create: units.map((unit) => ({ markedUnitId: unit.id }))
          }
        },
        include: { _count: { select: { units: true } } }
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
          provider: integration?.provider ?? 'MANUAL',
          lastError:
            'Документ подготовлен. Подпишите его УКЭП и отправьте через оператора ЭДО/ГИС МТ.'
        }
      });
    }

    const response = await fetch(integration.gatewayUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${decryptIntegrationSecret(
          integration.credentialEncrypted
        )}`,
        'Idempotency-Key': `write-off:${document.id}`
      },
      body: JSON.stringify({
        kind: 'WRITE_OFF',
        documentId: document.id,
        documentNumber: document.documentNumber,
        reason: document.reason,
        codes: document.units.map(({ markedUnit }) =>
          decryptMarkCode(markedUnit.codeEncrypted)
        )
      })
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      return db.complianceDocument.update({
        where: { id: document.id },
        data: {
          status: 'FAILED',
          lastError: String(body.error ?? `Gateway HTTP ${response.status}`),
          responsePayload: body as any
        }
      });
    }
    const succeeded = ['SUCCEEDED', 'ACCEPTED'].includes(
      String(body.status ?? '').toUpperCase()
    );
    if (succeeded) return this.completeWriteOff(document.id, body);
    return db.complianceDocument.update({
      where: { id: document.id },
      data: {
        status: 'SUBMITTED',
        externalId: body.id ? String(body.id) : null,
        submittedAt: new Date(),
        responsePayload: body as any,
        lastError: null
      }
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
      for (const { markedUnit: unit } of document.units) {
        if (unit.productId && unit.status !== 'QUARANTINED') {
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
