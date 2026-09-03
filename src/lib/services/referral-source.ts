export type ReferralStatus = 'CONFIRMED' | 'PENDING' | 'INFERRED' | null;
export type AcquisitionSource = 'QR' | 'REFERRAL' | 'MANUAL';

type ReferralSourceInput = {
  primaryReferrerId?: string | null;
  attributionReferrerId?: string | null;
  storedReferrerId?: string | null;
  pendingReferrerId?: string | null;
  utmSource?: string | null;
  hasOrganizationMarker: boolean;
  validReferrerIds?: ReadonlySet<string>;
};

export function readPendingReferrerId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const pending = (metadata as Record<string, unknown>).pendingReferral;
  if (!pending || typeof pending !== 'object') return null;
  const referrerId = (pending as Record<string, unknown>).referrerId;
  return typeof referrerId === 'string' && referrerId.trim()
    ? referrerId.trim()
    : null;
}

export function resolveReferralSource({
  primaryReferrerId,
  attributionReferrerId,
  storedReferrerId,
  pendingReferrerId,
  utmSource,
  hasOrganizationMarker,
  validReferrerIds
}: ReferralSourceInput): {
  referrerId: string | null;
  status: ReferralStatus;
  acquisitionSource: AcquisitionSource;
} {
  const legacyReferrerId =
    utmSource && (!validReferrerIds || validReferrerIds.has(utmSource))
      ? utmSource
      : null;
  const referrerId =
    primaryReferrerId ??
    attributionReferrerId ??
    storedReferrerId ??
    pendingReferrerId ??
    legacyReferrerId ??
    null;
  const status: ReferralStatus =
    primaryReferrerId || attributionReferrerId || storedReferrerId
      ? 'CONFIRMED'
      : pendingReferrerId
        ? 'PENDING'
        : legacyReferrerId
          ? 'INFERRED'
          : null;

  return {
    referrerId,
    status,
    acquisitionSource: referrerId
      ? 'REFERRAL'
      : hasOrganizationMarker
        ? 'QR'
        : 'MANUAL'
  };
}
