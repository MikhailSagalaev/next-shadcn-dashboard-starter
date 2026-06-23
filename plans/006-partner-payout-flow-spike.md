# Plan 006: Spike — real partner payout / withdrawal flow (money out, not store credit)

> **Executor instructions**: This is a **design/spike** plan, not a
> build-everything plan. Your deliverable is a written design document plus a
> minimal, reviewable data-model proposal — NOT a full feature. Do not ship UI or
> payment integrations. Follow the steps, produce the artifact, and STOP at the
> design review gate. Update the status row in `plans/README.md` when the design
> doc is delivered.
>
> **Drift check (run first)**: none required — this is investigative. Still
> begin by reading the files named in "Current state" to ground the design in
> what exists today.

## Status

- **Priority**: P3
- **Effort**: L (spike: ~1–2 days of investigation + design)
- **Risk**: LOW (no production code changes in this plan)
- **Depends on**: none (but the design should assume 001–003 land first)
- **Category**: direction
- **Planned at**: commit `1830d2a`, 2026-06-23

## Why this matters

Today a partner's referral commission is paid as **store-credit bonuses**
(`BonusService.awardBonus` with `type: 'REFERRAL'`) — the same balance a customer
spends in the shop. But a b2b partner (trainer, manager, director) earns this as
**income** and expects to withdraw **money**, not buy discounted products. There
is no withdrawal register, no payout states, no approval, no accounting export.
This gap is the difference between "a referral feature" and "a b2b partner
program a business can actually run." It is also a prerequisite for the
Russian-market tax/self-employment handling the b2b guide already flags as an
open legal question.

This spike defines the model and surfaces the decisions, so a follow-up build
plan can be written with confidence.

## Current state (read these to ground the design)

- `src/lib/services/referral.service.ts` — `processReferralBonus`: where
  commission is currently created as bonuses.
- `src/lib/services/user.service.ts` — `awardBonus`, `spendBonuses`,
  `getUserBalance`: the current balance/transaction model the payout flow must
  reconcile with.
- `prisma/schema.prisma` — `Bonus`, `Transaction`, `User` (`partnerRole`),
  `PartnerOrganization`. Note `Transaction.type` (`TransactionType` enum) and
  whether any payout/withdrawal type exists (it does not, as of `1830d2a`).
- `src/app/api/projects/[id]/users/[userId]/payouts/route.ts` — today's
  read-only "my payouts" = last referral EARN transactions. The withdrawal flow
  is the missing *outbound* counterpart.
- `docs/b2b-referral-hierarchy-guide.md` — FAQ on legal/MLM constraints and the
  "Organization" follow-up note.
- `src/lib/services/billing.service.ts` and `src/lib/services/invoice.service.ts`
  (if present) — existing money/document patterns to reuse rather than reinvent.

## Deliverable

A single design document at `docs/partner-payout-flow-design.md` containing the
sections below. No production source changes in this plan.

## Steps

### Step 1: Map the current money model

Document how commission flows today end-to-end (purchase → `processReferralBonus`
→ `Bonus`/`Transaction` → balance → spend). Identify exactly where "earned
commission" and "spendable shop balance" are conflated, and what would have to
separate them (e.g. a distinct `commissionBalance` vs `bonusBalance`, or a
`Payout`/`Withdrawal` entity that draws down earned commission).

### Step 2: Propose the data model

Propose the minimal schema additions (as a Prisma sketch in the doc, not applied)
to support:
- A `Payout` (a.k.a. `Withdrawal`) entity: amount, partner (`userId`), currency,
  status, requestedAt, processedAt, method, external/accounting refs, and a link
  to the commission transactions it settles.
- A payout **state machine**: enumerate states (e.g. `REQUESTED → APPROVED →
  PAID` / `REJECTED` / `FAILED`) and the allowed transitions, including
  idempotency keys (reuse the deterministic-`externalId` discipline from plan
  001).
- How earned-but-unwithdrawn commission is tracked so a partner can't withdraw
  more than they earned, and so refunds (plan 003) can claw back *unwithdrawn*
  commission cleanly.

### Step 3: Surface the decisions (do not decide unilaterally)

List the open product/legal decisions with options and a recommendation each:
- Store-credit vs real money vs both (per project flag?).
- Минимальный порог вывода и периодичность (hold period before commission is
  withdrawable — interacts with refunds).
- РФ tax/self-employment (НПД): does the platform generate чеки / collect
  agent-contract data, or only export for the client's accountant? (Cross-ref the
  guide's legal FAQ.)
- Payout method: manual (admin marks paid + accounting export) for v1 vs
  integrated payment rail later.
- Who approves payouts (project owner? director?).

### Step 4: Define the v1 build slice

Scope the smallest shippable version (recommendation: manual payouts — request,
admin approve, mark paid, CSV/accounting export — no payment-rail integration),
and write it as a bulleted hand-off that a future build plan (007) can expand
into the standard plan template. Explicitly list what v1 omits.

### Step 5: Design review gate

Present `docs/partner-payout-flow-design.md` and STOP. Do not start building.
The maintainer chooses a v1 slice; that choice becomes plan 007.

## Done criteria

- [ ] `docs/partner-payout-flow-design.md` exists with all five sections
- [ ] The doc contains a Prisma model sketch (not applied) for the payout entity + state machine
- [ ] The doc lists the open decisions with a recommendation each, cross-referencing the legal FAQ in `docs/b2b-referral-hierarchy-guide.md`
- [ ] The doc defines a concrete, minimal v1 slice and what it omits
- [ ] No production source files or schema were modified (`git status` shows only the new doc)
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report if:

- Implementing even the model requires decisions only the product owner can make
  (that's expected — capture them in Step 3, don't guess).
- You find an existing partial payout/withdrawal implementation in the repo —
  report it; the spike becomes "finish/refactor" instead of "design from
  scratch".

## Maintenance notes

- This design must stay consistent with plan 003: refunds claw back *unwithdrawn*
  commission; already-withdrawn commission needs a separate (manual) recovery
  policy — call that out in the doc.
- Keep the deterministic-`externalId` idempotency discipline from plan 001 in the
  payout state machine.
