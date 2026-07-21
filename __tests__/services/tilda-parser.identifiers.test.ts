import {
  TildaOrderValidationError,
  TildaPaymentIdRequiredError,
  TildaParserService
} from '@/lib/services/integration/tilda-parser.service';

describe('TildaParserService commercial identifiers', () => {
  it('exposes Tilda order and provider transaction identifiers separately', () => {
    const order = TildaParserService.normalizeOrder({
      payment: {
        amount: '500',
        orderid: 'ORDER-100',
        systranid: '2f3f15d0-000f-5000-9000-1e1d7d5f1234',
        sys: 'yakassa',
        products: [{ name: 'Cream', price: '500', quantity: '1' }]
      }
    });

    expect(order).toEqual(
      expect.objectContaining({
        orderId: 'ORDER-100',
        externalOrderId: 'ORDER-100',
        providerTransactionId: '2f3f15d0-000f-5000-9000-1e1d7d5f1234',
        paymentSystem: 'yakassa',
        isSignupForm: false
      })
    );
    expect(order.raw.payment.orderid).toBe('ORDER-100');
  });

  it('rejects a paid non-cash order without a stable Tilda orderid', () => {
    expect(() =>
      TildaParserService.normalizeOrder({
        payment: {
          amount: '500',
          systranid: 'payment-123',
          sys: 'yakassa',
          products: [{ name: 'Cream', price: '500', quantity: '1' }]
        }
      })
    ).toThrow(TildaOrderValidationError);
  });

  it('rejects a YooKassa order without systranid', () => {
    expect(() =>
      TildaParserService.normalizeOrder({
        payment: {
          amount: '500',
          orderid: 'ORDER-101',
          sys: 'yakassa',
          products: [{ name: 'Cream', price: '500', quantity: '1' }]
        }
      })
    ).toThrow(TildaPaymentIdRequiredError);
  });

  it('preserves signup-only forms without requiring a commercial orderid', () => {
    const order = TildaParserService.normalizeOrder({
      Email: 'NEW@EXAMPLE.COM',
      Name: 'New Customer',
      utm_ref: 'partner-42'
    });

    expect(order).toEqual(
      expect.objectContaining({
        email: 'new@example.com',
        externalOrderId: undefined,
        providerTransactionId: undefined,
        paymentSystem: undefined,
        isSignupForm: true
      })
    );
    expect(order.orderId).toMatch(/^tilda_gen_\d+$/);
  });

  it('preserves the existing generated identifier behavior for cash orders', () => {
    const order = TildaParserService.normalizeOrder({
      payment: {
        amount: '500',
        sys: 'cash',
        products: [{ name: 'Cream', price: '500', quantity: '1' }]
      }
    });

    expect(order.externalOrderId).toBeUndefined();
    expect(order.paymentSystem).toBe('cash');
    expect(order.orderId).toMatch(/^tilda_gen_\d+$/);
  });
});
