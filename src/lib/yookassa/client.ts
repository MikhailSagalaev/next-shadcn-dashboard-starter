/**
 * @file: src/lib/yookassa/client.ts
 * @description: Typed HTTP client for YooKassa API v3
 */

import { YOOKASSA_API_BASE_URL } from '@/lib/yookassa/constants';
import type {
  YooKassaApiResult,
  YooKassaCreateReceiptPayload,
  YooKassaCreateRefundPayload,
  YooKassaPayment,
  YooKassaPaymentPayload,
  YooKassaReceipt,
  YooKassaReceiptList,
  YooKassaRefund
} from '@/lib/yookassa/types';

export type {
  YooKassaApiFailure,
  YooKassaApiResult,
  YooKassaApiSuccess,
  YooKassaAmount,
  YooKassaCreateReceiptPayload,
  YooKassaCreateRefundPayload,
  YooKassaMeasure,
  YooKassaPayment,
  YooKassaPaymentMode,
  YooKassaPaymentPayload,
  YooKassaPaymentSubject,
  YooKassaReceipt,
  YooKassaReceiptCustomer,
  YooKassaReceiptItem,
  YooKassaReceiptList,
  YooKassaRefund,
  YooKassaSettlement,
  YooKassaVatCode
} from '@/lib/yookassa/types';

export type YooKassaCredentials = {
  shopId: string;
  secretKey: string;
};

export function getPlatformYooKassaAuthHeader(): string | null {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  const token = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  return `Basic ${token}`;
}

export function getYooKassaAuthHeader(
  credentials: YooKassaCredentials
): string {
  const token = Buffer.from(
    `${credentials.shopId}:${credentials.secretKey}`
  ).toString('base64');
  return `Basic ${token}`;
}

export type YooKassaRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotenceKey?: string;
  query?: Record<string, string | undefined>;
};

async function requestWithAuth<T>(
  path: string,
  authHeader: string,
  options: YooKassaRequestOptions
): Promise<YooKassaApiResult<T>> {
  const url = new URL(`${YOOKASSA_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authHeader
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotenceKey)
    headers['Idempotence-Key'] = options.idempotenceKey;

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const body = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, body };
  }

  try {
    return { ok: true, data: JSON.parse(body) as T };
  } catch {
    return { ok: false, status: 502, body: 'YooKassa returned invalid JSON' };
  }
}

export async function requestYooKassa<T>(
  path: string,
  options: YooKassaRequestOptions = {}
): Promise<YooKassaApiResult<T>> {
  const authHeader = getPlatformYooKassaAuthHeader();
  if (!authHeader) {
    return {
      ok: false,
      status: 500,
      body: 'Platform YooKassa credentials missing'
    };
  }
  return requestWithAuth(path, authHeader, options);
}

export async function requestMerchantYooKassa<T>(
  credentials: YooKassaCredentials,
  path: string,
  options: YooKassaRequestOptions = {}
): Promise<YooKassaApiResult<T>> {
  return requestWithAuth(path, getYooKassaAuthHeader(credentials), options);
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export async function createYooKassaPayment(
  payload: YooKassaPaymentPayload,
  idempotenceKey: string
): Promise<YooKassaApiResult<Record<string, unknown>>> {
  return requestYooKassa<Record<string, unknown>>('/payments', {
    method: 'POST',
    body: payload,
    idempotenceKey
  });
}

export async function getYooKassaPayment(
  paymentId: string
): Promise<YooKassaApiResult<YooKassaPayment>> {
  return requestYooKassa<YooKassaPayment>(
    `/payments/${encodePathSegment(paymentId)}`
  );
}

export async function getMerchantYooKassaPayment(
  paymentId: string,
  credentials: YooKassaCredentials
): Promise<YooKassaApiResult<YooKassaPayment>> {
  return requestMerchantYooKassa<YooKassaPayment>(
    credentials,
    `/payments/${encodePathSegment(paymentId)}`
  );
}

export async function createYooKassaReceipt(
  payload: YooKassaCreateReceiptPayload,
  idempotenceKey: string,
  credentials: YooKassaCredentials
): Promise<YooKassaApiResult<YooKassaReceipt>> {
  return requestMerchantYooKassa<YooKassaReceipt>(credentials, '/receipts', {
    method: 'POST',
    body: payload,
    idempotenceKey
  });
}

export async function getYooKassaReceipt(
  receiptId: string,
  credentials: YooKassaCredentials
): Promise<YooKassaApiResult<YooKassaReceipt>> {
  return requestMerchantYooKassa<YooKassaReceipt>(
    credentials,
    `/receipts/${encodePathSegment(receiptId)}`
  );
}

export async function listYooKassaReceipts(
  credentials: YooKassaCredentials,
  params: {
    paymentId?: string;
    refundId?: string;
    cursor?: string;
    limit?: string;
  } = {}
): Promise<YooKassaApiResult<YooKassaReceiptList>> {
  return requestMerchantYooKassa<YooKassaReceiptList>(
    credentials,
    '/receipts',
    {
      query: {
        payment_id: params.paymentId,
        refund_id: params.refundId,
        cursor: params.cursor,
        limit: params.limit
      }
    }
  );
}

export async function createYooKassaRefund(
  payload: YooKassaCreateRefundPayload,
  idempotenceKey: string,
  credentials: YooKassaCredentials
): Promise<YooKassaApiResult<YooKassaRefund>> {
  return requestMerchantYooKassa<YooKassaRefund>(credentials, '/refunds', {
    method: 'POST',
    body: payload,
    idempotenceKey
  });
}

export async function getYooKassaRefund(
  refundId: string,
  credentials: YooKassaCredentials
): Promise<YooKassaApiResult<YooKassaRefund>> {
  return requestMerchantYooKassa<YooKassaRefund>(
    credentials,
    `/refunds/${encodePathSegment(refundId)}`
  );
}
