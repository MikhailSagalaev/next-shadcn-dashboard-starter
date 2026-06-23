# Plan 002: Make the multi-level referral payout atomic and observable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1830d2a..HEAD -- src/lib/services/referral.service.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but coordinate with 001 — both edit `processReferralBonus`; do 001 first if both are scheduled)
- **Category**: bug
- **Category note**: this plan is the structural foundation 003 (refund reversal) builds on.
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

`processReferralBonus` pays each ancestor in the chain with a **separate,
sequential** `awardBonus` call and no surrounding transaction. If level 1
succeeds and level 2 throws (DB blip, notification failure bubbling up), the
trainer is paid but the manager is not — and the outer `catch` swallows the
error, returning `{ bonusAwarded: false }`, so nobody (logs, caller, admin)
learns the chain was paid out partially. The result: silent, inconsistent money
state that only surfaces when a partner complains.

This plan makes the chain all-or-nothing and makes partial failures loud.

## Current state

File: `src/lib/services/referral.service.ts`.

The payout loop awards sequentially with no transaction
(`src/lib/services/referral.service.ts:461-509`):

```ts
      const payouts: ReferralBonusPayout[] = [];

      for (let index = 0; index < chain.length; index++) {
        const referrer = chain[index];
        const level = index + 1;
        const percent = levelMap.get(level) ?? (level === 1 ? referralProgram.referrerBonus : 0);
        if (!percent || percent <= 0) continue;
        const bonusAmount = (purchaseAmount * percent) / 100;
        if (bonusAmount <= 0) continue;

        const bonus = await BonusService.awardBonus({
          userId: referrer.id,
          amount: bonusAmount,
          type: 'REFERRAL',
          ...
        });
        ...
        payouts.push({ level, amount: bonusAmount, referrerId: referrer.id, referrer: referrerDetails, bonusId: bonus.id });
      }
```

The outer catch silently swallows (`src/lib/services/referral.service.ts:534-543`):

```ts
    } catch (error) {
      logger.error('Ошибка обработки реферального бонуса', { ... });
      // Не выбрасываем ошибку, чтобы не сломать основную покупку
      return { bonusAwarded: false };
    }
```

Important constraint: this method is called inline from the customer purchase
path (`src/lib/services/user.service.ts:1209`), so it **must not throw** —
breaking a customer's checkout because a partner payout failed is worse than the
current behavior. The fix is therefore: make the *payout writes* atomic
internally, but keep the method's outer contract non-throwing, and make partial
failure **observable** (structured error log with enough detail to reconcile +
a distinct return signal).

Repo conventions: transactions use `db.$transaction(async (tx) => { ... })`
(see `referral-commission.service.ts:158` and `:203` for the pattern). Logs use
`logger` with a `component` field.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                   | exit 0              |
| Tests     | `yarn jest __tests__/services/referral.service.test.ts` | all pass         |
| Lint      | `yarn lint`                                          | exit 0              |

## Scope

**In scope**:
- `src/lib/services/referral.service.ts`
- `__tests__/services/referral.service.test.ts` (extend)

**Out of scope** (do NOT touch):
- `src/lib/services/user.service.ts` `awardBonus` — its side effects
  (Telegram + МойСклад sync) are intentionally fire-and-forget; do not move them
  inside a DB transaction (a slow API call must not hold a DB transaction open).
  See Step 1 for how to reconcile this.
- The return type `ReferralBonusPayout` shape consumed by callers.

## Git workflow

- Branch: `advisor/002-payout-chain-transaction`
- Commit style: `fix(referral): make multi-level payout atomic and observable`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Separate the money write from the side effects

`BonusService.awardBonus` (`src/lib/services/user.service.ts:871`) does three
things: creates the bonus + transaction (the money), sends a Telegram
notification, and syncs to МойСклад (both non-critical, already wrapped in their
own try/catch). You must NOT pull the network side effects into a DB
transaction.

Approach: compute all payout amounts first (pure, no writes), then write the
**bonus+transaction rows** for the whole chain inside a single
`db.$transaction`, then fire the notifications/sync per payout outside the
transaction.

If extracting the money-only write from `awardBonus` is too invasive (it is a
shared method — out of scope to refactor), use this lighter approach instead and
record it in your report: keep calling `awardBonus` per level, but wrap the loop
so that **any** thrown error aborts remaining levels AND records, in a single
structured `logger.error`, exactly which levels were already paid (referrerId,
level, amount, bonusId) so the state is reconcilable. Then return a new field
(see Step 2). This keeps risk MED and avoids refactoring the shared method.
Prefer this lighter approach unless you are confident in the extraction.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Make partial failure observable in the return value

Extend the return type with an explicit partial-failure signal instead of the
ambiguous `{ bonusAwarded: false }`. Add an optional field, e.g.
`partialFailure?: { paidLevels: number[]; failedAtLevel: number; reason: string }`,
and populate it in the catch path when at least one level was paid before the
failure. Keep `bonusAwarded` semantics for existing callers (true only if the
full intended chain was paid).

Update the outer `catch` (`:534`) to log at `error` level with the structured
partial-payout detail, and keep NOT throwing.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Extend the regression tests

In `__tests__/services/referral.service.test.ts`, add cases:
1. **Full chain success**: 3-level plan, all `awardBonus` calls succeed →
   `bonusAwarded: true`, 3 payouts, no `partialFailure`.
2. **Mid-chain failure**: mock `awardBonus` to succeed on level 1 and throw on
   level 2 → method does NOT throw, returns `partialFailure` naming
   `paidLevels: [1]` and `failedAtLevel: 2`, and the error is logged.

**Verify**: `yarn jest __tests__/services/referral.service.test.ts` → all pass.

## Test plan

- Extend `__tests__/services/referral.service.test.ts` with the two cases above.
- Reuse the existing mock setup in that file (do not introduce a new mocking style).
- `yarn jest __tests__/services/referral.service.test.ts` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `yarn jest __tests__/services/referral.service.test.ts` passes incl. the 2 new cases
- [ ] `yarn lint` exits 0
- [ ] Mid-chain failure does NOT throw out of `processReferralBonus` (asserted)
- [ ] Mid-chain failure logs a structured error naming paid levels (asserted via logger spy)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report if:

- "Current state" excerpts don't match live code (drift).
- Extracting a money-only write from `awardBonus` would require changing its
  signature in a way that touches callers outside `referral.service.ts` — fall
  back to the lighter approach in Step 1 and note it; do not refactor shared
  callers.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- 003 (refund reversal) depends on payouts being reliably recorded with stable
  identifiers — coordinate the `externalId` format from plan 001 here.
- Reviewer should confirm no network call (Telegram/МойСклад) was moved inside a
  `db.$transaction` (would hold a connection open across I/O).
- If `processReferralBonus` is ever moved into the BullMQ webhook queue, the
  non-throwing contract can be relaxed to throwing + retry — revisit then.
