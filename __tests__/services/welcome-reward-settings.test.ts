import { resolveWelcomeRewardSettings } from '@/lib/services/welcome-reward-settings';

describe('resolveWelcomeRewardSettings', () => {
  it('uses the project value even when a legacy referral program contains zero', () => {
    expect(
      resolveWelcomeRewardSettings(
        { welcomeBonus: 300, welcomeRewardType: 'BONUS' },
        { welcomeBonus: 0, welcomeRewardType: 'BONUS' }
      )
    ).toEqual({ amount: 300, type: 'BONUS', source: 'PROJECT' });
  });

  it('keeps the project reward type together with its amount', () => {
    expect(
      resolveWelcomeRewardSettings(
        { welcomeBonus: '15', welcomeRewardType: 'DISCOUNT' },
        { welcomeBonus: '300', welcomeRewardType: 'BONUS' }
      )
    ).toEqual({ amount: 15, type: 'DISCOUNT', source: 'PROJECT' });
  });

  it('falls back to the legacy referral-program value for unmigrated projects', () => {
    expect(
      resolveWelcomeRewardSettings(
        { welcomeBonus: 0, welcomeRewardType: 'BONUS' },
        { welcomeBonus: 250, welcomeRewardType: 'BONUS' }
      )
    ).toEqual({
      amount: 250,
      type: 'BONUS',
      source: 'REFERRAL_PROGRAM'
    });
  });

  it('returns a disabled reward when neither source has a positive amount', () => {
    expect(
      resolveWelcomeRewardSettings(
        { welcomeBonus: 0, welcomeRewardType: 'BONUS' },
        { welcomeBonus: 0, welcomeRewardType: 'BONUS' }
      )
    ).toEqual({ amount: 0, type: 'BONUS', source: 'NONE' });
  });
});
