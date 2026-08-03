import { safeStringifyLogContext } from '@/lib/logger';

describe('safeStringifyLogContext', () => {
  test('serializes BigInt values without throwing', () => {
    expect(
      JSON.parse(safeStringifyLogContext({ telegramId: 524567338n }))
    ).toEqual({ telegramId: '524567338' });
  });

  test('handles circular values without breaking the caller', () => {
    const context: Record<string, unknown> = {};
    context.self = context;
    expect(JSON.parse(safeStringifyLogContext(context))).toEqual({
      self: '[Circular]'
    });
  });
});
