/**
 * @file: encryption.ts
 * @description: Encryption service for МойСклад Direct API tokens using AES-256-GCM with PBKDF2
 * @project: SaaS Bonus System
 * @dependencies: crypto
 * @created: 2026-03-06
 * @author: AI Assistant + User
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const MOYSKLAD_ENCRYPTION_KEY = process.env.MOYSKLAD_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (!MOYSKLAD_ENCRYPTION_KEY) {
  logger.warn(
    'MOYSKLAD_ENCRYPTION_KEY not set, using default (INSECURE)',
    {},
    'moysklad-direct-encryption'
  );
}

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const masterKey =
    MOYSKLAD_ENCRYPTION_KEY || 'default-insecure-key-change-in-production';
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, 32, 'sha256');
}

/**
 * Encrypt API token using AES-256-GCM
 * Format: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export function encryptApiToken(apiToken: string): string {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key
    const key = deriveKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(apiToken, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: salt:iv:authTag:encryptedData
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted
    ].join(':');
  } catch (error) {
    logger.error(
      'Failed to encrypt API token',
      { error },
      'moysklad-direct-encryption'
    );
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt API token using AES-256-GCM
 */
export function decryptApiToken(encryptedToken: string): string {
  try {
    // Parse encrypted token
    const parts = encryptedToken.split(':');

    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }

    const [saltB64, ivB64, authTagB64, encryptedData] = parts;

    // Decode from base64
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // Derive key
    const key = deriveKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error(
      'Failed to decrypt API token',
      { error },
      'moysklad-direct-encryption'
    );
    throw new Error('Decryption failed');
  }
}

/**
 * Test encryption round-trip
 */
export function testEncryption(): boolean {
  try {
    const testToken =
      'test-api-token-' + crypto.randomBytes(16).toString('hex');
    const encrypted = encryptApiToken(testToken);
    const decrypted = decryptApiToken(encrypted);

    const success = testToken === decrypted;

    if (success) {
      logger.info('Encryption test passed', {}, 'moysklad-direct-encryption');
    } else {
      logger.error(
        'Encryption test failed: decrypted value does not match',
        {},
        'moysklad-direct-encryption'
      );
    }

    return success;
  } catch (error) {
    logger.error(
      'Encryption test failed with error',
      { error },
      'moysklad-direct-encryption'
    );
    return false;
  }
}

/**
 * Generate random webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
