# Plan 013: Add a database index on `users.referred_by`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 32c72ac..HEAD -- prisma/schema.prisma src/lib/services/referral-commission.service.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive index; use `CONCURRENTLY` to avoid a write lock — see Step 2)
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `32c72ac`, 2026-07-06

## Why this matters

`users.referred_by` (Prisma: `User.referredBy`, a self-relation FK to
`User.id`) has **no index** — confirmed by reading every `@@index`/`@@unique`
on `User` (`prisma/schema.prisma:500-505`): `partnerRole`, `organizationId`,
and `partnerParentId` each have a `[projectId, X]` composite index;
`referredBy` has none, despite being a plain FK-shaped column. Postgres does
not auto-index non-unique FK scalar columns, so every query that joins or
filters on it does a sequential scan once the `users` table is large enough.

This column is the join key for **two recursive CTEs** that walk the entire
referral hierarchy — `getAncestorChain` and `getDescendantTree` in
`src/lib/services/referral-commission.service.ts:462-556` — both of which
self-join `users` to itself repeatedly:
```sql
-- getAncestorChain, :469-491
WITH RECURSIVE ancestors AS (
  SELECT id, referred_by, 0 AS depth FROM users WHERE id = ${userId} AND project_id = ${projectId}
  UNION ALL
  SELECT u.id, u.referred_by, a.depth + 1 AS depth
  FROM users u
  INNER JOIN ancestors a ON u.id = a.referred_by
  WHERE a.depth < ${safeDepth} AND u.project_id = ${projectId}
)
SELECT id, depth FROM ancestors WHERE id <> ${userId} ORDER BY depth ASC;
```
```sql
-- getDescendantTree, :521-543 (mirror image, joins on u.referred_by = d.id)
WITH RECURSIVE descendants AS (
  SELECT id, referred_by, 0 AS depth FROM users WHERE id = ${userId} AND project_id = ${projectId}
  UNION ALL
  SELECT u.id, u.referred_by, d.depth + 1 AS depth
  FROM users u
  INNER JOIN descendants d ON u.referred_by = d.id
  WHERE d.depth < ${safeDepth} AND u.project_id = ${projectId}
)
SELECT id, depth FROM descendants WHERE id <> ${userId} ORDER BY depth ASC;
```
Every recursion step re-scans `users` for the join, per-project. These two
CTEs back the commission-plan ancestor/descendant resolution used in payout
calculation — exactly the path most sensitive to latency at scale. The same
column is also the filter/group key in at least nine other call sites:
`analytics.service.ts:1021-1075` (`count`/`groupBy`/`aggregate` on
`referredBy`), `referral.service.ts:198-208,888-927,1023,1135,1145`
(payout-chain walk, direct-referral counts), `partner-team.service.ts:133-139,181-183,205,332,616,780-820`,
`referrer-assignment.service.ts:106-132` (cycle-guard walk), and the
hierarchy data-access/team API routes (`src/app/dashboard/projects/[id]/referral/hierarchy/data-access.ts:154-162`,
`src/app/api/projects/[id]/users/[userId]/team/route.ts:72-75`,
`.../team/[subjectUserId]/route.ts:70`).

No migration or `schema.prisma` line has ever referenced `referred_by` for
indexing (`grep -rl "referred_by\|referredBy" prisma/migrations/*/migration.sql`
→ no matches) — this isn't a regression, the index was simply never added.

## Current state

`prisma/schema.prisma`, `model User` (`:431-507`):
```prisma
model User {
  id                      String             @id @default(cuid())
  projectId               String             @map("project_id")
  ...
  referredBy              String?            @map("referred_by")     // :448
  ...
  referrer                User?              @relation("UserReferrals", fields: [referredBy], references: [id])  // :474
  referrals               User[]             @relation("UserReferrals")                                         // :475
  ...
  @@unique([projectId, email])       // :500
  @@unique([projectId, phone])       // :501
  @@unique([projectId, telegramId])  // :502
  @@index([projectId, partnerRole])       // :503
  @@index([projectId, organizationId])    // :504
  @@index([projectId, partnerParentId])   // :505
  @@map("users")
}
```
Every existing composite index on this model follows the `[projectId, X]`
shape (multi-tenant scoping first) — the new index should match that
convention for consistency and because every call site above filters by
`projectId` alongside `referredBy`.

Latest migrations (`prisma/migrations/`, newest first):
`20260607140000_add_subscription_auto_renew`, `20260607120000_partner_team_management`,
`20260606120000_add_partner_organizations`, ... — none touch this column.

