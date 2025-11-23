/**
 * @file: src/lib/services/two-factor.service.ts
 * @description: Генерация и валидация TOTP 2FA для админов
 * @project: SaaS Bonus System
 * @dependencies: otplib, qrcode, Node crypto
 * @created: 2025-11-16
 * @author: AI Assistant + User
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const APP_NAME = process.env.TWO_FACTOR_APP_NAME || 'SaaS Bonus System';
const ENC_ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not set');
  }
  if (key.length !== 64) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be 32 bytes hex string');
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid secret payload');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export async function generateTwoFactorSetup(email: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

export function verifyTwoFactorToken(secret: string, token: string) {
  return authenticator.verify({ secret, token });
}
