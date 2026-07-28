import { db } from '@/lib/db';
import { MarkingService } from '@/lib/services/marking.service';
import { getActiveYooKassaFiscalIntegration } from '@/lib/services/yookassa-fiscal-integration.service';

jest.mock('@/lib/db');
jest.mock('@/lib/services/yookassa-fiscal-integration.service');

const mockDb = db as any;

describe('marking settlement queue state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getActiveYooKassaFiscalIntegration as jest.Mock).mockResolvedValue({
      integration: { projectId: 'project-1' },
      credentials: { shopId: 'shop-1', secretKey: 'secret' }
    });
    mockDb.order = mockDb.order || {};
    mockDb.order.findFirst = jest.fn().mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PAID',
      providerPaymentId: 'payment-1',
      markingState: 'COMPLETE',
      fiscalReceipts: [],
      items: [{ markingStatus: 'NOT_REQUIRED' }]
    });
    mockDb.complianceIntegration = {
      findUnique: jest.fn().mockResolvedValue({
        distanceSaleMode: 'UNCONFIGURED'
      })
    };
  });

  it('does not release an order for shipping before the receipt succeeds', async () => {
    const tx = {
      fiscalReceipt: {
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' })
      },
      fiscalOutbox: { create: jest.fn().mockResolvedValue({}) },
      order: { update: jest.fn().mockResolvedValue({}) }
    };
    mockDb.$transaction = jest.fn(async (callback) => callback(tx));

    await MarkingService.queueSettlement({
      projectId: 'project-1',
      orderId: 'order-1'
    });

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          fiscalState: 'SETTLEMENT_PENDING',
          withdrawalState: 'NOT_REQUIRED'
        })
      })
    );
  });
});
