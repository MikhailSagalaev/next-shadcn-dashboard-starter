import { db } from '@/lib/db';
import { ComplianceGatewayService } from '@/lib/services/compliance-gateway.service';
import { MarkingService } from '@/lib/services/marking.service';
import { OrderDisposalService } from '@/lib/services/order-disposal.service';

jest.mock('@/lib/db');

const mockDb = db as any;

describe('order disposal mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.order = {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({})
    };
    mockDb.complianceIntegration = { findUnique: jest.fn() };
  });

  it('uses only the marked KKT receipt in KKT mode', async () => {
    mockDb.order.findFirst.mockResolvedValue({
      id: 'order-1',
      withdrawalMode: 'KKT_MARKED_RECEIPT',
      withdrawalState: 'NOT_STARTED',
      items: [{ markingStatus: 'MARKED_REQUIRED' }],
      _count: {
        markedUnits: 1,
        fiscalReceipts: 0,
        complianceDocuments: 0
      }
    });
    mockDb.complianceIntegration.findUnique.mockResolvedValue({
      distanceSaleMode: 'KKT_MARKED_RECEIPT'
    });
    const queue = jest
      .spyOn(MarkingService, 'queueSettlement')
      .mockResolvedValue({ id: 'receipt-1' } as any);
    const distanceSale = jest.spyOn(
      ComplianceGatewayService,
      'createDistanceSale'
    );

    const result = await OrderDisposalService.completeSale({
      projectId: 'project-1',
      orderId: 'order-1',
      actorId: 'admin-1'
    });

    expect(result.mode).toBe('KKT_MARKED_RECEIPT');
    expect(queue).toHaveBeenCalledWith({
      projectId: 'project-1',
      orderId: 'order-1'
    });
    expect(distanceSale).not.toHaveBeenCalled();
  });

  it('creates a GIS MT document and a receipt without duplicate code transfer', async () => {
    mockDb.order.findFirst.mockResolvedValue({
      id: 'order-2',
      withdrawalMode: 'GIS_MT_DISTANCE_SALE',
      withdrawalState: 'NOT_STARTED',
      items: [{ markingStatus: 'MARKED_REQUIRED' }],
      _count: {
        markedUnits: 1,
        fiscalReceipts: 0,
        complianceDocuments: 0
      }
    });
    mockDb.complianceIntegration.findUnique.mockResolvedValue({
      distanceSaleMode: 'GIS_MT_DISTANCE_SALE'
    });
    const distanceSale = jest
      .spyOn(ComplianceGatewayService, 'createDistanceSale')
      .mockResolvedValue({ id: 'document-1' } as any);
    const queue = jest
      .spyOn(MarkingService, 'queueSettlement')
      .mockResolvedValue({ id: 'receipt-2' } as any);

    const result = await OrderDisposalService.completeSale({
      projectId: 'project-1',
      orderId: 'order-2',
      actorId: 'admin-1'
    });

    expect(result.mode).toBe('GIS_MT_DISTANCE_SALE');
    expect(distanceSale).toHaveBeenCalled();
    expect(queue).toHaveBeenCalledWith({
      projectId: 'project-1',
      orderId: 'order-2',
      allowGisMtMode: true
    });
  });
});
