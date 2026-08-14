/**
 * @file: with-partner-auth.ts
 * @description: Аутентификация партнёра для partner API (Telegram / MAX ID)
 * @project: SaaS Bonus System
 * @created: 2026-06-07
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { resolvePartnerUserFromPlatform } from '@/lib/partner-auth';
import { redis } from '@/lib/redis';

export async function requirePartnerUser(
  request: NextRequest,
  projectId: string
) {
  const telegramId =
    request.headers.get('x-telegram-user-id') ??
    request.nextUrl.searchParams.get('telegramId');
  const maxId =
    request.headers.get('x-max-user-id') ??
    request.nextUrl.searchParams.get('maxId');

  if ((!telegramId && !maxId) || (telegramId && maxId)) {
    return {
      error: NextResponse.json(
        {
          error: 'Unauthorized — передайте x-telegram-user-id или x-max-user-id'
        },
        { status: 401 }
      )
    } as const;
  }

  const timestamp = request.headers.get('x-partner-timestamp');
  const signature = request.headers.get('x-partner-signature');
  const nonce = request.headers.get('x-partner-nonce');
  const secret = process.env.PARTNER_API_SHARED_SECRET;
  const platform = telegramId ? 'telegram' : 'max';
  const externalUserId = telegramId ?? maxId!;
  const timestampMs = timestamp ? Number(timestamp) : NaN;

  // Platform IDs are public identifiers, not credentials. This API is for a
  // trusted bot/backend caller and therefore requires a short-lived HMAC.
  if (
    !secret ||
    !signature ||
    !nonce ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } as const;
  }

  const normalizedQuery = new URLSearchParams(
    [...request.nextUrl.searchParams.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    )
  ).toString();
  const canonicalPath = `${request.nextUrl.pathname}${normalizedQuery ? `?${normalizedQuery}` : ''}`;
  const bodyHash = createHash('sha256')
    .update(await request.clone().text())
    .digest('hex');
  const canonical = [
    request.method.toUpperCase(),
    canonicalPath,
    bodyHash,
    projectId,
    platform,
    externalUserId,
    timestamp,
    nonce
  ].join('\n');
  const expected = createHmac('sha256', secret).update(canonical).digest('hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } as const;
  }

  const nonceDigest = createHash('sha256')
    .update(`${projectId}:${platform}:${externalUserId}:${nonce}`)
    .digest('hex');
  try {
    const accepted = await redis.set(
      `partner-auth:nonce:${nonceDigest}`,
      '1',
      'PX',
      5 * 60 * 1000,
      'NX'
    );
    if (accepted !== 'OK') {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } as const;
    }
  } catch {
    // Authentication must fail closed when replay protection is unavailable.
    return {
      error: NextResponse.json(
        { error: 'Partner authentication is temporarily unavailable' },
        { status: 503 }
      )
    } as const;
  }

  const partner = await resolvePartnerUserFromPlatform({
    projectId,
    telegramId,
    maxId
  });

  if (!partner?.isActive || partner.partnerRole === 'CLIENT') {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } as const;
  }

  return { partner } as const;
}
