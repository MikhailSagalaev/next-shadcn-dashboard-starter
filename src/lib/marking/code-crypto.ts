import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'crypto';

function getKey(): Buffer {
  const value = process.env.MARKING_ENCRYPTION_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('MARKING_ENCRYPTION_KEY must be a 32-byte hex key');
  }
  return Buffer.from(value, 'hex');
}

export function hashMarkCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export function encryptMarkCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(code, 'utf8'),
    cipher.final()
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64'))
    .join(':');
}

export function decryptMarkCode(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(':');
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted marking code');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
