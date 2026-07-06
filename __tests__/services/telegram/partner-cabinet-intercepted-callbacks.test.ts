/**
 * @file: __tests__/services/telegram/partner-cabinet-intercepted-callbacks.test.ts
 * @description: Unit тесты для isTelegramCallbackIntercepted / isTriggerNodePatternIntercepted
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

import {
  isTelegramCallbackIntercepted,
  isTriggerNodePatternIntercepted
} from '@/lib/telegram/partner-cabinet-intercepted-callbacks';

describe('isTelegramCallbackIntercepted', () => {
  it('matches all documented prefix patterns with a real suffix', () => {
    expect(isTelegramCallbackIntercepted('partner_join_abc123')).toBe(true);
    expect(isTelegramCallbackIntercepted('partner_team_remove:u1')).toBe(true);
    expect(isTelegramCallbackIntercepted('partner_team_tab:clients')).toBe(
      true
    );
    expect(isTelegramCallbackIntercepted('partner_team_page:0')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_cancel:p1')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_method:card')).toBe(true);
  });

  it('matches all documented exact patterns', () => {
    expect(isTelegramCallbackIntercepted('partner_requests')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_request')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_method_cancel')).toBe(true);
  });

  it('does not match unrelated callback data', () => {
    expect(isTelegramCallbackIntercepted('partner_link')).toBe(false);
    expect(isTelegramCallbackIntercepted('partner_org_summary')).toBe(false);
    expect(isTelegramCallbackIntercepted('partner_payouts')).toBe(false);
    expect(isTelegramCallbackIntercepted('menu_referrals')).toBe(false);
    expect(isTelegramCallbackIntercepted('back_to_menu')).toBe(false);
  });

  it('does not match a bare prefix with no suffix (regression guard)', () => {
    // "partner_team_page" alone is shorter than "partner_team_page:" and
    // can never satisfy startsWith on it — this is the case that makes
    // isTriggerNodePatternIntercepted necessary.
    expect(isTelegramCallbackIntercepted('partner_team_page')).toBe(false);
  });
});

describe('isTriggerNodePatternIntercepted', () => {
  it('flags the one dead node in the shipped b2b template', () => {
    expect(isTriggerNodePatternIntercepted('partner_team_page')).toBe(true);
  });

  it('does not flag the live nodes in the shipped b2b template', () => {
    for (const pattern of [
      'partner_org_summary',
      'partner_link',
      'partner_payouts',
      'partner_subject',
      'menu_balance',
      'menu_history',
      'menu_level',
      'menu_referrals',
      'menu_help',
      'back_to_menu'
    ]) {
      expect(isTriggerNodePatternIntercepted(pattern)).toBe(false);
    }
  });

  it('flags exact-match entries too', () => {
    expect(isTriggerNodePatternIntercepted('partner_requests')).toBe(true);
    expect(isTriggerNodePatternIntercepted('payout_request')).toBe(true);
  });
});
