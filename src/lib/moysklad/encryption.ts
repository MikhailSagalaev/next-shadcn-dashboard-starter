/**
 * @file: encryption.ts
 * @description: AES-256 encryption utilities for МойСклад API tokens
 * @project: SaaS Bonus System
 * @dependencies: crypto (Node.js built-in)
 * @created: 2026-03-01
 * @author: AI Assistant + User
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get system-wide encryption key from environment variable
 *
 * ВАЖНО: Это системный ключ для шифрования API токенов ВСЕХ проектов.
 * - Должен быть одинаковым на всех серверах
 * - НЕ должен меняться после начала использования
 * - Хранится в .env как MOYSKLAD_ENCRYPTION_KEY
 *
 * Falls back to a default key for development (NOT SECURE FOR PRODUCTION)
 */
function getEncryptionKey(): string {
  const key = process.env.MOYSKLAD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn(
      'WARNING: No MOYSKLAD_ENCRYPTION_KEY or ENCRYPTION_KEY found in environment. ' +
        'Using default key. THIS IS NOT SECURE FOR PRODUCTION!'
    );
    return 'default-encryption-key-change-me-in-production-please-use-strong-key';
  }

  return key;
}

/**
 * Derive a cryptographic key from the encryption key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt API token using AES-256-GCM
 *
 * @param apiToken - The plain text API token to encrypt
 * @returns Encrypted token in format: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export function encryptApiToken(apiToken: string): string {
  try {
    const encryptionKey = getEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the token
    let encrypted = cipher.update(apiToken, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt, IV, auth tag, and encrypted data
    const result = [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted
    ].join(':');

    return result;
  } catch (error) {
    console.error('Error encrypting API token:', error);
    throw new Error('Failed to encrypt API token');
  }
}

/**
 * Decrypt API token using AES-256-GCM
 *
 * @param encryptedToken - The encrypted token in format: salt:iv:authTag:encryptedData
 * @returns Decrypted plain text API token
 */
export function decryptApiToken(encryptedToken: string): string {
  try {
    const encryptionKey = getEncryptionKey();

    // Split the encrypted token into components
    const parts = encryptedToken.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }

    const [saltBase64, ivBase64, authTagBase64, encryptedData] = parts;

    // Convert from base64
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the token
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error decrypting API token:', error);
    throw new Error('Failed to decrypt API token');
  }
}

/**
 * Test if encryption/decryption works correctly
 * Used for validation during setup
 */
export function testEncryption(): boolean {
  try {
    const testToken = 'test-api-token-12345';
    const encrypted = encryptApiToken(testToken);
    const decrypted = decryptApiToken(encrypted);
    return testToken === decrypted;
  } catch {
    return false;
  }
}
