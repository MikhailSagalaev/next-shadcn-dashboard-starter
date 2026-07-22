import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'crypto';

export class IntegrationCredentialConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationCredentialConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function masterKey(): Buffer {
  const value =
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new IntegrationCredentialConfigurationError(
      'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY or ENCRYPTION_KEY must contain at least 32 characters'
    );
  }
  return createHash('sha256').update(value, 'utf8').digest();
}

export function encryptIntegrationSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);
  return ['v1', iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
    .join(':');
}

export function decryptIntegrationSecret(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted integration secret');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    masterKey(),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
