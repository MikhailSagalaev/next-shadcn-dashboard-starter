import { db } from '@/lib/db';
import { ComplianceGatewayService } from './compliance-gateway.service';
import { MarkingService } from './marking.service';

export class OrderDisposalConflictError extends Error {}

export class OrderDisposalService {
  static async completeSale(params: {
    projectId: string;
    orderId: string;
    actorId: string;
  }) {
    const [order, integration] = await Promise.all([
      db.order.findFirst({
        where: { id: params.orderId, projectId: params.projectId },
        include: {
          _count: {
            select: {
              markedUnits: true,
              fiscalReceipts: true,
              complianceDocuments: true
            }
          },
          items: { select: { markingStatus: true } }
        }
      }),
      db.complianceIntegration.findUnique({
        where: { projectId: params.projectId }
      })
    ]);
    if (!order) throw new OrderDisposalConflictError('Заказ не найден');
    const hasMarkedItems = order.items.some(
      (item) => item.markingStatus === 'MARKED_REQUIRED'
    );
    if (!hasMarkedItems) {
      const receipt = await MarkingService.queueSettlement({
        projectId: params.projectId,
        orderId: params.orderId
      });
      return { mode: 'NOT_REQUIRED', receipt, document: null };
    }

    const configuredMode = integration?.distanceSaleMode ?? 'UNCONFIGURED';
    const workflowStarted =
      order._count.markedUnits > 0 ||
      order._count.fiscalReceipts > 0 ||
      order._count.complianceDocuments > 0;
    const mode =
      workflowStarted && order.withdrawalMode !== 'UNCONFIGURED'
        ? order.withdrawalMode
        : configuredMode;
    if (mode === 'UNCONFIGURED') {
      throw new OrderDisposalConflictError(
        'Выберите способ вывода Data Matrix в настройках ЭДО/ГИС МТ'
      );
    }
    if (
      workflowStarted &&
      order.withdrawalMode !== 'UNCONFIGURED' &&
      configuredMode !== 'UNCONFIGURED' &&
      order.withdrawalMode !== configuredMode
    ) {
      throw new OrderDisposalConflictError(
        'Схема этого заказа уже зафиксирована и отличается от текущей настройки проекта. Завершите заказ по сохранённой схеме.'
      );
    }
    await db.order.update({
      where: { id: order.id },
      data: {
        withdrawalMode: mode,
        withdrawalState:
          order.withdrawalState === 'FAILED' ? 'NOT_STARTED' : undefined
      }
    });

    if (mode === 'KKT_MARKED_RECEIPT') {
      const receipt = await MarkingService.queueSettlement({
        projectId: params.projectId,
        orderId: params.orderId
      });
      return { mode, receipt, document: null };
    }

    const document = await ComplianceGatewayService.createDistanceSale(params);
    const receipt = await MarkingService.queueSettlement({
      projectId: params.projectId,
      orderId: params.orderId,
      allowGisMtMode: true
    });
    return { mode, receipt, document };
  }
}
