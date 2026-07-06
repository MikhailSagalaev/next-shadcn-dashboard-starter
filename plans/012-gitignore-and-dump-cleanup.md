# Plan 012: Remove the stray production DB dump and close the .gitignore gaps that let it happen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git status --short` and `ls -la
> bonus_system.dump _commitmsg.txt baseline-tsc.log skills-lock.json 2>&1`.
> If any of these files are now absent, or newly tracked (`git ls-files |
> grep -E 'bonus_system.dump|_commitmsg.txt|skills-lock.json'` returns a
> hit), someone already touched this — stop and re-assess against the live
> state before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32c72ac`, 2026-07-06

## Why this matters

`bonus_system.dump` — a **31.3 MB `pg_dump` custom-format dump of the
production database** (verified: file header decodes as `PGDMP`, embedded
text shows `database name: bonus_system`, `server version 17.6`) — sits
untracked in the repo root and is **not covered by `.gitignore`**. Verified
via `git check-ignore -v bonus_system.dump` → no match, exit 1. The same is
true for `baseline-tsc.log`, `_commitmsg.txt`, and `skills-lock.json`.

**Good news, checked before writing this plan**: `git log --all --oneline --
bonus_system.dump` and `git log --diff-filter=A --name-only --all | grep -i
dump` both return nothing — this file has **never been committed**. This is
a prevention task, not incident response; no history rewrite (`git filter-repo`/BFG),
credential rotation, or "assume it's already public" response is needed.

The risk is mechanical: this repo's `.gitignore` has no generic rule for
dump/log/scratch files, so the very next `git add .` (or `git add -A`) run
in this directory — by a human or an agent — stages and can commit a live
production database snapshot straight into whatever remote the branch gets
pushed to. The fix is two-part: stop it from being *stageable*, and stop the
file from existing in the working tree at all (it doesn't belong in a repo
checkout regardless of git status).

## Current state

**`.gitignore`** (55/56 lines depending on trailing-newline counting — read
in full at `C:\projects\next-shadcn-dashboard-starter\.gitignore`). Relevant
existing rules: `/node_modules`, `/coverage`, `/.next/`, `/build`,
`npm-debug.log*` / `yarn-debug.log*` / `yarn-error.log*` (debug logs only,
not a generic `*.log`), `.env*`, `*.tsbuildinfo`, `/generated/prisma`, and a
customer-data block at the end:
```
# Customer data files (contains personal information)
customers*.csv
*customers*.csv
airtable*.csv
*airtable*.csv
```
No rule exists for `*.dump`, `*.sql` scratch files, `_commitmsg.txt`, or
`skills-lock.json`.

**Note on `.agents/`, `.claude/`, `.kiro/skills/`**: `git check-ignore -v`
reports these three as already matched (currently ignored) — functionally
confirmed (exit 0 for each). Leave these alone; this plan does not touch
directory-ignore rules that already work.

**The four untracked files needing attention** (`git status --short` at
repo root):
```
?? _commitmsg.txt        # 1 line so far: a scratch commit-message file, artifact of a prior
                          # heredoc-based `git commit -F` workflow for a manual-SQL migration
                          # commit (plans 005/007). Not meant to be tracked or reused.
?? baseline-tsc.log       # stale tsc output snapshot (91 errors; today's live count is 101 —
                          # drifted, not regenerated, not consumed by any script — see plan 015).
?? bonus_system.dump      # the production DB dump described above.
?? skills-lock.json       # Claude-skills tooling lockfile (mirrors .agents/.claude/.kiro/skills
                          # content — same category, was just missed by the existing block).
```

## Commands you will need

| Purpose         | Command                                          | Expected on success |
|------------------|---------------------------------------------------|---------------------|
| Confirm ignored  | `git check-ignore -v bonus_system.dump baseline-tsc.log _commitmsg.txt skills-lock.json` | all four print a match |
| Confirm untracked | `git status --short`                              | none of the four appear |
| Never-committed check | `git log --all --oneline -- bonus_system.dump`  | empty output (re-verify before deleting) |

## Scope

**In scope**:
- `.gitignore` (append rules)
- Deleting `bonus_system.dump` from the working tree (not from git history — it was never committed)
- Deciding fate of `_commitmsg.txt` (delete — see Step 2) and `skills-lock.json` (keep, just ignore — see Step 1)

