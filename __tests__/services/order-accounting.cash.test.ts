import { db } from '@/lib/db';
import { OrderAccountingService } from '@/lib/services/orders/order-accounting.service';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

describe('OrderAccountingService cash guard', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb as any).order = (mockDb as any).order || {};
    (mockDb as any).orderHistory = (mockDb as any).orderHistory || {};
    mockDb.order.findFirst = jest.fn().mockResolvedValue({
      id: 'cash-order',
      projectId: 'project-1',
      status: 'PENDING',
      accountingState: 'NOT_APPLIED',
      paymentMethod: 'cash'
    } as any);
    mockDb.order.update = jest.fn().mockResolvedValue({} as any);
    mockDb.orderHistory.create = jest.fn().mockResolvedValue({} as any);
    mockDb.order.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'cash-order',
      status: 'CONFIRMED',
      accountingState: 'NOT_APPLIED',
      paymentMethod: 'cash'
    } as any);
    mockDb.$transaction = jest.fn().mockResolvedValue([] as any);
  });

  it('allows operational confirmation without applying purchase effects', async () => {
    const result = await OrderAccountingService.transition(
      'project-1',
      'cash-order',
      { status: 'CONFIRMED', changedBy: 'admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'CONFIRMED',
        accountingState: 'NOT_APPLIED'
      })
    );
    expect(mockDb.order.update).toHaveBeenCalledWith({
      where: { id: 'cash-order' },
      data: { status: 'CONFIRMED' }
    });
    expect(mockDb.orderHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { accountingExcluded: true, reason: 'cash_payment' }
        })
      })
    );
  });
});
