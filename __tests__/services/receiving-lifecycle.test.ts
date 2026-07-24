import { db } from '@/lib/db';
import { ReceivingService } from '@/lib/services/receiving.service';

jest.mock('@/lib/db');

const mockDb = db as any;

describe('receiving lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('validates a manually entered Data Matrix without changing stock', async () => {
    mockDb.goodsReceipt = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'receipt-1',
        items: [
          {
            id: 'item-1',
            name: 'Marked cream',
            gtin: '04601234567890'
          }
        ]
      })
    };

    const result = await ReceivingService.validateCode({
      projectId: 'project-1',
      receiptId: 'receipt-1',
      code: '(01)04601234567890(21)TEST123'
    });

    expect(result).toEqual(
      expect.objectContaining({
        gtin: '04601234567890',
        serial: 'TEST123',
        productName: 'Marked cream'
      })
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('does not release units to available stock before the UPD is confirmed', async () => {
    const tx = {
      goodsReceipt: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'receipt-1',
          projectId: 'project-1',
          documentNumber: 'UPD-1',
          source: 'MANUAL',
          status: 'SCANNING',
          metadata: { expectedUnits: 1 },
          items: [
            {
              id: 'item-1',
              name: 'Marked cream',
              productId: 'product-1',
              expectedQuantity: 0,
              units: [{ id: 'unit-1', status: 'SCANNED' }]
            }
          ],
          discrepancies: [],
          complianceDocuments: []
        }),
        update: jest.fn().mockResolvedValue({})
      },
      complianceDocument: {
        create: jest.fn().mockResolvedValue({
          id: 'document-1',
          status: 'READY_TO_SIGN'
        })
      },
      markedUnit: { updateMany: jest.fn() },
      product: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() }
    };
    mockDb.$transaction = jest.fn(async (callback) => callback(tx));

    const result = await ReceivingService.accept({
      projectId: 'project-1',
      receiptId: 'receipt-1',
      actorId: 'admin-1'
    });

    expect(result).toEqual(
      expect.objectContaining({ accepted: false, requiresSignature: true })
    );
    expect(tx.complianceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'READY_TO_SIGN' })
      })
    );
    expect(tx.markedUnit.updateMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
