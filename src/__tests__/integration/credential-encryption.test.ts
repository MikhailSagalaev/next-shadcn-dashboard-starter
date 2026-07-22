import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  IntegrationCredentialConfigurationError
} from '@/lib/integrations/credential-encryption';

describe('integration credential encryption', () => {
  const originalIntegrationKey =
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (originalIntegrationKey === undefined) {
      delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY =
        originalIntegrationKey;
    }
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it('encrypts and decrypts a merchant secret without exposing plaintext', () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(32);
    delete process.env.ENCRYPTION_KEY;

    const encrypted = encryptIntegrationSecret('merchant-secret');

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain('merchant-secret');
    expect(decryptIntegrationSecret(encrypted)).toBe('merchant-secret');
  });

  it('uses the existing generic server encryption key when configured', () => {
    delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);

    const encrypted = encryptIntegrationSecret('merchant-secret');

    expect(decryptIntegrationSecret(encrypted)).toBe('merchant-secret');
  });

  it('returns a typed configuration error when no server key is available', () => {
    delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptIntegrationSecret('merchant-secret')).toThrow(
      IntegrationCredentialConfigurationError
    );
  });
});
