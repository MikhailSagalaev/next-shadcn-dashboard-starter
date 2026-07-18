/**
 * @file: bullmq-connection.ts
 * @description: Shared, strictly typed Redis connection options for BullMQ clients, queues, and workers.
 * @project: SaaS Bonus System
 * @dependencies: ioredis
 * @created: 2026-07-18
 * @author: AI Assistant + User
 */

import type { RedisOptions } from 'ioredis';

export type BullMQConnectionPurpose = 'client' | 'queue' | 'worker';

const DEFAULT_REDIS_PORT = 6379;

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_REDIS_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Redis port: ${value}`);
  }
  return port;
}

function parseDatabase(pathname: string): number {
  if (!pathname || pathname === '/') return 0;

  const databasePath = pathname.slice(1);
  if (!/^\d+$/.test(databasePath)) {
    throw new Error(`Invalid Redis database path: ${pathname}`);
  }

  const database = Number(databasePath);
  if (!Number.isSafeInteger(database)) {
    throw new Error(`Invalid Redis database path: ${pathname}`);
  }
  return database;
}

function decodeCredential(value: string): string | undefined {
  return value ? decodeURIComponent(value) : undefined;
}
function retryOptions(
  purpose: BullMQConnectionPurpose
): Pick<RedisOptions, 'maxRetriesPerRequest'> {
  return { maxRetriesPerRequest: purpose === 'worker' ? null : 1 };
}

function fromRedisUrl(
  redisUrl: string,
  purpose: BullMQConnectionPurpose
): RedisOptions {
  let url: URL;
  try {
    url = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) throw new Error('REDIS_URL must include a hostname');

  return {
    host: hostname,
    port: parsePort(url.port || undefined),
    username: decodeCredential(url.username),
    password: decodeCredential(url.password),
    db: parseDatabase(url.pathname),
    tls: url.protocol === 'rediss:' ? {} : undefined,
    ...retryOptions(purpose)
  };
}

export function createBullMQConnectionOptions(
  purpose: BullMQConnectionPurpose = 'queue'
): RedisOptions | null {
  const host = optionalValue(process.env.REDIS_HOST);
  if (host) {
    return {
      host,
      port: parsePort(optionalValue(process.env.REDIS_PORT)),
      username: optionalValue(process.env.REDIS_USERNAME),
      password: optionalValue(process.env.REDIS_PASSWORD),
      ...retryOptions(purpose)
    };
  }

  const redisUrl = optionalValue(process.env.REDIS_URL);
  return redisUrl ? fromRedisUrl(redisUrl, purpose) : null;
}
