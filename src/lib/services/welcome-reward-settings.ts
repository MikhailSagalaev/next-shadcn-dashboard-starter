type NumericValue = number | string | { toString(): string } | null | undefined;

type WelcomeRewardConfig = {
  welcomeBonus?: NumericValue;
  welcomeRewardType?: string | null;
};

export type ResolvedWelcomeReward = {
  amount: number;
  type: 'BONUS' | 'DISCOUNT';
  source: 'PROJECT' | 'REFERRAL_PROGRAM' | 'NONE';
};

function toAmount(value: NumericValue): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function toRewardType(value: string | null | undefined): 'BONUS' | 'DISCOUNT' {
  return value === 'DISCOUNT' ? 'DISCOUNT' : 'BONUS';
}

/**
 * The project settings page and the public widget both use Project.welcomeBonus,
 * so it is the canonical value. ReferralProgram is retained only as a legacy
 * fallback for projects that have not migrated the setting yet.
 */
export function resolveWelcomeRewardSettings(
  project: WelcomeRewardConfig | null | undefined,
  referralProgram?: WelcomeRewardConfig | null
): ResolvedWelcomeReward {
  const projectAmount = toAmount(project?.welcomeBonus);
  if (projectAmount > 0) {
    return {
      amount: projectAmount,
      type: toRewardType(project?.welcomeRewardType),
      source: 'PROJECT'
    };
  }

  const legacyAmount = toAmount(referralProgram?.welcomeBonus);
  if (legacyAmount > 0) {
    return {
      amount: legacyAmount,
      type: toRewardType(referralProgram?.welcomeRewardType),
      source: 'REFERRAL_PROGRAM'
    };
  }

  return {
    amount: 0,
    type: toRewardType(project?.welcomeRewardType),
    source: 'NONE'
  };
}
