import {
  readPendingReferrerId,
  resolveReferralSource
} from '@/lib/services/referral-source';

describe('referral source resolution', () => {
  const memberIds = new Set(['partner-1', 'client-1']);

  it('recognizes a legacy partner user id in utm_source as a referral link', () => {
    expect(
      resolveReferralSource({
        utmSource: 'partner-1',
        hasOrganizationMarker: true,
        validReferrerIds: memberIds
      })
    ).toEqual({
      referrerId: 'partner-1',
      status: 'INFERRED',
      acquisitionSource: 'REFERRAL'
    });
  });

  it('does not mistake a normal marketing UTM value for a referrer', () => {
    expect(
      resolveReferralSource({
        utmSource: 'instagram',
        hasOrganizationMarker: true,
        validReferrerIds: memberIds
      })
    ).toEqual({
      referrerId: null,
      status: null,
      acquisitionSource: 'QR'
    });
  });

  it('shows a pending referrer without marking the relationship confirmed', () => {
    expect(
      resolveReferralSource({
        pendingReferrerId: 'partner-1',
        hasOrganizationMarker: true,
        validReferrerIds: memberIds
      })
    ).toEqual({
      referrerId: 'partner-1',
      status: 'PENDING',
      acquisitionSource: 'REFERRAL'
    });
  });

  it('reads the pending referrer defensively from metadata', () => {
    expect(
      readPendingReferrerId({ pendingReferral: { referrerId: ' partner-1 ' } })
    ).toBe('partner-1');
    expect(readPendingReferrerId({ pendingReferral: 'broken' })).toBeNull();
  });
});
