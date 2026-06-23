# Plan 007: Build — partner payout v1 (manual cashout)

> Derived from the design spike **006** (`docs/partner-payout-flow-design.md`),
> with the owner's v1 decisions locked (2026-06-23): bot-only request channel,
> manual payout + accounting export, commission stays bonuses (1:1 conversion).
>
> **Status**: money-engine CODE DONE & unit-tested; UI/bot/admin surfaces TODO.
> Schema migration NOT applied (no DB was available at build time).

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (money movement; mitigated — reserve/refund reuse existing
  `BonusService.spendBonuses`/`awardBonus` primitives)
- **Depends on**: 006 (design), 004 (depth), 005 (explicit parent)
- **Planned at**: commit on `advisor/005-explicit-payout-parent`, 2026-06-23

## Owner decisions (fixed)

1. Request channel: **Telegram bot only** (Tilda form not used in v1).
2. Payout execution: **manual** — request → admin approve → pay by hand + export.
3. Commission **stays bonuses**; withdrawal converts bonuses → money 1:1 at PAID.
4. Min threshold: **per-project** (`ReferralProgram.payoutMinAmount`, 0 = none).
5. Refund/clawback interaction kept simple (rare); optional `payoutHoldDays`.
6. Approver: **project admin**.

## What is DONE in this plan (verified)

- **Schema** (`prisma/schema.prisma`):
  - `model Payout` + `enum PayoutStatus` (REQUESTED→APPROVED→PAID,
    REJECTED/CANCELLED/FAILED terminal).
  - `ReferralProgram.payoutMinAmount` (Decimal, default 0) and
    `payoutHoldDays` (Int, default 0).
  - back-relations `payouts Payout[]` on `User` and `Project`.
  - `npx prisma generate` run (client types updated).
- **`src/lib/services/payout.service.ts`** — full state machine:
  - `requestPayout` — validates amount > 0 and ≥ `payoutMinAmount`; idempotent by
    `externalId`; **reserves bonuses** via `BonusService.spendBonuses` (atomic
    balance check, throws on insufficient); creates `Payout(REQUESTED)`; on
    create-failure-after-reserve it **refunds** the reserve (no silent debit).
  - `approvePayout` / `rejectPayout` / `markPaid` / `failPayout` / `cancelPayout`
    — atomic guarded transitions via `updateMany(where status in [...])`; non-PAID
    terminals refund the reserve idempotently (`payout_refund_<id>` via
    `BonusService.awardBonus`, which swallows P2002).
  - `markPaid` does NOT re-debit (reserve already taken at REQUESTED).
- **`__tests__/services/payout.service.test.ts`** — 10 passing: reserve on
  request, amount/threshold validation, idempotency, insufficient-balance
  propagation, reserve-rollback on create failure, REJECTED/CANCELLED refund,
  PAID no-re-debit, forbidden transition throws.
- Zero new tsc errors in touched files; full services suite = baseline 9
  failures + new passes (zero regressions).

> ⚠️ Reserve uses `BonusService.spendBonuses` (debit) and refund uses
> `BonusService.awardBonus` (credit) — NOT `UserService` (the 006 doc misnamed
> the class; these methods live on `BonusService` in `user.service.ts:869`).

## ACTION REQUIRED before this plan ships (needs a live DB)

```
npx prisma migrate dev --name partner_payouts   # generate + apply the migration
npx prisma generate
```

The schema change has no migration file yet (Prisma needs a DB to author it). Do
not deploy the Payout code without the migration — it references tables/columns
that don't exist until then.

## UI / bot / admin surfaces — BUILT (2026-06-23, branch `advisor/007-payout-ui`)

Implemented and compiling (`yarn build` exit 0; zero new tsc errors). Not yet
runtime-verified end-to-end (dev DB was down):

- **Bot request**: `PartnerPayoutsHandler` (`action-handlers.ts`) now shows
  "Доступно к выводу" + a "💸 Вывести деньги" button when balance > 0;
  `payout_request` / `payout_cancel:<id>` handled in
  `partner-cabinet.service.ts` (`handlePayoutRequest` requests the full available
  balance, idempotent by per-minute `externalId`; cancel returns the reserve).
  v1 simplification: requests the **full** available balance (partial-amount
  conversation is a follow-up).
- **Admin API**: `GET /api/projects/[id]/payouts` (queue, status filter) and
  `POST /api/projects/[id]/payouts/[payoutId]/{approve|reject|paid|fail}` —
  auth via `getCurrentAdmin` + `verifyProjectAccess`; delegates to PayoutService.
- **Admin UI**: `PayoutsAdminPanel` rendered as a **"Выплаты" tab** in the
  referral program view (`referral-program-view.tsx`), shown only when
  `enablePartnerRoles` — table with Approve/Reject (REQUESTED) and
  Выплачено/Сбой (APPROVED) actions + status filter.

