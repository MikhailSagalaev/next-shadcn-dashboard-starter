import { db } from '@/lib/db';
import { OrderReleaseService } from '@/lib/services/order-release.service';

jest.mock('@/lib/db');

const mockDb = db as any;

describe('order release gate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps shipment blocked until both fiscalization and withdrawal succeed', async () => {
    const tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          paymentStatus: 'PAID',
          markingState: 'COMPLETE',
          withdrawalMode: 'GIS_MT_DISTANCE_SALE',
          withdrawalState: 'PENDING',
          fulfillmentState: 'BLOCKED',
          markedUnits: [{ id: 'unit-1', productId: 'product-1' }],
          fiscalReceipts: [],
          complianceDocuments: [{ id: 'document-1' }]
        })
      },
      markedUnit: { updateMany: jest.fn() },
      product: { update: jest.fn() },
      inventoryMovement: { upsert: jest.fn() }
    };
    mockDb.$transaction = jest.fn(async (callback) => callback(tx));

    const result = await OrderReleaseService.reconcile('project-1', 'order-1');

    expect(result.released).toBe(false);
    expect(tx.markedUnit.updateMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('releases the exact claimed package once the selected channel succeeds', async () => {
    const tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-2',
          paymentStatus: 'PAID',
          markingState: 'COMPLETE',
          withdrawalMode: 'KKT_MARKED_RECEIPT',
          withdrawalState: 'PENDING',
          fulfillmentState: 'BLOCKED',
          markedUnits: [
            {
              id: 'unit-2',
              productId: 'product-1',
              status: 'RESERVED'
            }
          ],
          fiscalReceipts: [{ id: 'receipt-1', includesMarkCodes: true }],
          complianceDocuments: []
        }),
        update: jest.fn().mockResolvedValue({
          id: 'order-2',
          fulfillmentState: 'READY_TO_SHIP'
        })
      },
      markedUnit: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      product: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'product-1',
          stockOnHand: 1,
          stockReserved: 1
        }),
        update: jest.fn().mockResolvedValue({
          id: 'product-1',
          stockOnHand: 0
        })
      },
      inventoryMovement: { upsert: jest.fn().mockResolvedValue({}) },
      stockUnitEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) }
    };
    mockDb.$transaction = jest.fn(async (callback) => callback(tx));

    const result = await OrderReleaseService.reconcile('project-1', 'order-2');

    expect(result.released).toBe(true);
    expect(tx.markedUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['unit-2'] } }),
        data: expect.objectContaining({ status: 'SOLD' })
      })
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          withdrawalState: 'SUCCEEDED',
          fulfillmentState: 'READY_TO_SHIP'
        })
      })
    );
  });
});
