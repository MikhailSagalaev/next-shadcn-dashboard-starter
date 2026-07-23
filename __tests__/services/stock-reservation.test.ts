import { db } from '@/lib/db';
import { StockReservationService } from '@/lib/services/stock-reservation.service';

jest.mock('@/lib/db');

const mockDb = db as any;

describe('specific marked-unit reservation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reserves the oldest available package for the paid order item', async () => {
    const tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: '1001',
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              name: 'Marked serum',
              quantity: 1,
              gtin: '04601234567890',
              markingStatus: 'MARKED_REQUIRED'
            }
          ],
          markedUnits: []
        }),
        update: jest.fn().mockResolvedValue({})
      },
      inventoryMovement: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
      },
      product: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ stockOnHand: 1, stockReserved: 0 }),
        update: jest.fn().mockResolvedValue({})
      },
      markedUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'unit-oldest',
            productId: 'product-1',
            status: 'AVAILABLE'
          }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      stockUnitEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) }
    };
    mockDb.$transaction = jest.fn(async (callback) => callback(tx));

    const result = await StockReservationService.reserveOrder(
      'project-1',
      'order-1',
      'system:tilda'
    );

    expect(result).toEqual([
      { orderItemId: 'item-1', unitIds: ['unit-oldest'] }
    ]);
    expect(tx.markedUnit.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['unit-oldest'] },
        status: 'AVAILABLE',
        orderId: null
      },
      data: expect.objectContaining({
        status: 'RESERVED',
        orderId: 'order-1',
        orderItemId: 'item-1'
      })
    });
  });
});
