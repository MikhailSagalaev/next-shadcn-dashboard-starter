# Plan 011: Verify Telegram/MAX webhook requests with a per-project secret

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 32c72ac..HEAD -- src/app/api/telegram/webhook src/app/api/webhook/max-bot src/lib/telegram/bot-manager.ts src/lib/max-bot/bot-manager.ts prisma/schema.prisma`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (Telegram side is low-risk/atomic; the MAX side requires a
  URL change and a coordinated re-registration rollout — see Step 3 and STOP
  conditions)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32c72ac`, 2026-07-06

## Why this matters

`src/app/api/telegram/webhook/[projectId]/route.ts` and
`src/app/api/webhook/max-bot/[projectId]/route.ts` identify which bot/project
to act on **solely from the `projectId` in the URL** — there is no
`middleware.ts` protection for either path (neither starts with `/dashboard`,
`/api/admin`, or `/api/projects`, so `requiresAuth` is `false` — see
`src/middleware.ts:4,46`), and no signature/secret check inside either
handler at all. `projectId`s are CUIDs, not secrets, and are visible in
dashboard URLs, browser devtools, and the widget/bot config screens.

Anyone who obtains a `projectId` (a customer, a curious visitor, a scraped
CUID) can `POST` a forged Telegram `Update` or MAX event straight to that
project's bot handler. Since the bot flow engine executes bonus-affecting
actions (balance replies, referral flows, workflow triggers) keyed off the
`chatId`/`telegramId`/`maxId` in the forged payload, this is a path to
triggering bot-side logic **as if it came from any arbitrary end user of that
project**, without ever talking to Telegram/MAX.

Telegram has a native, purpose-built defense for exactly this
(`secret_token` on `setWebhook`, checked via the
`X-Telegram-Bot-Api-Secret-Token` header) that this codebase already has
installed but unused. MAX's bot SDK (checked in this repo,
`@maxhub/max-bot-api@0.2.2`) has no typed support for an equivalent — its
`ApiMethods` type (`node_modules/@maxhub/max-bot-api/dist/core/network/api/modules/types.d.ts`)
doesn't even list a `subscriptions` method; the existing registration code
already reaches past the SDK's types with `(bot.api.raw as any).client.call`
(`src/lib/max-bot/bot-manager.ts:178`). Do not invent a MAX header/signature
scheme the platform hasn't documented — use the URL-embedded-secret pattern
this codebase already established for its generic webhook
(`Project.webhookSecret`, `/api/webhook/[webhookSecret]/route.ts`) instead.

## Current state

Files involved:
- `src/app/api/telegram/webhook/[projectId]/route.ts` — POST handler (`:52-203`).
- `src/lib/telegram/bot-manager.ts` — `_createBotInternal` (webhook setup `:894-960`), `getWebhookHandler` (`:1383+`).
- `src/app/api/webhook/max-bot/[projectId]/route.ts` — POST handler (`:48-108`).
- `src/lib/max-bot/bot-manager.ts` — webhook registration (`:150-200`).
- `prisma/schema.prisma` — `model Project` (`:10+`).

