# Plan 015: Replace the dead pre-push gate with a scoped one, add AGENTS.md + .env.example

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 32c72ac..HEAD --
> .husky/pre-push jest.config.cjs package.json`. If any changed since this
> plan was written, compare the "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: developer experience
- **Planned at**: commit `32c72ac`, 2026-07-06

## Why this matters

Per the project memory `baseline-red-leave-untouched`: the owner has
already decided **not** to fix this repo's pre-existing `tsc`/test baseline
— it's dominated by an unrelated, half-finished МойСклад integration and
isn't worth blind risk to chase. That decision is correct and this plan
does not revisit it. But the consequence is that `.husky/pre-push`:
```sh
cd "$(git rev-parse --show-toplevel)"
yarn lint && yarn build && npx tsc --noEmit
```
runs `npx tsc --noEmit` against a repo that has had **101 pre-existing
errors** (verified fresh, `grep -c "error TS"` on `npx tsc --noEmit`'s
output today — up from ~82-91 measured 13 days ago per the same memory and
the stale `baseline-tsc.log` in the repo root; the number drifts upward
over time because nothing enforces it). `yarn lint` and `yarn build` pass;
only `tsc` blocks — every push on this repo goes through `--no-verify`,
which the owner currently has to authorize by hand each time. A gate that
always fails isn't a gate — it's a step everyone has learned to skip, which
means it also won't catch a **genuinely new** type error introduced by a
future change. The fix isn't "make tsc pass" (rejected, see above); it's
"make the gate check for *new* errors only" — the same distinction plans
001-007 already used per-change (see e.g. plan 001's "zero new tsc errors"
verification standard) but nothing enforces automatically at push time.

Separately, while investigating this: **`yarn test:unit`, `test:integration`,
and `test:components` are currently broken** — confirmed by running
`yarn test:unit`, which exits `1` with:
```
Option "testPathPattern" was replaced by "--testPathPatterns". "--testPathPatterns" is only
available as a command-line option. Please update your configuration.
```
This repo's Jest was upgraded to `30.1.3` (`yarn jest --version`), which
renamed the config-level `testPathPattern` option
(`package.json:26-28`: `"test:unit": "jest --testPathPattern=services"`
etc.) to a CLI-only `--testPathPatterns`. These three scripts have been
silently non-functional since that upgrade — anyone running `yarn
test:unit` today gets an immediate CLI error, not a test result. This
plan's scoped gate needs a working test invocation, so it fixes these
scripts as a prerequisite.

Also discovered: **`jest.config.cjs` has no `testPathIgnorePatterns`**, so
any full-repo or `__tests__/services`-scoped jest run also picks up stale
test files inside leftover `.claude/worktrees/*/…` directories from prior
plan executions (this repo currently has at least 7 such worktrees).
Confirmed directly: `npx jest __tests__/services` (no ignore pattern) — 28
failed / 147 passed suites, 108/1732 tests; the same command with
`--testPathIgnorePatterns="node_modules|\.claude"` — **2 failed / 24 passed
suites, 9/237 tests**. The second number is the real baseline (matches the
9-failing-tests figure recorded in `plans/README.md`'s execution log); the
first is noise from duplicate/stale code. Any gate built on the unfiltered
number would be measuring the wrong thing.

Finally: there is no `AGENTS.md`/`CLAUDE.md` and no `.env.example` anywhere
in this repo (confirmed — root directory listing has neither). Every new
agent or engineer currently has to rediscover, from scratch: the red
baseline and why it's intentional, that `prisma migrate dev` is broken and
manual SQL is the workaround, and all ~40+ environment variables the app
actually reads, by grepping the codebase. This has already happened at
least twice (the two existing memory files this session is built on were
themselves the product of one such rediscovery).

## Current state

`.husky/pre-push` (full content, 2 lines):
```sh
cd "$(git rev-parse --show-toplevel)"
yarn lint && yarn build && npx tsc --noEmit
```
`.husky/pre-commit` (unrelated, untouched by this plan):
```sh
npx lint-staged
```
`package.json` scripts (relevant lines):
```
12:    "build": "next build",
17:    "lint": "node scripts/run-eslint.mjs src",
23:    "test": "jest",
26:    "test:unit": "jest --testPathPattern=services",
27:    "test:integration": "jest --testPathPattern=api",
28:    "test:components": "jest --testPathPattern=components",
39:    "production:check": "yarn lint && yarn test && yarn build && npx tsc --noEmit",
```
No `"typecheck"` script exists — `.husky/pre-push` invokes `npx tsc
--noEmit` directly.

`jest.config.cjs` (full content, 26 lines) — `testMatch` globs for
`__tests__/{sanity,services,adapters,widgets,integration}/**/*.test.ts`, no
`testPathIgnorePatterns` key at all (Jest's own default is only
`/node_modules/`).

`.env` exists (not `.env.example`); its variable **names** (not values):
`CRON_SECRET, DATABASE_URL, ENABLE_CONSOLE_LOGS, GRAFANA_ADMIN_PASSWORD,
GRAFANA_API_KEY, GRAFANA_URL, JWT_SECRET, LOG_LEVEL, LOKI_URL,
MOYSKLAD_ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXT_PUBLIC_APP_URL,
NEXT_PUBLIC_GRAFANA_URL, NODE_ENV, PORT, REDIS_HOST, REDIS_PASSWORD,
REDIS_PORT, REDIS_URL, RESEND_API_KEY, RESEND_FROM_EMAIL,
SUPER_ADMIN_PASSWORD, TELEGRAM_API_ROOT, TWO_FACTOR_APP_NAME,
TWO_FACTOR_ENCRYPTION_KEY, WEBHOOK_BASE_URL`.

Full deduplicated list of everything actually read via `process.env.` across
`src/`, `scripts/`, `prisma/` (46 vars, grouped — used in Step 3):
```
Database/Cache:     DATABASE_URL, REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
Auth/Security:      NEXTAUTH_SECRET, NEXTAUTH_URL, JWT_SECRET, ENCRYPTION_KEY,
                    TWO_FACTOR_APP_NAME, TWO_FACTOR_ENCRYPTION_KEY, SUPER_ADMIN_PASSWORD,
                    CRON_SECRET, SKIP_CONFIRMATION
