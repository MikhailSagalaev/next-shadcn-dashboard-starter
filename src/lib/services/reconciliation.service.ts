import { db } from '@/lib/db';
import { decryptIntegrationSecret } from '@/lib/integrations/credential-encryption';
import { decryptMarkCode } from '@/lib/marking/code-crypto';
import { getYooKassaReceipt } from '@/lib/yookassa/client';
import { getActiveYooKassaFiscalIntegration } from './yookassa-fiscal-integration.service';

function presentRun(run: any) {
  const summary = (run.summary ?? {}) as Record<string, unknown>;
  return {
    ...run,
    checkedCount: Number(summary.checkedCount ?? 0),
    discrepanciesCount: run.issues.length,
    discrepancies: run.issues.map((issue: any) => ({
      id: issue.id,
      type:
        issue.type === 'RECEIPT_STATUS_MISMATCH'
          ? 'FISCAL_MISMATCH'
          : issue.type === 'LOCAL_STOCK_MISMATCH'
            ? 'QUANTITY_MISMATCH'
            : issue.type,
      severity: ['GIS_MT_UNAVAILABLE', 'YOOKASSA_UNAVAILABLE'].includes(
        issue.type
      )
        ? 'MEDIUM'
        : 'HIGH',
      status: issue.resolvedAt ? 'RESOLVED' : 'OPEN',
      code: null,
      gtin: issue.markedUnit?.gtin,
      productName: issue.markedUnit?.product?.name,
      gupilStatus: (issue.expected as any)?.status,
      externalStatus: (issue.actual as any)?.status,
      source: issue.type.includes('GIS_MT') ? 'GIS_MT' : 'YOOKASSA_OFD',
      details: issue.message,
      orderId: issue.orderId,
      detectedAt: issue.createdAt
    }))
  };
}

