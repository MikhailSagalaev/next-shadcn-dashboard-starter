# Plan 001: Make the Tilda webhook order→bonus path idempotent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1830d2a..HEAD -- src/lib/services/orders/order-processing.service.ts src/lib/services/referral.service.ts src/lib/services/user.service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

The Tilda/generic webhook path is **not idempotent**. When Tilda retries a
webhook (it does, on any non-2xx or timeout) or sends a duplicate, the system
re-awards the purchase bonus **and the entire multi-level referral commission
chain** (trainer + manager + director), and writes a duplicate order row. This
is real money paid twice to partners. The `Order.orderNumber` column is
`@unique`, but `saveOrder` explicitly catches the constraint violation and
continues instead of bailing — so the unique index protects nothing today.

The InSales integration already solved this correctly with a deterministic
`externalId` dedup check. This plan brings the Tilda path up to the same bar.

## Current state

Files involved:
- `src/lib/services/orders/order-processing.service.ts` — `processOrder` (the webhook entry path) and `saveOrder`.
- `src/lib/insales/insales-service.ts` — the **exemplar** dedup pattern to copy.
- `src/lib/services/user.service.ts` — `awardPurchaseBonus` and `awardBonus`.

`processOrder` calls `saveOrder` first, then awards bonuses
(`src/lib/services/orders/order-processing.service.ts:25-31`):

```ts
    // 2. Save Order to Database
    const savedOrder = await this.saveOrder(projectId, order);
```

`saveOrder` swallows the duplicate-`orderNumber` error and returns `null`, so
processing continues and bonuses are awarded again
(`src/lib/services/orders/order-processing.service.ts:215, 365-369`):

```ts
      const savedOrder = await db.order.create({
        data: {
          projectId,
          orderNumber: order.orderId,
          ...
    } catch (error) {
      logger.error('Failed to save order', { error, orderId: order.orderId });
      // Don't throw - order processing should continue even if analytics fails
      return null;
    }
```

The award + referral happen later with no dedup
(`src/lib/services/orders/order-processing.service.ts:174-182`):

```ts
    if (shouldEarn && earnBase > 0) {
      const result = await BonusService.awardPurchaseBonus(
        user.id,
        earnBase,
        order.orderId,
        `Order #${order.orderId}`
      );
```

The **exemplar to copy** — InSales does this correctly
(`src/lib/insales/insales-service.ts:76-98`):

```ts
      // Проверяем, не обработан ли уже этот заказ (используем уникальный внешний ID)
      const externalId = `insales_order_${order.id}`;
      const existingTransaction = await db.transaction.findUnique({
        where: { externalId }
      });

      if (existingTransaction) {
        logger.info('Order already processed, skipping', { ... }, 'insales-service');
        return { success: true, orderId: order.number, bonusAwarded: 0, message: 'Order already processed' };
      }
```

Relevant schema facts (already in `prisma/schema.prisma`, no migration needed):
- `Order.orderNumber` is `@unique`.
- `Transaction.externalId` is `String? @unique` and `Bonus.externalId` is `String? @unique`.
- `createTransaction` (`src/lib/services/user.service.ts:1122`) passes its
  `data` straight to `db.transaction.create`, so adding an `externalId` field to
  the transaction data works without schema changes.

Repo conventions: services are static-method classes; logs go through
`logger` with a `component` field; errors in the bonus path are non-throwing
(award failures must never break the customer's checkout). Match all three.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                 | exit 0, no errors   |
| Tests     | `yarn jest __tests__/services/order-processing.idempotency.test.ts` | all pass |
| Unit subset | `yarn jest __tests__/services`                   | all pass            |
| Lint      | `yarn lint`                                        | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/lib/services/orders/order-processing.service.ts`
- `src/lib/services/user.service.ts` (only to thread a deterministic `externalId` through; see Step 2)
- `src/lib/services/referral.service.ts` (only to set per-payout `externalId`; see Step 3)
- `__tests__/services/order-processing.idempotency.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/insales/insales-service.ts` — already idempotent; reference only.
- `src/lib/moysklad-direct/**` — has its own `externalId` dedup; leave it.
- `prisma/schema.prisma` — no schema change is needed; the unique columns already exist. If you think you need a migration, STOP.
- Any change to the `OrderProcessingResult` response shape consumed by the webhook route.

## Git workflow

- Branch: `advisor/001-webhook-idempotency`
- Conventional-commit style matching this repo's `git log`, e.g.
  `fix(orders): make tilda webhook bonus path idempotent`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add an early existence guard in `processOrder`

In `src/lib/services/orders/order-processing.service.ts`, before the
`saveOrder` call at line 26, query for an already-processed order and return
early if found. This is the primary, low-risk fix mirroring the InSales
exemplar.

Target shape (insert right after the `project` lookup, before `saveOrder`):

```ts
    // Idempotency guard: a duplicate/retried webhook must not re-award bonuses.
    const existingOrder = await db.order.findFirst({
      where: { projectId, orderNumber: order.orderId },
      select: { id: true }
    });
    if (existingOrder) {
      logger.info('Order already processed, skipping', {
        projectId,
        orderId: order.orderId,
        existingOrderId: existingOrder.id,
        component: 'order-processing'
      });
      return {
        success: true,
        message: 'Order already processed',
        data: {
          spent: 0,
          earned: 0,
          userId: null,
          orderId: existingOrder.id,
          userCreated: false,
          signupForm: false
        }
      };
    }
```

