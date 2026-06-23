# Plan 003: Reverse purchase bonus and referral commission on refund/cancel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1830d2a..HEAD -- src/lib/services/order.service.ts src/lib/services/user.service.ts src/lib/services/referral.service.ts`
> If any in-scope file changed, compare "Current state" excerpts against live
> code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-webhook-idempotency.md (needs the deterministic `externalId` format to find what to reverse), plans/002-payout-chain-transaction.md (atomic-write pattern)
- **Category**: bug
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

When an order is refunded or cancelled, the system does nothing to the bonuses
it already paid. `changeOrderStatus` only updates the order status and writes a
history row — it never reverses the purchase bonus to the buyer or the referral
commission paid up the chain (trainer/manager/director). A customer can buy for
5000₽, trigger 350/100/50₽ in partner commission, then refund — and the partners
keep the money. In a b2b network this is a direct, recurring loss and a source of
disputes.

## Current state

`changeOrderStatus` updates status + history only, no bonus reversal
(`src/lib/services/order.service.ts:456-528`):

```ts
  static async changeOrderStatus(
    projectId: string,
    orderId: string,
    data: ChangeOrderStatusInput
  ): Promise<OrderWithRelations> {
    ...
      const order = await db.order.update({
        where: { id: orderId },
        data: { status: data.status },
        include: { ... }
      });
      // Создаем запись в истории
      await db.orderHistory.create({ data: { orderId: order.id, status: data.status, ... } });
      ...
```

`OrderStatus` is a Prisma enum (see `prisma/schema.prisma`,
`model Order { status OrderStatus ... }`). Inspect it to find the
cancel/refund member name(s) — likely `CANCELLED` and/or `REFUNDED`. Do not
assume; read the enum.

How bonuses were awarded (what you must reverse):
- Buyer purchase bonus: `BonusService.awardBonus` with `type: 'PURCHASE'`,
  transaction `externalId` = `tilda_order_<orderId>` (added in plan 001).
- Referral payouts: `type: 'REFERRAL'`, transaction `externalId` =
  `referral_<orderId>_<referrerId>_L<level>` (added in plan 001), and metadata
  carries `referredUserId`, `referralLevel`, `purchaseAmount`.

Existing spend/transaction model: `Transaction.type` is a `TransactionType`
enum — read it to find the reversal/debit member (e.g. `SPEND`, `DEBIT`, or a
dedicated reversal type). There is a `spendBonuses` method
(`src/lib/services/user.service.ts:956`) that creates negative/SPEND
transactions — read it to match the reversal write style and balance accounting.

Repo conventions: static service classes, `db.$transaction` for multi-write,
non-throwing where it would break a user flow, `logger` with `component`.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                 | exit 0              |
| Tests     | `yarn jest __tests__/services/order-refund-reversal.test.ts` | all pass   |
| Unit subset | `yarn jest __tests__/services`                   | all pass            |
| Lint      | `yarn lint`                                        | exit 0              |

## Scope

**In scope**:
- `src/lib/services/referral.service.ts` — add `reverseReferralBonus(orderId, projectId)`.
- `src/lib/services/user.service.ts` — add `reversePurchaseBonus(orderId, projectId)` (or a combined `reverseOrderBonuses`).
- `src/lib/services/order.service.ts` — call the reversal from `changeOrderStatus`/`deleteOrder` when the new status is a cancel/refund state.
- `__tests__/services/order-refund-reversal.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/lib/moysklad-direct/**` — МойСклад already handles its own returns via
  `moySkladSaleId` (`prisma/schema.prisma` comment); do not duplicate that path.
- The award path itself (covered by 001/002).
- Re-awarding on un-cancel (status flipping back) — explicitly deferred; see Maintenance.

## Git workflow

- Branch: `advisor/003-refund-reversal`
- Commit style: `feat(orders): reverse bonus and referral commission on refund`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the enums and pick the trigger states