This repo's `prisma migrate dev` is broken (shadow-DB replay fails —
project memory `bonus-system-dev-db-down`: `P3006/P1014 ... table projects
does not exist`). Apply this change via manual additive SQL instead, the
same way plans 005/007 shipped `prisma/manual/20260623_partner_payouts.sql`.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|-----------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit 2>&1 \| grep -c "error TS"`        | `101` (unchanged) |
| Generate  | `npx prisma generate`                              | exit 0 |
| Tests     | `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` | 2 failed / 24 passed suites baseline unchanged |
| Verify index exists | `psql $DATABASE_URL -c "\d users"` (or equivalent) | `users_project_id_referred_by_idx` (or chosen name) listed |

## Scope

**In scope**:
- `prisma/schema.prisma` — add `@@index([projectId, referredBy])` to `User`.
- `prisma/manual/20260706_referred_by_index.sql` (create).

**Out of scope**:
- Rewriting `getAncestorChain`/`getDescendantTree` or any other query —
  this plan only adds the index; query-shape changes are a separate concern.
- Any other model's indexes.
- `prisma migrate dev` / `migrate reset` — forbidden on this repo (see Current state).

## Git workflow

- Branch: `advisor/013-referred-by-index`
- Conventional-commit style, e.g. `perf(db): add index on users.referred_by for hierarchy queries`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add the index to `schema.prisma`

In `prisma/schema.prisma`, add to `User`'s index block (`:503-505`),
matching the existing `[projectId, X]` naming/ordering convention:
```prisma
@@index([projectId, referredBy])
```

**Verify**: `npx prisma generate` exits 0 (schema is syntactically valid; no DB round-trip needed for this check).

### Step 2: Write the manual SQL migration

Create `prisma/manual/20260706_referred_by_index.sql`, modeled on
`prisma/manual/20260623_partner_payouts.sql`'s idempotency style, but note:
**`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block** —
unlike the prior manual migrations in this repo, do NOT wrap this one in
`BEGIN`/`COMMIT`:
```sql
-- Non-transactional: CONCURRENTLY requires this to run outside a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_project_id_referred_by_idx
  ON users (project_id, referred_by);
```
Apply directly against the database (not via `prisma db execute`, which
Prisma runs wrapped in a transaction and will error on `CONCURRENTLY`):
```
psql "$DATABASE_URL" -f prisma/manual/20260706_referred_by_index.sql
```
If `psql` isn't available in the execution environment, `CREATE INDEX
CONCURRENTLY` still requires a direct non-transactional connection — do not
substitute `npx prisma db execute` for this specific statement (it will
fail with `CREATE INDEX CONCURRENTLY cannot run inside a transaction
block`); find another direct-SQL execution path instead and note which one
you used in your report. A plain (non-concurrent) `CREATE INDEX IF NOT
EXISTS` is only an acceptable fallback if the operator confirms a brief
write-lock on `users` is acceptable for this deploy — do not choose that
silently.

Then run `npx prisma generate` again so the client reflects the new
`@@index` (indexes don't change generated types, but keep this in the
sequence for consistency with how prior manual migrations were applied).

**Verify**: query the DB to confirm the index exists (`\d users` in `psql`,
or `SELECT indexname FROM pg_indexes WHERE tablename = 'users'`) and shows
`users_project_id_referred_by_idx`.

### Step 3: Confirm no regressions

Run the full typecheck and services test suite (commands above). This is a
pure additive index — no application code changed, so both should be
byte-for-byte the same as the pre-change baseline (101 tsc errors, 9/237
failing tests). Any change here means something unexpected happened; treat
as a STOP condition rather than investigating deeply in this plan's scope.

## Test plan

No new application test is needed — this is a database-only change with no
new code path. Verification is: (a) the index exists in the DB, (b) `tsc`
and the services test suite are unchanged from baseline. If you want extra
confidence, `EXPLAIN ANALYZE` the `getAncestorChain`/`getDescendantTree`
queries before/after against a project with a non-trivial referral tree and
confirm the plan switches from a sequential scan to an index scan/index
join on `referred_by` — this is optional (nice-to-have for the PR
description) but not a done-criterion, since most dev data won't be large
enough to make Postgres prefer the index either way.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `prisma/schema.prisma` has `@@index([projectId, referredBy])` on `User`
- [ ] `prisma/manual/20260706_referred_by_index.sql` exists, uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, and is applied against the target database
- [ ] The index `users_project_id_referred_by_idx` (or the name you chose) is confirmed present via a direct DB query
- [ ] `npx prisma generate` exits 0
- [ ] `npx tsc --noEmit` error count is 101 (unchanged)
- [ ] `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` — 2 failed / 24 passed suites, 9/237 tests, unchanged from baseline
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `32c72ac`).
- `CREATE INDEX CONCURRENTLY` isn't feasible in the execution environment
  (e.g. no direct psql/DB access, only `prisma db execute`) and a plain
  locking `CREATE INDEX` would need to run against a database with live
  production traffic — get the operator's explicit go-ahead before locking
  `users` for writes, even briefly; don't assume it's fine.
- The table is small enough in every environment you can check that you
  suspect this index won't matter in practice yet — still add it (it's
  cheap and correct), but note this observation in your report rather than
  skipping the plan.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If `partnerParentId` fully replaces `referredBy` as the payout-chain
  authority for all projects in the future (per plan 005's design — see
  `plans/005-explicit-payout-parent.md` and `User.partnerParentId`'s doc
  comment at `schema.prisma:489-493`), re-evaluate whether this index is
  still needed for the surviving `referredBy` call sites (analytics/counts)
  before dropping it — don't assume `partnerParentId`'s existing index
  (`:505`) makes this one redundant; they serve different query paths today.