export class ReconciliationService {
  static async list(projectId: string) {
    const runs = await db.reconciliationRun.findMany({
      where: { projectId },
      include: {
        issues: {
          include: {
            markedUnit: {
              include: { product: { select: { name: true } } }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });
    return runs.map(presentRun);
  }

  static async run(projectId: string, actorId: string) {
    const run = await db.reconciliationRun.create({
      data: { projectId, createdBy: actorId }
    });
    try {
      const [products, receipts, integration] = await Promise.all([
        db.product.findMany({
          where: {
            projectId,
            markingStatus: 'MARKED_REQUIRED',
            markedUnits: { some: {} }
          },
          select: {
            id: true,
            name: true,
            stockOnHand: true,
            markedUnits: {
              where: {
                status: {
                  in: ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'QUARANTINED']
                }
              },
              select: { id: true }
            }
          }
        }),
        db.fiscalReceipt.findMany({
          where: {
            projectId,
            providerReceiptId: { not: null },
            status: { in: ['PENDING', 'SUCCEEDED'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        db.complianceIntegration.findUnique({ where: { projectId } })
      ]);
      const issues: Array<any> = [];
      for (const product of products) {
        if (product.stockOnHand !== product.markedUnits.length) {
          issues.push({
            projectId,
            runId: run.id,
            type: 'LOCAL_STOCK_MISMATCH',
            message: `У товара «${product.name}» агрегат ${product.stockOnHand}, а в поштучном реестре ${product.markedUnits.length}`,
            expected: { quantity: product.stockOnHand },
            actual: { quantity: product.markedUnits.length }
          });
        }
      }

      try {
        const { credentials } =
          await getActiveYooKassaFiscalIntegration(projectId);
        for (const receipt of receipts) {
          const remote = await getYooKassaReceipt(
            receipt.providerReceiptId!,
            credentials
          );
          if ('status' in remote) {
            throw new Error(`ЮKassa ${remote.status}: ${remote.body}`);
          }
          const remoteStatus = remote.data.status.toUpperCase();
          const localStatus =
            receipt.status === 'CANCELED' ? 'CANCELED' : receipt.status;
          if (remoteStatus !== localStatus) {
            issues.push({
              projectId,
              runId: run.id,
              fiscalReceiptId: receipt.id,
              orderId: receipt.orderId,
              type: 'RECEIPT_STATUS_MISMATCH',
              message: `Статус чека в Gupil (${localStatus}) не совпадает с ЮKassa/ОФД (${remoteStatus})`,
              expected: { status: localStatus },
              actual: { status: remoteStatus }
            });
          }
        }
      } catch (error) {
        issues.push({
          projectId,
          runId: run.id,
          type: 'YOOKASSA_UNAVAILABLE',
          message:
            error instanceof Error
              ? `ЮKassa/ОФД недоступна для сверки: ${error.message}`
              : 'ЮKassa/ОФД недоступна для сверки'
        });
      }

      let gisChecked = false;
      if (
        integration?.isActive &&
        integration.provider === 'CUSTOM_GATEWAY' &&
        integration.gatewayUrl &&
        integration.credentialEncrypted
      ) {
        try {
          const localUnits = await db.markedUnit.findMany({
            where: { projectId, status: { not: 'VOID' } },
            select: {
              id: true,
              orderId: true,
              receiptId: true,
              gtin: true,
              status: true,
              codeEncrypted: true
            },
            take: 5000
          });
          const response = await fetch(integration.gatewayUrl, {
            method: 'POST',
            signal: AbortSignal.timeout(30_000),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${decryptIntegrationSecret(
                integration.credentialEncrypted
              )}`,
              'Idempotency-Key': `reconciliation:${run.id}`
            },
            body: JSON.stringify({
              kind: 'RECONCILIATION',
              runId: run.id,
              units: localUnits.map((unit) => ({
                localId: unit.id,
                code: decryptMarkCode(unit.codeEncrypted),
                gtin: unit.gtin,
                status: unit.status
              }))
            })
          });
          const body = (await response.json().catch(() => ({}))) as {
            status?: string;
            units?: Array<{ localId?: string; status?: string }>;
            error?: string;
          };
          if (
            !response.ok ||
            !['SUCCEEDED', 'COMPLETED'].includes(
              String(body.status ?? '').toUpperCase()
            ) ||
            !Array.isArray(body.units)
          ) {
            throw new Error(
              body.error ||
                `оператор не вернул поштучные статусы (HTTP ${response.status})`
            );
          }
          gisChecked = true;
          const externalById = new Map(
            body.units
              .filter((unit) => unit.localId)
              .map((unit) => [unit.localId!, unit.status ?? 'UNKNOWN'])
          );
          const expectedExternal: Record<string, string[]> = {
            AVAILABLE: ['IN_CIRCULATION', 'AVAILABLE'],
            RESERVED: ['IN_CIRCULATION', 'AVAILABLE', 'RESERVED'],
            ASSIGNED: ['IN_CIRCULATION', 'AVAILABLE', 'RESERVED'],
            SOLD: ['RETIRED', 'SOLD', 'WITHDRAWN'],
            WRITTEN_OFF: ['RETIRED', 'WRITTEN_OFF', 'WITHDRAWN'],
            QUARANTINED: ['IN_CIRCULATION', 'AVAILABLE', 'QUARANTINED'],
            RETURN_PENDING: ['RETIRED', 'SOLD', 'WITHDRAWN']
          };
          for (const unit of localUnits) {
            const actual = externalById.get(unit.id);
            const allowed = expectedExternal[unit.status] ?? [unit.status];
            if (!actual || !allowed.includes(actual.toUpperCase())) {
              issues.push({
                projectId,
                runId: run.id,
                markedUnitId: unit.id,
                orderId: unit.orderId,
                fiscalReceiptId: unit.receiptId,
                type: 'GIS_MT_STATUS_MISMATCH',
                message: actual
                  ? `Статус упаковки в Gupil (${unit.status}) не совпадает с ГИС МТ (${actual})`
                  : 'Оператор не вернул статус упаковки из ГИС МТ',
                expected: { status: unit.status, allowedExternal: allowed },
                actual: { status: actual ?? 'MISSING' }
              });
            }
          }
        } catch (error) {
          issues.push({
            projectId,
            runId: run.id,
            type: 'GIS_MT_UNAVAILABLE',
            message:
              error instanceof Error
                ? `ГИС МТ недоступна для сверки: ${error.message}`
                : 'ГИС МТ недоступна для сверки'
          });
        }
      }
      if (
        !gisChecked &&
        !issues.some((issue) => issue.type === 'GIS_MT_UNAVAILABLE')
      ) {
        issues.push({
          projectId,
          runId: run.id,
          type: 'GIS_MT_UNAVAILABLE',
          message:
            'ГИС МТ не проверена: подключите проектный шлюз оператора. Локальные данные и ЮKassa проверены отдельно.'
        });
      }
      if (issues.length) {
        await db.reconciliationIssue.createMany({ data: issues });
      }
      const blocking = issues.filter(
        (issue) =>
          !['GIS_MT_UNAVAILABLE', 'YOOKASSA_UNAVAILABLE'].includes(issue.type)
      ).length;
      const partial = issues.some((issue) =>
        ['GIS_MT_UNAVAILABLE', 'YOOKASSA_UNAVAILABLE'].includes(issue.type)
      );
      await db.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: blocking ? 'MISMATCH' : partial ? 'PARTIAL' : 'MATCHED',
          completedAt: new Date(),
          summary: {
            checkedCount:
              products.reduce(
                (sum, product) => sum + product.markedUnits.length,
                0
              ) + receipts.length,
            productsChecked: products.length,
            fiscalReceiptsChecked: receipts.length,
            issues: issues.length
          }
        }
      });
      const completed = await db.reconciliationRun.findUniqueOrThrow({
        where: { id: run.id },
        include: {
          issues: {
            include: {
              markedUnit: {
                include: { product: { select: { name: true } } }
              }
            }
          }
        }
      });
      return presentRun(completed);
    } catch (error) {
      await db.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }
}