Open `prisma/schema.prisma`. Record the exact `OrderStatus` members that mean
"money should be clawed back" (cancel/refund) and the `TransactionType` member
to use for a reversal/debit. If there is no suitable reversal transaction type,
STOP and report (a schema/enum addition is out of this plan's scope).

**Verify**: no command — you have the exact enum member names written down.

### Step 2: Implement reversal of the purchase bonus

Add `UserService.reversePurchaseBonus(orderId, projectId)` (name to match repo
style). It must:
- Look up the original EARN transaction by `externalId = tilda_order_<orderId>`
  (the format from plan 001). If none found → no-op, log info, return.
- If the bonus is unused, mark the `Bonus` reversed (`isUsed`/a status) and write
  a compensating negative/reversal `Transaction` referencing the original, inside
  a single `db.$transaction`.
- Be **idempotent**: set a deterministic reversal `externalId`
  (`reversal_tilda_order_<orderId>`) and skip if it already exists (so a repeated
  cancel webhook can't double-reverse).
- Handle the case where the buyer already **spent** the awarded bonus: do NOT
  drive the balance negative silently — reverse only what remains and log a
  structured warning with the shortfall so an admin can follow up. (Read
  `getUserBalance` / `spendBonuses` to match balance accounting.)

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Implement reversal of the referral commission

Add `ReferralService.reverseReferralBonus(orderId, projectId)`. It must:
- Find all REFERRAL transactions with `externalId` starting
  `referral_<orderId>_` (or query by metadata `referredUserId` + `purchaseAmount`
  if `externalId` is absent on pre-001 data — handle both).
- For each, write a compensating reversal transaction (idempotent via
  `reversal_<original externalId>`), inside `db.$transaction`.
- Apply the same "already spent" guard as Step 2 per ancestor.
- Be non-throwing at the top level (a reversal failure must be logged loudly but
  not crash the admin's order-status update); reuse the observable-partial-failure
  approach from plan 002.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Wire reversal into order status changes

In `src/lib/services/order.service.ts` `changeOrderStatus` (and `deleteOrder`,
which soft-deletes via status), after the status update succeeds and when the new
status is one of the cancel/refund members from Step 1 **and the previous status
was not already a cancel/refund state** (avoid re-running on repeated calls),
invoke both reversals. Wrap in try/catch so a reversal error does not throw out
of the status update; log it.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 5: Write the regression test

Create `__tests__/services/order-refund-reversal.test.ts`, modeled after
`__tests__/services/referral.service.test.ts`. Cover:
1. **Purchase reversal**: order with a `tilda_order_<id>` EARN transaction →
   cancelling creates exactly one reversal transaction; balance reduced by the
   awarded amount.
2. **Referral reversal**: order with two referral payouts → cancelling reverses
   both; idempotent on a second cancel (no extra reversals).
3. **Already spent**: buyer spent the bonus → reversal logs the shortfall and
   does not drive balance below zero.
4. **No-op**: cancelling an order that never awarded a bonus does nothing and
   does not throw.

**Verify**: `yarn jest __tests__/services/order-refund-reversal.test.ts` →
all pass.

## Test plan

- New file `__tests__/services/order-refund-reversal.test.ts`, four cases above.
- Pattern source: `__tests__/services/referral.service.test.ts`.
- `yarn jest __tests__/services` → all pass (no regressions).

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `yarn jest __tests__/services/order-refund-reversal.test.ts` passes (≥4 tests)
- [ ] `yarn jest __tests__/services` exits 0
- [ ] `yarn lint` exits 0
- [ ] Second cancel of the same order produces zero additional reversal transactions (asserted)
- [ ] Reversal never drives a user balance below zero (asserted)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report if:

- The `OrderStatus` or `TransactionType` enum has no suitable cancel/refund or
  reversal member (would need a schema change — out of scope).
- "Current state" excerpts don't match live code (drift).
- Reversing requires re-awarding logic on un-cancel — that's deferred; do not
  build it.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Deferred: re-awarding bonuses if a cancelled order is reactivated. Document the
  chosen one-way behavior in the b2b guide.
- Reviewer should scrutinize: idempotency of reversals, the "already spent"
  shortfall handling, and that no network side effects sit inside a
  `db.$transaction`.
- If МойСклад returns ever start flowing through this same path, ensure the
  `moySkladSaleId` reversal and this reversal don't double-apply.
