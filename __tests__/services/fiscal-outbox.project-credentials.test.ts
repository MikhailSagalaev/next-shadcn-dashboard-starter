import { db } from '@/lib/db';
import { MarkingService } from '@/lib/services/marking.service';
import { processFiscalOutboxBatch } from '@/lib/services/fiscal-outbox.service';
import { getActiveYooKassaFiscalIntegration } from '@/lib/services/yookassa-fiscal-integration.service';
import {
  createYooKassaReceipt,
  getMerchantYooKassaPayment
} from '@/lib/yookassa/client';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');
jest.mock('@/lib/services/yookassa-fiscal-integration.service');
jest.mock('@/lib/yookassa/client');

const mockDb = db as any;

describe('fiscal outbox project credentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.fiscalOutbox = mockDb.fiscalOutbox || {};
    mockDb.fiscalReceipt = mockDb.fiscalReceipt || {};
    mockDb.order = mockDb.order || {};
    mockDb.markedUnit = mockDb.markedUnit || {};

    mockDb.fiscalOutbox.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mockDb.fiscalOutbox.findMany = jest.fn().mockResolvedValue([
      {
        id: 'outbox-1',
        projectId: 'project-store-a',
        receiptId: 'receipt-1',
        type: 'CREATE_SETTLEMENT_RECEIPT',
        idempotencyKey: 'settlement:order-1',
        attemptCount: 0
      }
    ]);
    mockDb.fiscalOutbox.update = jest.fn().mockResolvedValue({});
    mockDb.fiscalReceipt.update = jest.fn().mockResolvedValue({});
    mockDb.fiscalReceipt.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'receipt-1',
      orderId: 'order-1'
    });
    mockDb.order.update = jest.fn().mockResolvedValue({});
    mockDb.markedUnit.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    mockDb.$transaction = jest.fn().mockResolvedValue([]);

    (getActiveYooKassaFiscalIntegration as jest.Mock).mockResolvedValue({
      integration: { projectId: 'project-store-a' },
      credentials: { shopId: 'store-a', secretKey: 'store-a-secret' }
    });
    jest.spyOn(MarkingService, 'buildSettlementPayload').mockResolvedValue({
      type: 'payment',
      payment_id: 'payment-a',
      customer: { email: 'buyer@example.com' },
      items: [],
      settlements: [
        {
          type: 'prepayment',
          amount: { value: '100.00', currency: 'RUB' }
        }
      ]
    });
    (getMerchantYooKassaPayment as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        id: 'payment-a',
        status: 'succeeded',
        paid: true,
        amount: { value: '100.00', currency: 'RUB' }
      }
    });
    (createYooKassaReceipt as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        id: 'provider-receipt-1',
        type: 'payment',
        status: 'succeeded',
        payment_id: 'payment-a'
      }
    });
  });

  it('loads credentials by outbox project and passes them to merchant APIs', async () => {
    await expect(processFiscalOutboxBatch(1)).resolves.toBe(1);

    const credentials = {
      shopId: 'store-a',
      secretKey: 'store-a-secret'
    };
    expect(getActiveYooKassaFiscalIntegration).toHaveBeenCalledWith(
      'project-store-a'
    );
    expect(getMerchantYooKassaPayment).toHaveBeenCalledWith(
      'payment-a',
      credentials
    );
    expect(createYooKassaReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: 'payment-a' }),
      'settlement:order-1',
      credentials
    );
  });
});