Telegram:           TELEGRAM_API_ROOT, TELEGRAM_PROXY_URL, TEST_BOT_TOKEN
MAX messenger:      MAX_BOT_USE_WEBHOOK
YooKassa:           YOOKASSA_RETURN_URL, YOOKASSA_SECRET_KEY, YOOKASSA_SHOP_ID,
                    YOOKASSA_WEBHOOK_SKIP_IP_CHECK
Moysklad:           MOYSKLAD_ENCRYPTION_KEY (falls back to ENCRYPTION_KEY,
                    src/lib/moysklad/encryption.ts:29)
App/URLs/Webhooks:  APP_URL, NEXT_PUBLIC_APP_URL, WEBHOOK_BASE_URL, API_REQUEST_ALLOWED_DOMAINS
Logging/Ops:        LOG_LEVEL, ENABLE_CONSOLE_LOGS, PERSIST_LOGS, NEXT_PUBLIC_GRAFANA_URL,
                    NODE_ENV, NEXT_RUNTIME, WORKFLOW_EXECUTION_RETENTION_DAYS
Email:              RESEND_API_KEY, RESEND_FROM_EMAIL, NOTIFICATION_SERVICE_TOKEN
Misc integrations:  ANALYTICS_API_KEY, ANALYTICS_SERVICE_URL, CRM_API_TOKEN, PAYMENT_GATEWAY_KEY
Company/invoicing:  COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_INN, COMPANY_KPP, COMPANY_NAME
```
Insales and Tilda integrations read **zero** env vars — their config is
per-project, stored in the DB (confirm this still holds before writing the
docs in Step 3; don't assert it from this excerpt alone if you find
otherwise). `GRAFANA_ADMIN_PASSWORD`/`GRAFANA_API_KEY`/`GRAFANA_URL`/`PORT`
are defined in `.env` but not read anywhere in `src/scripts/prisma` (likely
consumed by `docker-compose`/process-manager config, not app code) — note
this distinction in the `.env.example` comments rather than omitting them.

## Commands you will need

| Purpose            | Command                                                        | Expected on success |
|---------------------|------------------------------------------------------------------|----------------------|
| Fresh tsc count     | `npx tsc --noEmit 2>&1 \| grep -c "error TS"`                     | baseline number, currently `101` |
| Scoped tests        | `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` | 2 failed / 24 passed suites |
| New unit script     | `yarn test:unit`                                                | exits 0 after Step 1's fix (currently exits 1) |
| Gate dry run        | `.husky/pre-push` manually invoked, or `bash scripts/check-scoped-gate.sh` (Step 2) | exits 0 on the unmodified repo |

## Scope

**In scope**:
- `package.json` — fix `test:unit`/`test:integration`/`test:components` CLI flag.
- `jest.config.cjs` — add `testPathIgnorePatterns`.
- `scripts/check-tsc-baseline.mjs` (create) — the "zero new errors" check.
- A tracked baseline artifact (e.g. `.tsc-baseline-count`, decide format in Step 2).
- `.husky/pre-push` — replace the failing absolute `tsc --noEmit` with the scoped check.
- `AGENTS.md` (create, repo root).
- `.env.example` (create, repo root).

**Out of scope**:
- Fixing any of the 101 existing `tsc` errors or 9 existing failing tests —
  explicitly rejected by the owner (`baseline-red-leave-untouched` memory).
  If you find yourself editing a file solely to fix a pre-existing error,
  STOP — that's not this plan.
- `baseline-tsc.log` (the existing stale, untracked, unconsumed snapshot in
  the repo root) — plan 012 decided not to touch it; this plan **replaces
  its role** with a proper tracked artifact (Step 2) but should not assume
  plan 012 has run. If `baseline-tsc.log` still exists when you start,
  leave it in place (still gitignored-or-not per plan 012's state) and
  don't wire anything to read it — the new artifact is independent.
- `.husky/pre-commit` (`lint-staged`) — untouched.
- Any change to `production:check` (`package.json:39`) — that script is an
  intentionally absolute gate for manual pre-deploy use; leave it as-is.

## Git workflow

- Branch: `advisor/015-scoped-gate-and-onboarding-docs`
- Conventional-commit style, e.g. `chore(dx): scope the pre-push gate to new errors only, add AGENTS.md + .env.example`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Fix the broken `test:unit`/`test:integration`/`test:components` scripts

In `package.json`, change:
```diff
-    "test:unit": "jest --testPathPattern=services",
-    "test:integration": "jest --testPathPattern=api",
-    "test:components": "jest --testPathPattern=components",
+    "test:unit": "jest --testPathPatterns=services --testPathIgnorePatterns=\"node_modules|\\.claude\"",
+    "test:integration": "jest --testPathPatterns=api --testPathIgnorePatterns=\"node_modules|\\.claude\"",
+    "test:components": "jest --testPathPatterns=components --testPathIgnorePatterns=\"node_modules|\\.claude\"",
```
(Adjust quoting for how this repo's `package.json` scripts already escape
similar arguments elsewhere — check `lint:fix`/`lint:strict` for the
existing convention before assuming shell-quoting rules.)

**Verify**: `yarn test:unit` exits 0 (or with the current 2 failed / 24
passed suite baseline, not a CLI usage error) and does not enumerate any
`.claude/worktrees/...` paths in its output.

### Step 2: Add `testPathIgnorePatterns` to `jest.config.cjs`

Add to the config object (`jest.config.cjs:2-25`):
```js
testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
```
This makes the ignore permanent at the config level (Step 1's `--testPathIgnorePatterns`
CLI flag becomes redundant once this lands, but leave both — CLI flags make
the scoping visible to anyone reading `package.json`, and defense-in-depth
here is cheap and has no downside).

**Verify**: `npx jest __tests__/services` (no CLI ignore flag) now reports
2 failed / 24 passed suites, matching the already-flag-scoped number — i.e.
confirm the config-level ignore alone is now sufficient.

### Step 3: Build the "zero new tsc errors" check

Create `scripts/check-tsc-baseline.mjs`. Behavior:
1. Run `tsc --noEmit`, capture stdout, count lines matching `error TS`.
2. Read a tracked baseline count from a new file, `.tsc-baseline-count`
   (a single integer, e.g. `101`, committed to the repo — not
   `baseline-tsc.log`, which stays untouched per this plan's scope notes).
3. If the fresh count is `<=` the tracked baseline, exit 0.
4. If the fresh count is `>` the tracked baseline, print the delta and the
   new errors' file:line locations (diff the two `tsc` outputs if you want
   more than a count — a simple count comparison is the minimum bar, a
   file:line diff is better and worth doing if time allows), exit 1.
5. Print a one-line hint either way: how to update `.tsc-baseline-count` if
   the increase is an intentional, reviewed baseline bump (should be rare
   and always a deliberate choice, not something the script does
   automatically).

Create `.tsc-baseline-count` with today's real count: `101`.

**Verify**: `node scripts/check-tsc-baseline.mjs` exits 0 on the unmodified
repo. Manually introduce one throwaway type error in a scratch file
(outside `src/`, e.g. in the scratchpad, or a temporary `git stash`-able
edit — do not commit this test edit), re-run, confirm exit 1, then revert
the throwaway edit.

### Step 4: Replace `.husky/pre-push`

```sh
cd "$(git rev-parse --show-toplevel)"
yarn lint && yarn build && node scripts/check-tsc-baseline.mjs && npx jest __tests__/services --testPathIgnorePatterns="node_modules|\\.claude"
```
This keeps `lint`+`build` (already green today, per the memory) as
absolute gates, swaps the absolute `tsc --noEmit` for the new scoped
checker, and adds the services test subset as a real, previously-absent
regression check (previously nothing in the hook ran tests at all).

**Verify**: run `.husky/pre-push` manually (or `bash .husky/pre-push`) on
the unmodified repo — exits 0. This is the first time this hook will have
exited 0 in the current baseline state; confirm that's really true and not
a mistake in the script logic before calling this step done.

### Step 5: Write `AGENTS.md`

Create `AGENTS.md` at the repo root. Cover, concisely (this is a reference
doc, not a tutorial — link to the relevant files rather than duplicating
their content):
- The pre-existing red baseline: what it is, why it's intentional (link
  the `baseline-red-leave-untouched` reasoning — the МойСклад integration,
  ~101 tsc errors as of this plan), and the new rule: **zero new errors**,
  enforced by `scripts/check-tsc-baseline.mjs` at push time — don't try to
  fix the existing ones.
- `prisma migrate dev` is broken on this repo (shadow-DB replay failure);
  schema changes go through `prisma/manual/*.sql` + `npx prisma db execute
  --file <file> --schema prisma/schema.prisma` + `npx prisma generate`
  (point to `prisma/manual/20260623_partner_payouts.sql` as the reference
  example, plus any manual SQL files added by plans 011/013 if they've
  landed by the time you write this).
- How to run the real test suite scoped correctly (`yarn test:unit` etc.,
  post-Step-1-fix) and why the raw `npx jest __tests__/services` count
  looked wrong before Step 2 (stale `.claude/worktrees` — mention this so
  a future agent doesn't get confused by leftover worktrees again).
- Where env vars are documented (`.env.example`, Step 6) and a one-line
  pointer to which integrations (Insales, Tilda) are DB-configured instead
  of env-configured.
- The `plans/` directory convention (this file you're reading is itself an
  example) — link `plans/README.md`.

**Verify**: no machine check — this is a doc; have a human/reviewer sanity-check it reads clearly, or at minimum confirm every file path it references actually exists.

### Step 6: Write `.env.example`

Create `.env.example` at the repo root, listing every variable from the
"Current state" section's deduplicated list, each with a placeholder value
(never a real secret) and a one-line comment saying what it's for and
whether it's required or optional. Group with comments matching the
categories above (Database/Cache, Auth/Security, Telegram, MAX, YooKassa,
Moysklad, App/URLs, Logging/Ops, Email, Misc, Company). Note next to
`GRAFANA_*`/`PORT` that they're consumed by infra tooling, not app code, if
your own re-check (don't just trust this plan's snapshot) confirms that's
still true.

**Verify**: `diff <(grep -oE '^[A-Z_]+' .env.example) <(grep -rhoE
"process\.env\.[A-Z_]+" src scripts prisma | sed 's/process\.env\.//' |
sort -u)` — every var read in code should appear in `.env.example` (the
reverse isn't required — `.env.example` may include infra-only vars like
`PORT` that no app code reads directly).

## Test plan

- `scripts/check-tsc-baseline.mjs` exercised manually per Step 3 (inject a
  throwaway error, confirm exit 1, revert).
- `.husky/pre-push` run manually per Step 4 on the clean repo, confirm exit 0.
- `yarn test:unit`/`test:integration`/`test:components` all exit cleanly (0
  or the known baseline failure count, never a CLI usage error) after Step 1.
- No new `__tests__/` file is needed — this plan changes tooling/config/docs, not application logic.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn test:unit` (and `test:integration`, `test:components`) run without a CLI usage error
- [ ] `jest.config.cjs` has `testPathIgnorePatterns` covering `.claude/`; `npx jest __tests__/services` (no CLI flag) reports the same 2 failed / 24 passed suite count as the flag-scoped version
- [ ] `.tsc-baseline-count` exists and contains today's real count (`101` unless it changed since this plan was written — re-measure, don't assume)
- [ ] `scripts/check-tsc-baseline.mjs` exits 0 on the unmodified repo and exits 1 when a throwaway new error is introduced (verified, then reverted)
- [ ] `.husky/pre-push` runs `lint && build && check-tsc-baseline.mjs && <scoped jest>` and exits 0 on the unmodified repo
- [ ] `AGENTS.md` exists at repo root and references real, existing file paths
- [ ] `.env.example` exists at repo root and covers every `process.env.*` variable found in `src/scripts/prisma` (verified via the diff command in Step 6)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 015 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `32c72ac`) — especially the tsc error count and test baseline, since both are load-bearing numbers for this plan.
- Fixing `test:unit`'s CLI flag (Step 1) surfaces that the underlying test files were relying on the old (broader, unscoped) matching behavior in some way that changes which tests actually run — if `test:unit`'s scope shifts meaningfully, report the before/after rather than silently accepting whatever the new flag happens to match.
- `scripts/check-tsc-baseline.mjs`'s exit-1 test (Step 3) doesn't reproduce cleanly, or the throwaway error can't be fully reverted before finishing — do not leave a broken file in the working tree.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `.tsc-baseline-count` should only ever be *lowered* by someone actually
  fixing baseline errors (celebrate that when it happens) or *raised* as a
  deliberate, reviewed decision — never bump it just to make a failing gate
  pass. Say so explicitly in `AGENTS.md`.
- If plans 011/013/014 land before this plan runs, their manual SQL files
  are good additional examples to reference in `AGENTS.md`'s
  migration-workflow section — check `prisma/manual/` for what exists at
  execution time rather than hard-coding only `20260623_partner_payouts.sql`.
- Re-run the `.env.example` completeness diff (Step 6) periodically — it
  will drift as new integrations are added; consider whether
  `check-tsc-baseline.mjs`'s pattern (a small script + a done-criterion)
  is worth extending to env-var completeness too, as a future plan.
