# Plan 005: Replace the payout-chain heuristic with explicit parent links

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1830d2a..HEAD -- src/lib/services/partner-team.service.ts src/lib/services/referral.service.ts`
> On any change to these files, compare "Current state" excerpts to live code; on
> a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/004-commission-depth-consistency.md (do 004 first so depth is consistent before touching chain resolution)
- **Category**: tech-debt
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

`resolvePayoutChain` reconstructs the org hierarchy by **guessing** when the
`referredBy` link runs out: it picks "the first MANAGER in the organization
ordered by `registeredAt`" and the director via `org.directorUserId`. In any org
with more than one manager, a trainer's commission can route to the *wrong*
manager — silently, with real money. The chain that determines who gets paid
should be explicit data, not a heuristic reconstructed at payout time.

This plan makes the payout chain follow an explicit parent link, so the person
who gets paid at each level is deterministic and auditable.

## Current state

`src/lib/services/partner-team.service.ts`, `resolvePayoutChain`
(`:653-747`) — the heuristic block:

```ts
      if (node.referredBy && !visited.has(node.referredBy)) {
        currentId = node.referredBy;
        continue;
      }

      if (!project?.enablePartnerRoles || !node.organizationId) break;

      const org = await db.partnerOrganization.findFirst({
        where: { id: node.organizationId, projectId },
        select: { directorUserId: true }
      });

      if (level === 0 && node.partnerRole === 'TRAINER') {
        const manager = await db.user.findFirst({
          where: {
            projectId,
            organizationId: node.organizationId,
            partnerRole: 'MANAGER',
            ...(org?.directorUserId ? { referredBy: org.directorUserId } : {})
          },
          select: { id: true, ... },
          orderBy: { registeredAt: 'asc' }   // <-- "first manager by date" = the guess
        });
        if (manager && !visited.has(manager.id)) { currentId = manager.id; continue; }
      }

      if (org?.directorUserId && !visited.has(org.directorUserId) && level >= 1) {
        currentId = org.directorUserId;
        continue;
      }
      break;
