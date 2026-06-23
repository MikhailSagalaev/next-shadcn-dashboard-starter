# Plan 004: Reconcile commission depth — plan levels vs maxPayoutDepth vs UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1830d2a..HEAD -- src/lib/services/referral-commission.service.ts`
> If the file changed, compare the "Current state" excerpt against live code; on
> a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

The commission depth concept is implemented inconsistently across three places:

- `normalizeLevels` clamps plan levels to **1..3** — so a plan can never hold a
  level 4+ percentage.
- `createPlan`/`updatePlan` clamp `maxPayoutDepth` to **1..10**, and the tree
  CTEs allow `MAX_TREE_DEPTH = 10`.
- The admin UI exposes a `maxPayoutDepth` slider (the b2b guide mentions "up to
  10" in one place and "1..3" in another).

Net effect: an admin can set `maxPayoutDepth = 6`, the chain resolves 6
ancestors, but levels 4–6 always pay **0%** because no plan level above 3 can
exist. The product silently under-pays and the UI promises depth the model can't
honor. This is a correctness-of-expectations bug, cheap to fix, and it removes a
trap for the more invasive plan 005.

## Current state

`src/lib/services/referral-commission.service.ts`:

Constants (`:17-24`):

```ts
const MAX_TREE_DEPTH = 10;
const DEFAULT_TREE_DEPTH = 3;

function clampDepth(depth: number): number {
  if (!Number.isFinite(depth)) return DEFAULT_TREE_DEPTH;
  return Math.min(Math.max(Math.trunc(depth), 1), MAX_TREE_DEPTH);
}
```

Levels clamped to 1..3 (`:706-717`):

```ts
  private static normalizeLevels(levels: PlanLevelInput[]): PlanLevelInput[] {
    const by = new Map<number, PlanLevelInput>();
    for (const l of levels) {
      const level = Math.min(Math.max(Math.trunc(l.level), 1), 3);
      ...
```

Depth clamped to 1..10 in `createPlan` (`:156`) and `updatePlan` (`:209`):

```ts
    const depth = Math.min(Math.max(1, maxPayoutDepth), 10);
```

## Decision to implement

Make **3 the single source of truth** for b2b commission depth (it matches the
documented product intent: trainer → manager → director, and the FAQ note that
depth > 3 enters MLM legal territory). Specifically: clamp `maxPayoutDepth` to
the same ceiling as plan levels (3), and introduce one shared constant so the
three sites can't drift again.

If the product owner actually wants depth > 3, that is a larger change (plan
levels, UI, legal) — out of scope here; this plan makes the system *consistent
and honest at depth 3*, and STOP-flags the ambiguity if evidence contradicts.

## Commands you will need

| Purpose   | Command                                                          | Expected |
|-----------|-----------------------------------------------------------------|----------|
| Typecheck | `npx tsc --noEmit`                                              | exit 0   |
| Tests     | `yarn jest __tests__/services/referral-commission.service.partner-role.test.ts __tests__/services/referral-commission.service.grants.test.ts` | all pass |
| Lint      | `yarn lint`                                                     | exit 0   |

## Scope

**In scope**:
- `src/lib/services/referral-commission.service.ts`
- The admin UI slider bound to `maxPayoutDepth`:
  `src/features/projects/components/referral-commission-plans-panel.tsx` (only
  to cap the slider max at the shared constant).
- `__tests__/services/referral-commission.service.partner-role.test.ts` (extend, or add a focused test)

**Out of scope** (do NOT touch):
- `MAX_TREE_DEPTH` used by `getAncestorChain`/`getDescendantTree` for **access
  control** (`canViewSubject`, hierarchy page) — those legitimately traverse
  deeper than payout depth for visibility. Do NOT lower the tree-traversal
  ceiling; only the **payout/plan-level** ceiling changes.
- `prisma/schema.prisma`.

## Git workflow

- Branch: `advisor/004-commission-depth-consistency`
- Commit style: `fix(referral): unify commission payout depth at 3 levels`

## Steps

### Step 1: Introduce one shared payout-depth constant

In `src/lib/services/referral-commission.service.ts`, add near the existing
constants:

```ts
/** Max commission levels a plan can define and pay out. Keep plan-level clamp,
 *  maxPayoutDepth clamp, and the admin slider in sync with this value. */
const MAX_COMMISSION_LEVELS = 3;
```

Leave `MAX_TREE_DEPTH = 10` untouched (it governs access-control traversal, not
payouts).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Use the constant in level and depth clamps

- In `normalizeLevels` replace the hard-coded `3` with `MAX_COMMISSION_LEVELS`.
- In `createPlan` and `updatePlan`, replace `Math.min(Math.max(1, depth), 10)`
  (and `Math.min(Math.max(maxPayoutDepth, 1), 10)`) with a clamp to
  `MAX_COMMISSION_LEVELS`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Cap the admin slider

In `src/features/projects/components/referral-commission-plans-panel.tsx`, find
the `maxPayoutDepth` slider and set its `max` to `3` (mirror the constant; if the
component can import the service constant cleanly do so, otherwise hard-code `3`
with a comment pointing at `MAX_COMMISSION_LEVELS`).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Test the clamp

Add/extend a test asserting:
- `createPlan` with `maxPayoutDepth = 6` persists `maxPayoutDepth = 3`.
- `createPlan`/`updatePlan` given a level-4 input drops it (only levels 1–3 persist).

Model after `__tests__/services/referral-commission.service.partner-role.test.ts`.

**Verify**: `yarn jest __tests__/services/referral-commission.service.partner-role.test.ts`
→ all pass.

## Test plan

- Extend `__tests__/services/referral-commission.service.partner-role.test.ts`
  (or add `referral-commission.service.depth.test.ts`) with the two assertions
  above.
- `yarn jest __tests__/services` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `grep -n "), 10)" src/lib/services/referral-commission.service.ts` returns no payout-depth clamp matches (tree-depth clamp via `clampDepth`/`MAX_TREE_DEPTH` may remain)
- [ ] New/extended test asserts depth and level both cap at 3, passes
- [ ] `yarn lint` exits 0
- [ ] No files outside scope modified (`git status`)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report if:

- You find concrete evidence (a PRD, an active plan, a customer config with
  `maxPayoutDepth > 3` already in use) that depth > 3 is an intended, used
  feature — then this "unify at 3" decision is wrong; report before changing.
- Lowering the payout clamp would also lower the access-control traversal depth
  (it must not — keep `MAX_TREE_DEPTH` separate).
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If depth > 3 is ever productized, this constant is the single knob to raise —
  but it then also requires UI for level 4+ percentages and the legal review the
  FAQ references.
- Reviewer: confirm `MAX_TREE_DEPTH` (visibility) and `MAX_COMMISSION_LEVELS`
  (payouts) remain distinct.
