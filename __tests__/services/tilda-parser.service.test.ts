import { TildaParserService } from '@/lib/services/integration/tilda-parser.service';

describe('TildaParserService.normalizeOrder', () => {
  it('normalizes product title when Tilda omits name', () => {
    const order = TildaParserService.normalizeOrder({
      payment: {
        amount: '500',
        orderid: 'tilda-1',
        products: [{ title: 'Доставка', price: '0', quantity: '1' }]
      }
    });

    expect(order.products[0]).toEqual(
      expect.objectContaining({ name: 'Доставка', price: 0, quantity: 1 })
    );
  });

  it('uses a safe fallback when a product has no identifying fields', () => {
    const order = TildaParserService.normalizeOrder({
      payment: {
        amount: '500',
        orderid: 'tilda-2',
        products: [{ price: '0', quantity: '1' }]
      }
    });

    expect(order.products[0]?.name).toBe('Товар из заказа');
  });
});
