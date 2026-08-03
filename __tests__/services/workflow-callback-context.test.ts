import { buildTelegramCallbackContext } from '@/lib/services/workflow/execution-context-manager';
import { resolveTemplateString } from '@/lib/services/workflow/handlers/utils';
import type { ExecutionContext } from '@/types/workflow';

describe('workflow callback context', () => {
  test('exposes callback name and colon-delimited params to templates', async () => {
    const callback = buildTelegramCallbackContext(
      'partner_subject:user-123:details'
    );
    expect(callback).toEqual({
      data: 'partner_subject:user-123:details',
      name: 'partner_subject',
      params: ['user-123', 'details']
    });
    const context = {
      telegram: { callback },
      variables: { get: jest.fn() }
    } as unknown as ExecutionContext;
    await expect(
      resolveTemplateString('{{telegram.callback.params[0]}}', context)
    ).resolves.toBe('user-123');
  });
  test('returns no callback context without callback_data', () => {
    expect(buildTelegramCallbackContext()).toBeUndefined();
  });
});