### Also DONE (2026-06-23, branch `advisor/007-payout-csv-notify`)

- **CSV accounting export**: `GET /api/projects/[id]/payouts/export?status=&from=&to=`
  → `text/csv` (UTF-8 BOM for Excel; `payoutDetails` NOT exported). "CSV" button
  in the admin panel respects the active status filter.
- **Notifications**: partner notified on every status change (approve/reject/
  paid/fail) via `PartnerNotificationService.notifyPartnerPayoutStatus`; org
  director notified on a new request via `notifyDirectorAboutPayoutRequest`.
  Both fire-and-forget (swallow errors), wired at call sites (admin action route
  + bot handler) to keep `PayoutService` pure. Both build clean.

### Platform note: Telegram + MAX (both supported)

The payout request/cancel logic is platform-neutral:
`PartnerCabinetService.resolvePayoutAction(projectId, userId, data, opts)` returns
`{ toast, text, replyMarkup? }` (no platform ctx) and is rendered per platform:
- **Telegram**: `tryHandleTelegramCallback` renders via grammy; routed through
  the `isPartnerCabinet` gate in `telegram/bot.ts` (the gate was initially
  missing `payout_request`/`payout_cancel:` — fixed).
- **MAX**: `src/lib/max-bot/bot.ts` intercepts these callbacks before
  `executeWorkflow` (`handleMaxPayoutCallback`), resolves the MAX user by
  `maxId`, calls the same `resolvePayoutAction`, and renders via `ctx.reply` +
  `convertTelegramKeyboardToMax` (now exported from `platform-messaging.ts`).
  `Payout.requestSource` records `max_bot` vs `telegram_bot`.

Payout **notifications** reach both platforms (`dispatchPartnerNotification`).
Note: the broader cabinet callbacks (approve/reject team) are still Telegram-only
— only the payout flow was made cross-platform here.

### Still TODO

- ~~**Settings UI** for `payoutMinAmount` / `payoutHoldDays`~~ ✅ DONE
  (2026-06-23, branch `advisor/008-payout-settings-ui`): two fields added to the
  referral settings form (`referral-settings-form.tsx`), persisted via the
  `referral-program` PUT → `createOrUpdateReferralProgram` (`buildProgramData` +
  `mapReferralProgram`), Zod-validated (amount ≥ 0; hold days int 0..365). 3 unit
  tests; zero new tsc errors; zero test regressions.
- **Partial-amount** bot conversation (currently full-balance only).
- **E2E verification** against a live DB once migrations are applied.

## Original integration notes (reference)

Grounded file paths from `docs/partner-payout-flow-design.md` §10:

1. **Bot request flow**
   - Add "➕ Вывести деньги" button in the payouts section:
     `src/lib/workflow-templates/b2b-partner-cabinet.json` (callback
     `partner_payouts`), rendered by `PartnerPayoutsHandler`
     (`src/lib/services/workflow/handlers/action-handlers.ts:2184`).
   - Conversation for amount + payout details: reuse `bot-session.service.ts`.
   - Wire `payout_request` / `payout_cancel:<id>` callbacks into
     `partner-cabinet.service.ts:tryHandleTelegramCallback` (`:70`), invoked from
     `src/lib/telegram/bot.ts:180`. Call `PayoutService.requestPayout` /
     `cancelPayout`. Pass a deterministic `externalId` to dedupe double-taps.
2. **Notifications** — partner + admin via
   `src/lib/services/partner-notification.service.ts` /
   `src/lib/telegram/notifications.ts`.
3. **Admin queue + approval** — tab under
   `src/app/dashboard/projects/[id]/referral/`; API
   `GET /api/projects/[id]/payouts` and
   `POST /api/projects/[id]/payouts/[payoutId]/{approve|reject|paid|fail}`,
   auth copied from `.../users/[userId]/payouts/route.ts:31-42`
   (`getCurrentAdmin` + `verifyProjectAccess`). Call the matching
   `PayoutService` transitions.
4. **Accounting export** — `GET /api/projects/[id]/payouts/export?status=PAID`
   → CSV (columns in design §10). Mask `payoutDetails` in logs.
5. **Settings UI** — expose `payoutMinAmount` / `payoutHoldDays` in the b2b
   referral settings panel.
6. **E2E** — happy path + each unhappy path against a real DB; verify the
   reserve/refund actually moves the bonus balance and the clawback interaction
   with plan 003 (refund of a later-refunded order) behaves as designed.

## Done criteria (this plan)

- [x] `Payout` model + `PayoutStatus` enum + `ReferralProgram` payout settings in schema
- [x] `PayoutService` state machine with reserve/refund, unit-tested
- [x] Zero new tsc errors in touched files; zero test regressions
- [ ] Migration generated & applied (blocked: no DB at build time)
- [ ] Bot request flow + admin approval + CSV export (TODO above)
- [ ] `plans/README.md` row updated
