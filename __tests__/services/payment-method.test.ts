import {
  isCashPaymentMethod,
  nonCashOrderWhere,
  normalizePaymentMethod
} from '@/lib/services/orders/payment-method';

describe('cash payment classification', () => {
  it.each(['cash', 'CASH', ' cash ', 'Наличные', ' НАЛИЧНЫЕ '])(
    'recognizes %p as cash',
    (value) => {
      expect(isCashPaymentMethod(value)).toBe(true);
      expect(normalizePaymentMethod(value)).toBe('cash');
    }
  );

  it.each(['card', 'yookassa', 'cashback', '', null, undefined])(
    'does not classify %p as cash',
    (value) => {
      expect(isCashPaymentMethod(value)).toBe(false);
    }
  );

  it('builds a filter that keeps null methods and excludes both cash aliases', () => {
    expect(nonCashOrderWhere()).toEqual({
      OR: [
        { paymentMethod: null },
        {
          AND: [
            {
              NOT: {
                paymentMethod: { equals: 'cash', mode: 'insensitive' }
              }
            },
            {
              NOT: {
                paymentMethod: { equals: 'наличные', mode: 'insensitive' }
              }
            }
          ]
        }
      ]
    });
  });
});
