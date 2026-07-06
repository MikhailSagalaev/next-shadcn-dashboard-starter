# Plan 014: Rate-limit the public balance-lookup endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 32c72ac..HEAD -- src/app/api/projects/[id]/users/balance/route.ts src/app/api/insales/balance/[projectId]/route.ts src/lib/services/rate-limiter.service.ts src/middleware.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32c72ac`, 2026-07-06

## Why this matters

Two endpoints let anyone look up a user's bonus balance by guessing an
email or phone number, with no rate limiting anywhere in front of them:

- `GET /api/projects/[id]/users/balance` — `src/app/api/projects/[id]/users/balance/route.ts:15-307`.
  Explicitly allowlisted as public in `middleware.ts:15` (bypasses the
  `/api/projects` auth requirement entirely). Its only guard is an
  origin/referer-vs-`project.domain` check (`:21-49`) that **fails open**
  when `project.domain` is unset: `if (!allowedHost) return true; // fallback: no domain configured → allow`
  (`:36`). Looked up via `UserService.findUserByContact(projectId, email, phone)`
  (`:111-115`) with `email`/`phone` taken straight from query params (`:67-68`).
- `GET /api/insales/balance/[projectId]` — `src/app/api/insales/balance/[projectId]/route.ts:13-116`.
  Not in `middleware.ts`'s allowlist, but also not under `/api/admin` or
  `/api/projects`, so it's implicitly public the same way the webhooks are
  (`PROTECTED_MATCHERS` doesn't match it). Guard is only
  `integration.isActive` (`:37-47`) — no origin check at all, and CORS is
  wide open: `'Access-Control-Allow-Origin': '*'` (`:88`). Params also raw
  query-string `email`/`phone` (`:51-52`), delegated to
  `InSalesService.getBonusBalance` (`:68`).

Both are a straightforward enumeration surface: an attacker with a list of
emails/phones (a common leaked-list scenario) can probe either endpoint to
learn who has an account and what their balance is, with no throttle to
slow a scripted sweep. The `/api/projects/[id]/users/balance` route's
domain-check fallback makes it worse for any project that hasn't set
`domain` — it's allow-all today, not just missing a rate limit.

This codebase already has rate-limiting infrastructure that just isn't
wired to either route:
`src/lib/services/rate-limiter.service.ts` — `RateLimiterService`, Redis
sliding-window with in-memory fallback, currently only called from internal
workflow paths (`simple-workflow-processor.ts:110,143`,
`workflow/handlers/action-handlers.ts:578,1326`) — never from a public HTTP
route. A second, separate limiter (`src/lib/with-rate-limit.ts` /
`with-rate-limit-redis.ts`) is used on exactly two routes
(`users/spend/route.ts`, `notifications/route.ts`). Neither system reaches
the two balance endpoints.

## Current state

`src/lib/services/rate-limiter.service.ts:17-38` — the limit config and type:
```ts
export const DEFAULT_RATE_LIMITS = {
  WORKFLOW_EXECUTION: { windowMs: 60 * 1000, maxRequests: 100 },
  API_REQUEST:         { windowMs: 60 * 1000, maxRequests: 60 },
  TELEGRAM_MESSAGE:    { windowMs: 60 * 1000, maxRequests: 30 },
  DATABASE_QUERY:      { windowMs: 60 * 1000, maxRequests: 200 },
  TELEGRAM_CHANNEL_CHECK: { windowMs: 1000, maxRequests: 30 }
} as const;
export type RateLimitType = keyof typeof DEFAULT_RATE_LIMITS;
```
`checkLimit` signature (`:88-92`):
```ts
static async checkLimit(
  type: RateLimitType,
  identifier: string,
  customLimit?: { windowMs: number; maxRequests: number }
): Promise<RateLimitResult>
```
`RateLimitResult` (`:45-50`): `{ allowed: boolean; remaining: number; reset: number; retryAfter?: number }`.
Redis-backed sliding window via sorted sets, with an in-memory fallback
(`checkLimitInMemory`) if Redis is unreachable, and fail-open on Redis
errors (existing, intentional design — this plan does not change that).

`src/app/api/projects/[id]/users/balance/route.ts:15-68` (GET handler
entry, origin check, param extraction) — see full excerpt already quoted in
the audit; key insertion point is right after the `isAllowed`/CORS block
(`:49-65`) and before `UserService.findUserByContact` (`:111`).

`src/app/api/insales/balance/[projectId]/route.ts:13-64` — entry, param
extraction; key insertion point is after the `integration.isActive` check
(`:37-47`) and before `insalesService.getBonusBalance` (`:68`).

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|-----------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit 2>&1 \| grep -c "error TS"`        | `101` (unchanged) |
| Tests     | `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` | 2 failed / 24 passed suites baseline unchanged |
| New tests | `npx jest __tests__/services/balance-rate-limit.test.ts` (create) | all pass |
| Lint      | `yarn lint`                                        | exit 0              |

## Scope

**In scope**:
- `src/lib/services/rate-limiter.service.ts` — add a `BALANCE_LOOKUP` entry to `DEFAULT_RATE_LIMITS`.
- `src/app/api/projects/[id]/users/balance/route.ts` — call `RateLimiterService.checkLimit`.
- `src/app/api/insales/balance/[projectId]/route.ts` — same.
- `__tests__/services/balance-rate-limit.test.ts` (create).

**Out of scope**:
- The `/api/projects/[id]/users/balance` allow-all domain-check fallback
  (`:36`) and the InSales route's wide-open CORS (`:88`) — real gaps, but a
  different fix (origin/CORS policy) from rate limiting; do not fix them
  here, note them in your PR description as a related-but-separate finding
  if you want, but don't expand scope.
- The webhook routes (`/api/telegram/webhook`, `/api/webhook/max-bot`) —
  covered by plan 011's secret-token approach, not rate limiting.
- The second rate-limiter system (`with-rate-limit.ts`/`with-rate-limit-redis.ts`)
  — use `RateLimiterService` for consistency with this plan's design, don't
  introduce a third pattern or migrate the other two routes that already
  use the wrapper-based one.
- Any change to `UserService.findUserByContact` or `InSalesService.getBonusBalance`.

## Git workflow

- Branch: `advisor/014-balance-endpoint-rate-limiting`
- Conventional-commit style, e.g. `fix(api): rate-limit public balance lookup endpoints`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add a `BALANCE_LOOKUP` rate limit type

In `src/lib/services/rate-limiter.service.ts`, add to `DEFAULT_RATE_LIMITS`
(`:17-38`):
```ts
BALANCE_LOOKUP: {
  windowMs: 5 * 60 * 1000, // 5 минут
  maxRequests: 20 // per IP+project — enough for a real widget user retrying, too slow for a sweep
}
```
Pick the exact numbers with the existing entries as a reference point (e.g.
`API_REQUEST` allows 60/min per project) — 20 requests per 5 minutes per
`{ip, projectId}` is a starting point, not a hard requirement; if you have
a better-grounded number from how the widget actually behaves (e.g. does it
retry on failure?), use that instead and note your reasoning.

**Verify**: `npx tsc --noEmit` — error count unchanged.

### Step 2: Wire it into `/api/projects/[id]/users/balance`

In `src/app/api/projects/[id]/users/balance/route.ts`, after the CORS/`isAllowed`
block (`:49-65`) and before the `email`/`phone` extraction is used for the
lookup, get a client identifier (reuse this repo's existing IP-extraction
convention — check `src/app/api/telegram/webhook/[projectId]/route.ts:58-62`
for the `cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` fallback chain
already used elsewhere in this codebase, and mirror it rather than
inventing a new one) and call:
```ts
const rateLimitResult = await RateLimiterService.checkLimit(
  'BALANCE_LOOKUP',
  `${projectId}:${clientIp}`
);
if (!rateLimitResult.allowed) {
  const respBody = { error: 'Too many requests' };
  await logToDatabase(429, false, respBody);
  return NextResponse.json(respBody, {
    status: 429,
    headers: { ...corsHeaders, 'Retry-After': String(rateLimitResult.retryAfter ?? 60) }
  });
}
```
Place this check before the existing `logToDatabase`-wrapped `!email &&
!phone` validation (`:104-108`) so a rate-limited request doesn't also
trigger a DB lookup path.

**Verify**: `npx tsc --noEmit` — error count unchanged.

### Step 3: Wire it into `/api/insales/balance/[projectId]`

In `src/app/api/insales/balance/[projectId]/route.ts`, after the
`integration.isActive` check (`:37-47`) and before the `email`/`phone`
validation (`:54-64`), add the same `RateLimiterService.checkLimit('BALANCE_LOOKUP', \`${projectId}:${clientIp}\`)`
call, returning a 429 with the same CORS headers this route already sends
(`:88-91`) plus `Retry-After`.

**Verify**: `npx tsc --noEmit` — error count unchanged.

### Step 4: Tests

Create `__tests__/services/balance-rate-limit.test.ts`. Mock
`RateLimiterService.checkLimit` (or exercise the real in-memory fallback
path if Redis isn't available in the test environment — check how existing
`rate-limiter.service.test.ts`, if one exists, sets this up; if none
exists, mock at the `RateLimiterService` level rather than standing up
Redis). Cover:
1. Both routes call `RateLimiterService.checkLimit('BALANCE_LOOKUP', ...)`
   with an identifier that includes both `projectId` and the client IP
   (not just one or the other — a single global counter would let one
   attacker's traffic block real users of a different project, or one
   project ID key would let rotating IPs bypass the limit entirely).
2. When `checkLimit` returns `allowed: false`, both routes return `429`
   without calling `UserService.findUserByContact` /
   `InSalesService.getBonusBalance` (assert the mock was not called).
3. When `checkLimit` returns `allowed: true`, existing behavior is
   unchanged (happy path still works).

**Verify**: `npx jest __tests__/services/balance-rate-limit.test.ts --testPathIgnorePatterns="node_modules\|\\.claude"` → all pass.

## Test plan

- New file `__tests__/services/balance-rate-limit.test.ts` with the three cases above.
- Full regression: `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` → baseline unchanged plus new suite passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` error count is 101 (unchanged)
- [ ] `npx jest __tests__/services/balance-rate-limit.test.ts --testPathIgnorePatterns="node_modules\|\\.claude"` passes with ≥3 new tests
- [ ] `npx jest __tests__/services --testPathIgnorePatterns="node_modules\|\\.claude"` shows no new failures beyond the existing 9/237
- [ ] `yarn lint` exits 0
- [ ] Both balance routes return `429` with a `Retry-After` header once the per-`{projectId, ip}` limit is exceeded, and do not reach the user-lookup call when limited (asserted in test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 014 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `32c72ac`).
- Redis is unreachable in your execution environment in a way that makes
  the in-memory fallback the only path you can verify — that's fine for
  dev/test, but note it explicitly in your report so the operator knows
  production behavior (Redis-backed) wasn't directly exercised.
- You find evidence the widget/InSales integration retries aggressively on
  a 4xx (which would make a 5-req/5-min-style limit break legitimate usage)
  — if so, widen the limit and note your reasoning rather than guessing.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The origin-check fallback (`allow all when project.domain is unset`,
  `users/balance/route.ts:36`) and the InSales route's `Access-Control-Allow-Origin: '*'`
  are real, separate gaps — worth a follow-up finding, not folded into this
  plan.
- If a third balance-lookup-shaped endpoint is added later, give it the
  same `BALANCE_LOOKUP` rate-limit type and the `{projectId, ip}` identifier
  convention established here.