If the `data` shape above does not match the existing
`OrderProcessingResult` return type, adjust the fields to satisfy the type —
the intent (return early, award nothing) is what matters. If `order.orderId`
can be empty/falsy for legitimate signup forms, see STOP conditions.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Set a deterministic `externalId` on the purchase (EARN) transaction

This is defense-in-depth: even if the guard is bypassed (race between two
concurrent webhooks), the unique index rejects the second write.

In `src/lib/services/user.service.ts`, in `awardPurchaseBonus` (around line
1190 where `awardBonus` is called with the `orderId`), pass a deterministic
external id through to the created transaction. The cleanest seam: thread
`externalId: \`tilda_order_${orderId}\`` into the `awardBonus` call's data and
have `awardBonus` forward it to `createTransaction`.

Inspect `awardBonus` (`src/lib/services/user.service.ts:871-953`) and
`createTransaction` (`:1122-1134`). Add an optional `externalId` field to the
transaction data created inside `awardBonus` (the `createTransaction` call at
`:903-914`), sourced from `bonusData.metadata?.orderId` formatted as
`tilda_order_<orderId>` **only when** `metadata.source` indicates a Tilda/webhook
order (to avoid colliding with the InSales `insales_order_*` namespace — use a
distinct `tilda_order_` prefix).

Wrap the create in a duplicate-key tolerant guard: if `db.transaction.create`
throws a Prisma `P2002` unique-constraint error on `externalId`, treat the
operation as already-done and return the existing record rather than throwing
(the customer checkout must not break).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Give each referral payout a deterministic `externalId`

In `src/lib/services/referral.service.ts`, `processReferralBonus`
(`:340-544`) loops over the chain and calls `BonusService.awardBonus` per
level (`:476-498`). The method currently receives only `(userId, purchaseAmount)`
and the REFERRAL award has no order linkage at all.

Thread the `orderId` into `processReferralBonus` and set a per-payout external
id so retries can't double-pay any single ancestor:

- Change the signature to `processReferralBonus(userId, purchaseAmount, orderId?)`.
- Update the single caller in `src/lib/services/user.service.ts:1209` to pass `orderId`.
- In the per-level `awardBonus` call, add
  `externalId: \`referral_${orderId}_${referrer.id}_L${level}\`` (only when
  `orderId` is present), and add `orderId` into the `metadata` object alongside
  the existing `source: 'referral_bonus'`.
- Make the per-level award tolerant of a `P2002` on `externalId`: skip that
  level (already paid) and continue, logging at info level.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Write the idempotency regression test

Create `__tests__/services/order-processing.idempotency.test.ts`, modeled
structurally after `__tests__/services/referral.service.test.ts` (same import
style, same `jest.mock('@/lib/db', ...)` approach used across that folder —
read it first to match the mocking pattern).

Cover:
1. **Happy path**: first `processOrder` for a new `orderNumber` awards the
   purchase bonus exactly once and processes the referral chain once.
2. **Duplicate webhook**: second `processOrder` with the same `projectId` +
   `orderNumber` returns `message: 'Order already processed'` and calls
   `BonusService.awardPurchaseBonus` **zero** additional times.
3. **Referral dedup**: assert `processReferralBonus` does not produce a second
   set of payouts for the same `orderId` (assert via the mocked `awardBonus`
   call count per `externalId`).

**Verify**: `yarn jest __tests__/services/order-processing.idempotency.test.ts`
→ all pass (3+ tests).

## Test plan

- New file `__tests__/services/order-processing.idempotency.test.ts` with the
  three cases above.
- Structural pattern: `__tests__/services/referral.service.test.ts`.
- Full regression: `yarn jest __tests__/services` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `yarn jest __tests__/services/order-processing.idempotency.test.ts` passes with ≥3 new tests
- [ ] `yarn jest __tests__/services` exits 0 (no regressions)
- [ ] `yarn lint` exits 0
- [ ] A second `processOrder` for an existing `orderNumber` triggers zero additional `awardPurchaseBonus` calls (asserted in test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `1830d2a`).
- `order.orderId` (i.e. `orderNumber`) is frequently empty/undefined for
  legitimate signup-form submissions — the existence guard would then collapse
  all anonymous signups into one. If so, report: the guard needs a different key
  (e.g. only apply when `orderId` is non-empty AND `amount > 0`).
- Adding `externalId` requires a Prisma migration (it must not — the columns
  already exist; if `db.transaction`/`db.bonus` don't accept `externalId`,
  something is wrong, stop).
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a second sales channel is added, give it its own `externalId` namespace
  prefix (`tilda_order_`, `insales_order_`, `moysklad_*`) to avoid collisions.
- Plan 003 (refund reversal) will look up awarded bonuses/transactions by these
  `externalId`s to reverse them — keep the format stable and documented.
- Reviewer should scrutinize: the early-return `data` shape matches the
  response type; the `P2002` handling does not swallow unrelated errors (match
  on the Prisma error code, not a blanket catch).