**Telegram — no secret is set today** (`src/lib/telegram/bot-manager.ts:894-953`):
```ts
webhook = webhookCallback(bot, 'std/http');
const webhookUrl = `${this.WEBHOOK_BASE_URL}/api/telegram/webhook/${projectId}`;
if (webhookUrl.startsWith('https://')) {
  ...
  await bot.api.setWebhook(webhookUrl, {
    allowed_updates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result'],
    drop_pending_updates: true
  });
```
grammy's `webhookCallback` **already supports secret validation as a 5th
argument**, and `setWebhook`'s options type carries `secret_token`
(both confirmed in this repo's installed `grammy@1.37.0`):
```
node_modules/grammy/out/convenience/webhook.d.ts:34:    secretToken?: string;
node_modules/grammy/out/convenience/webhook.d.ts:58:export declare function webhookCallback<...>(bot, adapter, onTimeout?, timeoutMilliseconds?, secretToken?): ...
node_modules/grammy/out/core/api.d.ts:89: ... secret data in the parameter secret_token ... header "X-Telegram-Bot-Api-Secret-Token" ...
```
The produced `webhook` function is stored on the in-memory `BotInstance` and
returned by `getWebhookHandler(projectId)`
(`src/lib/telegram/bot-manager.ts:1383,1432`); the route calls it directly
with a `Request` built from the raw body + headers
(`src/app/api/telegram/webhook/[projectId]/route.ts:156-163`):
```ts
const gramRequest = new Request(request.url, { method: 'POST', headers: request.headers, body: body });
const response = await webhookHandler(gramRequest);
```
**This means grammy itself will reject a bad/missing secret** once a
`secretToken` is passed at creation — no changes to `route.ts` are required
for the Telegram side; the fix is contained to `bot-manager.ts` + schema.

**MAX — registration has no secret at all** (`src/lib/max-bot/bot-manager.ts:159,178-187`):
```ts
const webhookUrl = `${this.webhookBaseUrl}/api/webhook/max-bot/${projectId}`;
...
const response = await (bot.api.raw as any).client.call({
  method: 'subscriptions',
  options: { method: 'POST', body: { url: webhookUrl, update_types: [...] } }
});
```
The MAX webhook route (`src/app/api/webhook/max-bot/[projectId]/route.ts:48-108`)
resolves the bot via `maxBotManager.getBotForWebhook(projectId)` (`:80`) and
calls `handleUpdate` directly — no header/secret check anywhere.

**Schema today** (`prisma/schema.prisma:10-33`): `Project` already has
`webhookSecret String @unique @default(cuid())` (`:14`) — but this is the
**generic** webhook's secret (`ProjectService`, `/api/webhook/[webhookSecret]/route.ts`),
a different route family. There is no `telegramWebhookSecret` /
`maxWebhookSecret` field. `botToken`/`botUsername` (Telegram) and
`maxBotToken`/`maxBotUsername` (MAX) live directly on `Project` (`:29-32`) —
no separate bot-config model exists.

Repo conventions confirmed relevant here: schema changes must be additive
and applied via **manual SQL**, not `prisma migrate dev` — see the project
memory `bonus-system-dev-db-down` (shadow-DB replay is broken on this repo;
prod DB `bonus_system` holds real data). Follow the same pattern as
`prisma/manual/20260623_partner_payouts.sql`: an idempotent, transaction-wrapped,
additive `.sql` file applied with `npx prisma db execute --file <file> --schema prisma/schema.prisma`
followed by `npx prisma generate`.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|-----------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit 2>&1 \| grep -c "error TS"`        | `101` (unchanged — see STOP conditions) |
| Tests     | `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` | current baseline: 2 failed / 24 passed suites, 9 failed / 228 passed tests — no new failures |
| New test  | `npx jest __tests__/services/telegram-webhook-secret.test.ts` (create) | all pass |
| Lint      | `yarn lint`                                        | exit 0              |

Note: always pass `--testPathIgnorePatterns="node_modules\|\\.claude"` (or
run from a clean checkout without stray worktrees) — this repo has leftover
`.claude/worktrees/*/__tests__/...` directories from prior plan executions
that jest's default config does NOT exclude (`jest.config.cjs` has no
`testPathIgnorePatterns`), which silently triples the reported failure count
if left in. Don't delete those worktrees as part of this plan — out of scope
(see plan 015's Step 1, which also touches `jest.config.cjs`).

## Scope

**In scope**:
- `prisma/schema.prisma` — add `telegramWebhookSecret String? @map("telegram_webhook_secret")` and `maxWebhookSecret String? @map("max_webhook_secret")` to `Project`.
- `prisma/manual/20260706_bot_webhook_secrets.sql` (create) — additive columns.
- `src/lib/telegram/bot-manager.ts` — generate/persist/thread the Telegram secret.
- `src/app/api/webhook/max-bot/[projectId]/route.ts` → move to `src/app/api/webhook/max-bot/[projectId]/[secret]/route.ts` — validate the URL secret.
- `src/lib/max-bot/bot-manager.ts` — generate/persist the MAX secret; build the new webhook URL; re-register.
- `scripts/backfill-webhook-secrets.ts` (create) — one-time rollout script for already-active bots.
- `__tests__/services/telegram-webhook-secret.test.ts`, `__tests__/services/max-webhook-secret.test.ts` (create).

**Out of scope**:
- `src/app/api/telegram/webhook/[projectId]/route.ts` — do NOT add manual
  header comparison here; grammy's `webhookCallback(..., secretToken)`
  already does this (see Current state). If you find yourself editing this
  file's validation logic, STOP and re-read Step 1.
- `src/app/api/webhook/[webhookSecret]/route.ts` and `ProjectService`'s
  generic `webhookSecret` — a different, already-secret-gated route family;
  do not touch or reuse this field for Telegram/MAX.
- Rate limiting on either webhook (that's plan 014's balance-endpoint scope,
  not this one — webhooks are a different threat model once secret-gated).
- Any change to `bot.api.setWebhook`'s `allowed_updates` list or MAX's
  `update_types` list.

## Git workflow

- Branch: `advisor/011-webhook-secret-token`
- Conventional-commit style, e.g. `fix(bots): verify telegram/max webhook requests with a per-project secret`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Schema — add the two secret columns

Add to `prisma/schema.prisma`'s `Project` model (near `webhookSecret`, `:14`):
```prisma
telegramWebhookSecret String? @map("telegram_webhook_secret")
maxWebhookSecret       String? @map("max_webhook_secret")
```
Both nullable — existing projects backfill via Step 4's script, not a
migration default.

Create `prisma/manual/20260706_bot_webhook_secrets.sql`, modeled on
`prisma/manual/20260623_partner_payouts.sql` (idempotent, wrapped in a
transaction, `ADD COLUMN IF NOT EXISTS`):
```sql
BEGIN;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_webhook_secret TEXT;
COMMIT;
```
Apply with `npx prisma db execute --file prisma/manual/20260706_bot_webhook_secrets.sql --schema prisma/schema.prisma`,
then `npx prisma generate`. Do NOT run `prisma migrate dev` (broken shadow
DB, see `bonus-system-dev-db-down` memory) and do NOT run `migrate reset`.

**Verify**: `npx prisma generate` exits 0; `npx tsc --noEmit` error count unchanged at 101 (or lower — never higher).

### Step 2: Telegram — generate, persist, and enforce the secret

In `src/lib/telegram/bot-manager.ts`, before the `webhook = webhookCallback(bot, 'std/http')` line (`:894` area, inside `_createBotInternal`), add a small helper (e.g. `private async getOrCreateTelegramSecret(projectId: string): Promise<string>`) that:
1. Reads `db.project.findUnique({ where: { id: projectId }, select: { telegramWebhookSecret: true } })`.
2. If null, generates one with `crypto.randomBytes(32).toString('hex')` (Node's built-in `crypto`, already available — check existing imports in this file for the convention) and persists via `db.project.update({ where: { id: projectId }, data: { telegramWebhookSecret: secret } })`.
3. Returns the secret.

Do not assume `botSettings.project` is populated at every call site into
`_createBotInternal` — some callers pass a bare `BotSettings` without the
`project` relation (see the lazy-load path at `:1394-1397` which explicitly
does `include: { project: true }`, implying other call sites may not). Fetch
independently rather than threading it through the existing parameter.

Then:
```ts
const telegramSecret = await this.getOrCreateTelegramSecret(projectId);
webhook = webhookCallback(bot, 'std/http', undefined, undefined, telegramSecret);
...
await bot.api.setWebhook(webhookUrl, {
  allowed_updates: [...],
  drop_pending_updates: true,
  secret_token: telegramSecret
});
```

**Verify**: `npx tsc --noEmit` — error count still 101, not higher.

### Step 3: MAX — URL-embedded secret (route restructure)

Move `src/app/api/webhook/max-bot/[projectId]/route.ts` to
`src/app/api/webhook/max-bot/[projectId]/[secret]/route.ts`. In the new
`POST`/`GET` handlers, read `secret` from `context.params`, load
`project.maxWebhookSecret` (via `db.project.findUnique`), and return `404`
(not `401` — don't reveal whether a project exists to an unauthenticated
caller) if the secret is missing or doesn't match, **before** calling
`maxBotManager.getBotForWebhook`. Keep the rest of the handler body
unchanged.

In `src/lib/max-bot/bot-manager.ts`, add the mirror of Step 2's helper for
`maxWebhookSecret`, and change the URL construction at `:159`:
```ts
const maxSecret = await this.getOrCreateMaxSecret(projectId);
const webhookUrl = `${this.webhookBaseUrl}/api/webhook/max-bot/${projectId}/${maxSecret}`;
```
The `subscriptions` POST body (`:178-187`) is unchanged — the secret rides
in the URL, not the request body.

**This is a breaking URL change for any bot currently registered on the old
URL** — see Step 4 and STOP conditions; do not consider this step "done"
until the rollout script has re-registered every active MAX bot.

**Verify**: `npx tsc --noEmit` — error count still 101, not higher.

### Step 4: Rollout script — backfill secrets and re-register active bots

Create `scripts/backfill-webhook-secrets.ts`. For every `Project` with an
active Telegram bot (`botStatus: 'ACTIVE'`, `operationMode: 'WITH_BOT'`) and/or
an active MAX bot (however MAX bot activity is tracked — check
`maxBotToken`/`MaxBotSettings`-equivalent; mirror the pattern used for
Telegram's `botSettings.isActive` check at `bot-manager.ts:1401`):
1. Skip projects that already have a non-null secret for that platform (idempotent — safe to re-run).
2. Generate + persist the secret (reuse the Step 2/3 helpers rather than duplicating the generation logic — export them or add a small public wrapper method on `botManager`/`maxBotManager`).
3. Re-run that platform's existing webhook-registration path for the project (e.g. call the bot manager's existing `startBot`/`createBot`-equivalent re-entry point — do NOT hand-roll a second `setWebhook`/`subscriptions` call; reuse Step 2/3's code path so registration logic never diverges).
4. Log per-project success/failure; continue on error (one broken project must not abort the batch).

Support `--dry-run` (report which projects would be touched, make zero
writes/network calls) matching the convention in
`scripts/migrate-partner-roles.ts` (referenced in prior plans' execution log).

**Verify**: `npx tsx scripts/backfill-webhook-secrets.ts --dry-run` runs and
prints a per-project plan without error.

### Step 5: Tests

Create `__tests__/services/telegram-webhook-secret.test.ts`: mock
`db.project`, assert `getOrCreateTelegramSecret` generates once and reuses
on a second call (no duplicate `db.project.update`), and assert
`_createBotInternal`'s `webhookCallback`/`setWebhook` calls receive the
secret (spy on the mocked `webhookCallback`/`bot.api.setWebhook`).

Create `__tests__/services/max-webhook-secret.test.ts`: same pattern for
the MAX secret helper, plus a route-level case (using the pattern in
`__tests__/services/workflow/max-bot-webhook.test.ts` if it mocks the route
handler) asserting the `[secret]` route returns 404 for a wrong/missing
secret and proceeds normally for a correct one.

**Verify**: `npx jest __tests__/services/telegram-webhook-secret.test.ts __tests__/services/max-webhook-secret.test.ts --testPathIgnorePatterns="node_modules\|\\.claude"` → all pass.

## Test plan

- Two new test files (Step 5).
- Full regression: `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` → 2 failed / 24 passed suites baseline unchanged, plus the new suites passing (no new failures).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx prisma db execute --file prisma/manual/20260706_bot_webhook_secrets.sql --schema prisma/schema.prisma` applied; `npx prisma generate` exits 0
- [ ] `npx tsc --noEmit` error count is 101 or lower (never higher than the pre-change baseline)
- [ ] `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` shows no new failures beyond the existing 9/237, plus the 2 new test files passing
- [ ] `yarn lint` exits 0
- [ ] A forged Telegram POST without the correct `X-Telegram-Bot-Api-Secret-Token` header is rejected before reaching bot flow logic (asserted in test)
- [ ] A MAX POST to the old (secret-less) URL 404s; the new `[secret]` URL with a wrong secret 404s; with the correct secret it behaves as before (asserted in test)
- [ ] `scripts/backfill-webhook-secrets.ts --dry-run` runs cleanly against current data
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `32c72ac`).
- `webhookCallback`'s 5th-argument `secretToken` behavior in the installed
  grammy version does not actually validate/reject on mismatch (verify this
  directly — e.g. by reading `node_modules/grammy/out/convenience/webhook.js`
  or with a focused unit test — before relying on it silently).
- MAX's `handleUpdate`/webhook flow depends on the exact URL shape in a way
  that breaks when a path segment is appended (e.g. some routing logic
  elsewhere hardcodes `/api/webhook/max-bot/${projectId}` as a two-segment
  path). Grep for this string across `src/` before starting Step 3.
- Running the Step 4 rollout script against production would re-register
  webhooks for bots that are mid-conversation with real users, and there is
  no safe maintenance window — this needs the operator's explicit go-ahead
  before running against prod, not just `--dry-run` in dev.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a third messaging platform is added, follow the MAX URL-embedded-secret
  pattern (assume no native header/signature support until docs confirm
  otherwise), not the Telegram header pattern.
- The rollout script (Step 4) should be safe to re-run indefinitely
  (idempotent) — future bot activations should call the same
  secret-provisioning helper automatically, so this script becomes unnecessary
  after the first run, not a permanent operational step.
- Reviewer should scrutinize: MAX route returns `404` (not `401`/`403`) on
  secret mismatch, to avoid confirming project existence to a prober; the
  Telegram secret is never logged (check the `logger.info` calls this plan
  touches in `bot-manager.ts` don't accidentally include it).
