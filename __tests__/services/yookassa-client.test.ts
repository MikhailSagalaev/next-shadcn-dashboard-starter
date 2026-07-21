import {
  createYooKassaPayment,
  createYooKassaReceipt,
  createYooKassaRefund,
  getYooKassaPayment,
  getYooKassaReceipt,
  getYooKassaRefund,
  listYooKassaReceipts
} from '@/lib/yookassa/client';

const originalShopId = process.env.YOOKASSA_SHOP_ID;
const originalSecretKey = process.env.YOOKASSA_SECRET_KEY;
const merchantCredentials = {
  shopId: 'merchant-shop',
  secretKey: 'merchant-secret'
};

describe('YooKassa client', () => {
  beforeEach(() => {
    process.env.YOOKASSA_SHOP_ID = 'shop-id';
    process.env.YOOKASSA_SECRET_KEY = 'secret-key';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.YOOKASSA_SHOP_ID = originalShopId;
    process.env.YOOKASSA_SECRET_KEY = originalSecretKey;
  });

  it('preserves create payment request contract', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ id: 'payment-1' }), { status: 200 })
    );

    const payload = {
      amount: { value: '100.00', currency: 'RUB' },
      capture: true,
      description: 'Order 1'
    };
    const result = await createYooKassaPayment(payload, 'payment-key');

    expect(result).toEqual({ ok: true, data: { id: 'payment-1' } });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.yookassa.ru/v3/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('shop-id:secret-key').toString('base64')}`,
          'Content-Type': 'application/json',
          'Idempotence-Key': 'payment-key'
        }),
        body: JSON.stringify(payload)
      })
    );
  });

  it('gets a payment and safely encodes its id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'payment/1',
          status: 'succeeded',
          amount: { value: '100.00', currency: 'RUB' }
        }),
        { status: 200 }
      )
    );

    await getYooKassaPayment('payment/1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.yookassa.ru/v3/payments/payment%2F1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('creates, gets and lists receipts', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'receipt-1',
            type: 'payment',
            status: 'pending'
          }),
          {
            status: 200
          }
        )
      )
    );

    await createYooKassaReceipt(
      {
        type: 'payment',
        payment_id: 'payment-1',
        customer: { email: 'buyer@example.com' },
        items: [
          {
            description: 'Marked product',
            quantity: '1.000',
            amount: { value: '100.00', currency: 'RUB' },
            vat_code: 1,
            payment_mode: 'full_payment',
            payment_subject: 'marked',
            measure: 'piece',
            mark_code_info: { gs_1m: '010460000000000021serial' },
            mark_mode: '0'
          }
        ],
        settlements: [
          { type: 'prepayment', amount: { value: '100.00', currency: 'RUB' } }
        ],
        send: true
      },
      'receipt-key',
      merchantCredentials
    );
    await getYooKassaReceipt('receipt-1', merchantCredentials);
    await listYooKassaReceipts(merchantCredentials, {
      paymentId: 'payment-1',
      cursor: 'next cursor'
    });

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://api.yookassa.ru/v3/receipts'
    );
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers['Idempotence-Key']
    ).toBe('receipt-key');
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization
    ).toBe(
      `Basic ${Buffer.from('merchant-shop:merchant-secret').toString('base64')}`
    );
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
      'https://api.yookassa.ru/v3/receipts/receipt-1'
    );
    expect((global.fetch as jest.Mock).mock.calls[2][0]).toBe(
      'https://api.yookassa.ru/v3/receipts?payment_id=payment-1&cursor=next+cursor'
    );
  });

  it('creates and gets refunds', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'refund-1',
            payment_id: 'payment-1',
            status: 'pending',
            amount: { value: '50.00', currency: 'RUB' }
          }),
          { status: 200 }
        )
      )
    );

    const payload = {
      payment_id: 'payment-1',
      amount: { value: '50.00', currency: 'RUB' },
      description: 'Partial refund'
    };
    await createYooKassaRefund(payload, 'refund-key', merchantCredentials);
    await getYooKassaRefund('refund-1', merchantCredentials);

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://api.yookassa.ru/v3/refunds'
    );
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBe(
      JSON.stringify(payload)
    );
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
      'https://api.yookassa.ru/v3/refunds/refund-1'
    );
  });

  it('returns missing credentials and upstream errors without calling JSON.parse', async () => {
    delete process.env.YOOKASSA_SHOP_ID;
    expect(await getYooKassaPayment('payment-1')).toEqual({
      ok: false,
      status: 500,
      body: 'Platform YooKassa credentials missing'
    });
    expect(global.fetch).not.toHaveBeenCalled();

    process.env.YOOKASSA_SHOP_ID = 'shop-id';
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('bad request', { status: 400 })
    );
    expect(await getYooKassaPayment('payment-1')).toEqual({
      ok: false,
      status: 400,
      body: 'bad request'
    });
  });

  it('reports invalid JSON from a successful response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('not json', { status: 200 })
    );

    expect(await getYooKassaPayment('payment-1')).toEqual({
      ok: false,
      status: 502,
      body: 'YooKassa returned invalid JSON'
    });
  });
});