**Out of scope**:
- `baseline-tsc.log` — leave as-is; plan 015 owns replacing this with a
  proper tracked/consumed baseline artifact. Adding it to `.gitignore` here
  would conflict with that plan if it decides to track a similarly-named
  file. Do NOT touch it in this plan.
- Any git history rewrite (`filter-repo`, `BFG`, force-push) — not needed,
  the file was never committed. If your own investigation finds otherwise
  (re-run the never-committed check above), STOP — that changes this from a
  prevention task to an incident and needs the operator's decision on
  history rewrite + credential rotation, which is out of this plan's scope.
- `.agents/`, `.claude/`, `.kiro/skills/` ignore rules — already working, do not modify.

## Git workflow

- Branch: `advisor/012-gitignore-and-dump-cleanup`
- Conventional-commit style, e.g. `chore(repo): stop tracking prod DB dumps and scratch artifacts`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add the missing `.gitignore` rules

Append a new block to the end of `.gitignore` (after the existing "Customer
data files" block):
```gitignore
# Database dumps (never belong in the repo — can contain real customer data)
*.dump
*.sql.gz

# Scratch/local tooling artifacts
_commitmsg.txt
skills-lock.json
```
Do not add a bare `*.log` rule — `npm-debug.log*`/`yarn-debug.log*` already
cover the debug-log case this repo intentionally distinguishes, and a
blanket `*.log` could silently swallow a future log file someone actually
wants tracked (e.g. a changelog). Keep the new rules narrow and named for
what they are.

**Verify**: `git check-ignore -v bonus_system.dump _commitmsg.txt skills-lock.json` → three matches, all pointing at the new block.

### Step 2: Remove the dump and the scratch commit-message file from the working tree

Confirm one more time these were never committed (belt and suspenders — do
this immediately before deleting, not from memory of this plan's research):
```
git log --all --oneline -- bonus_system.dump
git log --all --oneline -- _commitmsg.txt
```
Both must be empty. If either prints anything, STOP — do not delete a file
that has git history without the operator's sign-off.

If both are empty, delete the files from the working tree:
```
rm bonus_system.dump _commitmsg.txt
```
Leave `skills-lock.json` — it's legitimate local tooling state (a
skill-source lockfile, same category as the already-ignored `.agents/`
`.claude/` `.kiro/skills/`), just newly gitignored, not something to delete.

**Verify**: `ls bonus_system.dump _commitmsg.txt` → both report "No such file or directory".

### Step 3: Confirm a clean `git status`

Run `git status --short` at repo root. Expect **zero** untracked entries
related to this plan (the four files are now either deleted or ignored).
Anything else showing up is unrelated in-progress work — do not touch it.

## Test plan

No code paths change; this is a repo-hygiene fix. Verification is entirely
via the `git status`/`git check-ignore` commands above — there is no
application behavior to test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.gitignore` has the new block (dumps + scratch artifacts)
- [ ] `git check-ignore -v bonus_system.dump _commitmsg.txt skills-lock.json` → all three match
- [ ] `bonus_system.dump` and `_commitmsg.txt` no longer exist in the working tree
- [ ] `git log --all --oneline -- bonus_system.dump` and `-- _commitmsg.txt` are both empty (re-confirmed, not assumed)
- [ ] `git status --short` shows no untracked dump/scratch files
- [ ] `baseline-tsc.log` untouched (byte-identical — `git diff` shows nothing, since it was never staged either way)
- [ ] `plans/README.md` status row for 012 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `git log --all --oneline -- bonus_system.dump` (or `_commitmsg.txt`)
  returns **any** output — this means the file has history and deleting it
  needs a different, more careful plan (possible history scrub + credential
  rotation), not a plain `rm`.
- `bonus_system.dump` or `_commitmsg.txt` is absent already, or `git
  ls-files` shows either as tracked — state has changed since this plan was
  written; re-assess rather than blindly running the steps.
- Any of the four files' current content looks like it's still in active
  use by another in-progress task (e.g. `_commitmsg.txt` has fresh content
  someone is about to `git commit -F` with) — check `git log -1
  --format=%cd` / file mtime before deleting; if very recent, ask before
  removing.

## Maintenance notes

- If production DB dumps are needed locally again (e.g. for restoring a dev
  DB), keep them outside the repo directory entirely (e.g. `~/dumps/`) —
  the new `.gitignore` rule is a safety net, not a place to routinely put
  them.
- `baseline-tsc.log`'s fate is decided by plan 015 (scoped pre-push gate) —
  don't preempt that here.
