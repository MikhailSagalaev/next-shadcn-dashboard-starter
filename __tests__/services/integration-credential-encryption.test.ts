import {
  decryptIntegrationSecret,
  encryptIntegrationSecret
} from '@/lib/integrations/credential-encryption';

const originalKey = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;

describe('integration credential encryption', () => {
  beforeEach(() => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY =
      'test-master-key-with-at-least-32-characters';
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = originalKey;
    }
  });

  it('encrypts secrets with authenticated encryption', () => {
    const first = encryptIntegrationSecret('merchant-secret');
    const second = encryptIntegrationSecret('merchant-secret');

    expect(first).not.toBe('merchant-secret');
    expect(first).not.toBe(second);
    expect(decryptIntegrationSecret(first)).toBe('merchant-secret');
  });

  it('refuses to work without a server master key', () => {
    delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    const originalFallback = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptIntegrationSecret('secret')).toThrow(
      'must contain at least 32 characters'
    );
    if (originalFallback === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalFallback;
    }
  });
});