```

Caller: `ReferralService.processReferralBonus`
(`src/lib/services/referral.service.ts:445-455`) chooses `resolvePayoutChain`
when `enablePartnerRoles` is on, else `resolveReferrerChain` (pure `referredBy`
walk).

Data model facts to confirm in `prisma/schema.prisma` before designing:
- `User.referredBy` (self-relation, who invited them).
- `User.organizationId`, `PartnerOrganization.directorUserId`.
- Whether any explicit "manager/parent" field already exists on `User`. **Read
  the schema — do not assume.** If a suitable parent field exists, prefer it; if
  not, this plan adds one (migration in Step 2).

## The approach

Make `referredBy` (or a dedicated `partnerParentId`) the **authoritative** payout
parent for every partner, and require the migration/onboarding flows to set it,
so `resolvePayoutChain` becomes a simple, deterministic walk up explicit links —
no org-based guessing. The org/director fallback becomes a *validated* last
resort that logs a warning (so missing links are visible) rather than a silent
guess.

Because this touches money routing and possibly the schema, it is L/MED and
gated by several STOP conditions.

## Commands you will need

| Purpose   | Command                                              | Expected |
|-----------|------------------------------------------------------|----------|
| Typecheck | `npx tsc --noEmit`                                  | exit 0   |
| Migrate (dev, only if Step 2 needed) | `npx prisma migrate dev --name partner_parent_link` | applies cleanly |
| Generate  | `npx prisma generate`                              | exit 0   |
| Tests     | `yarn jest __tests__/services`                     | all pass |
| Lint      | `yarn lint`                                        | exit 0   |

## Scope

**In scope**:
- `src/lib/services/partner-team.service.ts` — `resolvePayoutChain` rewrite.
- `prisma/schema.prisma` + a new migration — **only if** no explicit parent
  field exists (Step 2).
- `scripts/migrate-partner-roles.ts` — backfill the parent link for existing
  partners (if a new field is added).
- `__tests__/services/` — new test for chain resolution.

**Out of scope** (do NOT touch):
- `resolveReferrerChain` (the c2c path) — leave it.
- Access-control traversals (`getAncestorChain`/`getDescendantTree`) — they walk
  `referredBy` for visibility and are correct; do not couple them to payout
  parent unless they already use the same field.
- Notification logic.

## Git workflow

- Branch: `advisor/005-explicit-payout-parent`
- Commit style: `fix(referral): route payouts via explicit parent link`
- Migration commits separate from logic commits.

## Steps

### Step 1: Decide the parent field (read schema first)

Read `prisma/schema.prisma`. Determine whether payout parentage is already
explicit. Two outcomes:
- **A — `referredBy` is sufficient**: every partner already has `referredBy`
  pointing at their payout parent (manager points at director, trainer at
  manager). Then no migration is needed; skip Step 2.
- **B — it is not** (trainers often lack a `referredBy` to their manager, which
  is exactly why the heuristic exists): add an explicit `partnerParentId` field.

Write down which outcome holds and why, with evidence (e.g. a query of how many
`TRAINER`/`MANAGER` rows have null `referredBy`). If you cannot determine this
from schema + a read-only count, STOP and report.

**Verify**: decision recorded; if A, note "no migration".

### Step 2: (Only for outcome B) Add and backfill `partnerParentId`

- Add `partnerParentId String? @map("partner_parent_id")` to `User` with a
  self-relation and an index, matching the existing `referredBy` self-relation
  style in the schema.
- `npx prisma migrate dev --name partner_parent_link` → applies cleanly.
- Extend `scripts/migrate-partner-roles.ts` (idempotent, like its existing
  behavior) to backfill `partnerParentId` from the best available signal
  (`referredBy` when present; otherwise leave null and **report** the count of
  partners needing manual assignment — do not guess).

**Verify**: `npx prisma generate` → exit 0; `npx tsc --noEmit` → exit 0.

### Step 3: Rewrite `resolvePayoutChain` to walk explicit links

Replace the org-heuristic block with a deterministic walk up the chosen field
(`referredBy` for outcome A, `partnerParentId` for B). Keep:
- cycle protection (`visited` set) and depth bound (already present),
- the `enablePartnerRoles` gate.

Change the org/director branch from a silent guess to a **validated fallback**:
if the explicit parent link is missing mid-chain, do NOT guess a manager by
registration date. Instead stop the chain there and emit a structured
`logger.warn` ("payout chain broken: missing parent link", with userId/level) so
the gap is visible and fixable, rather than paying the wrong person.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Test deterministic resolution

Add `__tests__/services/partner-payout-chain.test.ts` (model after
`__tests__/services/referral.service.test.ts`). Cover:
1. Linear chain trainer→manager→director via explicit links resolves all three
   in order.
2. **Two managers in one org**: trainer linked to manager B resolves to B, never
   to the earlier-registered manager A (this is the bug being fixed).
3. Broken link mid-chain: chain stops at the gap and logs a warning; does not
   pay an unrelated user.

**Verify**: `yarn jest __tests__/services/partner-payout-chain.test.ts` → all pass.

## Test plan

- New `__tests__/services/partner-payout-chain.test.ts`, three cases above
  (case 2 is the regression that proves the heuristic is gone).
- `yarn jest __tests__/services` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `yarn jest __tests__/services/partner-payout-chain.test.ts` passes incl. the two-managers case
- [ ] `grep -n "orderBy: { registeredAt: 'asc' }" src/lib/services/partner-team.service.ts` no longer appears inside `resolvePayoutChain`
- [ ] `yarn jest __tests__/services` exits 0
- [ ] `yarn lint` exits 0
- [ ] If a migration was added: `npx prisma migrate dev` applied and `migrate-partner-roles.ts` backfill is idempotent (running twice changes nothing the second time)
- [ ] No files outside scope modified (`git status`)
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report if:

- You cannot determine from schema + read-only counts whether `referredBy` is a
  sufficient payout parent (outcome A vs B).
- Removing the heuristic would break existing production orgs that rely on it and
  have no explicit links AND no backfill signal — report the count and proposed
  manual-assignment step instead of guessing.
- Access-control traversals turn out to share the same field and would change
  behavior — report before proceeding.
- A migration fails to apply, or a verification fails twice after a reasonable
  fix.

## Maintenance notes

- After this lands, onboarding/admin flows must set the payout parent explicitly
  when assigning a partner role (tie-in with direction plan 006).
- The `logger.warn` on broken chains is an operational signal — consider
  surfacing it on the hierarchy page as a data-quality badge.
- Reviewer: the regression test's two-managers case is the whole point — make
  sure it genuinely fails against the old heuristic.
