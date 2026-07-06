# Plan 016: Mark dead trigger.callback nodes and show human-readable conditions in the workflow constructor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 804ab84..HEAD -- src/lib/telegram/bot.ts src/lib/services/workflow/callback-trigger-match.ts src/features/workflow/components/nodes/trigger-node.tsx src/features/workflow/components/nodes/condition-node.tsx src/features/workflow/components/workflow-properties.tsx src/types/workflow.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (purely additive display logic in the visual editor, plus one
  drop-in refactor of an existing boolean expression in `bot.ts` — no change
  to bot dispatch behavior, no schema/migration, no change to what the
  workflow engine executes)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `804ab84`, 2026-07-06

## Why this matters

The visual workflow constructor at `/dashboard/projects/[id]/workflow` lets a
project owner (often a non-technical fitness-club admin, not a developer)
build and edit bot scenarios by dragging nodes on a canvas. Two things on
that canvas currently lie to the person looking at it:

1. **Some nodes never run, and nothing on the canvas says so.** The Telegram
   bot dispatcher (`src/lib/telegram/bot.ts`) intercepts certain
   `callback_data` values and routes them straight to
   `PartnerCabinetService` *before* the workflow engine is ever invoked (see
   `hasActiveWorkflow` / `executeWorkflow` call further down in the same
   file). Any `trigger.callback` node whose pattern falls into that
   intercepted set is permanently dead — editing it, reconnecting it,
   changing its downstream actions, none of it changes bot behavior. The
   official "B2B Партнёр" template (`src/lib/workflow-templates/b2b-partner-cabinet.json`)
   ships with exactly one such node today (`trigger-cb-team` /
   `action-team`, see verification below) and an admin has no way to know it
   is inert by looking at the editor.
2. **Condition nodes render as raw code.** `ConditionNode` prints
   `${condition.variable} ${condition.operator} ${condition.value}` verbatim
   — e.g. `user.partnerRole equals DIRECTOR` — instead of the human-readable
   labels ("Равно (===)", "Не пустое", etc.) that already exist one file
   over in the same feature's property editor. Worse, if a node was
   authored using the *other* supported condition format (the `expression`
   field — a raw JS string like `get("balance") > 100`) instead of the
   `variable`/`operator`/`value` triplet, the current code still tries to
   interpolate the empty triplet and prints the literal string
   `"undefined undefined undefined"` on the node card.

Both are display bugs in the same feature area, touching adjacent lines of
the same two small files, so this plan fixes them together. Neither requires
changing what a workflow actually does — only what the editor shows about
what it does.

## Current state

### 1. The bot dispatcher's intercept list (source of truth for "dead")

`src/lib/telegram/bot.ts:169-190` (inside the `bot.use(...)` middleware that
runs before `WorkflowRuntimeService.executeWorkflow`):

```ts
// Партнёрский кабинет: approve/reject, фильтры команды, заявки — до workflow
if (trigger === 'callback' && ctx.callbackQuery?.data) {
  const data = ctx.callbackQuery.data;
  const isPartnerCabinet =
    data.startsWith('partner_join_') ||
    data.startsWith('partner_team_remove:') ||
    data.startsWith('partner_team_tab:') ||
    data.startsWith('partner_team_page:') ||
    data === 'partner_requests' ||
    data === 'payout_request' ||
    data.startsWith('payout_cancel:') ||
    data.startsWith('payout_method:') ||
    data === 'payout_method_cancel';

  if (isPartnerCabinet) {
    const handled = await PartnerCabinetService.tryHandleTelegramCallback(
      projectId,
      ctx
    );
    if (handled) return;
  }
}
```

If `isPartnerCabinet` is `true`, the update never reaches
`WorkflowRuntimeService.executeWorkflow` at all (there's a `return` a few
lines below on `if (handled) return;`, and `PartnerCabinetService`'s handler
returns `true` whenever it recognizes the callback).

`src/lib/max-bot/bot.ts:51-63` has an analogous, but **smaller**,
intercept list for the MAX platform — only the four `payout_*` entries, not
`partner_join_*` / `partner_team_*` / `partner_requests`. It is a strict
subset of the Telegram list above. **Do not touch this file** — see Scope.

### 2. How a `trigger.callback` node's pattern actually matches an incoming callback

`src/lib/services/workflow/callback-trigger-match.ts` (full file, already
exported and already used by the runtime — reuse it, don't duplicate it):

```ts
/** Читает паттерн из конфига ноды (поддерживает legacy поле `data`). */
export function getTriggerCallbackPattern(
  node: WorkflowNode
): string | undefined {
  const cfg = node.data?.config?.['trigger.callback'] as
    | { callbackData?: string; data?: string }
    | undefined;
  const pattern = cfg?.callbackData ?? cfg?.data;
  return typeof pattern === 'string' && pattern.length > 0
    ? pattern
    : undefined;
}

/**
 * Совпадение callback_data с паттерном триггера.
 * Точное совпадение или префикс `pattern:param` (пагинация, id подопечного).
 */
export function matchesCallbackPattern(
  pattern: string,
  incoming: string
): boolean {
  if (pattern === incoming) return true;
  return incoming.startsWith(`${pattern}:`);
}
```

This is the key fact that makes the "dead node" check non-trivial: a node
stores a **bare pattern** (e.g. `"partner_team_page"`), but a real button
press can send `"partner_team_page:0"` (see the template excerpt below) —
the trailing `:N` is added by whoever renders the inline keyboard, not by
the trigger node. So checking `isPartnerCabinet` logic against the bare
pattern alone is not sufficient — you must also check the `pattern:0`
representative form, because that's what a real tap actually sends and
what `bot.ts` actually sees.

Concretely, for `pattern = "partner_team_page"`:
- `"partner_team_page".startsWith("partner_team_page:")` → `false` (the
  prefix string is *longer* than the pattern — this can never match).
- `"partner_team_page:0".startsWith("partner_team_page:")` → `true` — this
  is the form that actually gets intercepted.

### 3. The one currently-dead node in the shipped template (verification target)

`src/lib/workflow-templates/b2b-partner-cabinet.json:399-424`:

```json
{
  "id": "trigger-cb-team",
  "type": "trigger.callback",
  "position": { "x": 0, "y": 920 },
  "data": {
    "label": "Команда (callback)",
    "config": {
      "trigger.callback": { "callbackData": "partner_team_page" }
    }
  }
},
{
  "id": "action-team",
  "type": "action.partner_team",
  ...
}
```

Buttons that are supposed to trigger it look like
`{ "text": "👥 Моя команда", "callback_data": "partner_team_page:0" }`
(lines 265, 296, 330 of the same file). This is the real end-to-end
repro: tapping "👥 Моя команда" sends `partner_team_page:0`, `bot.ts`'s
`data.startsWith('partner_team_page:')` matches it and hands it to
`PartnerCabinetService` — `trigger-cb-team` / `action-team` never fires.

Run this to confirm which `trigger.callback` nodes exist in the template
and get their raw patterns before you start (expected output shown):

```
node -e "
const data = require('./src/lib/workflow-templates/b2b-partner-cabinet.json');
for (const n of data.nodes || []) {
  if (n.type === 'trigger.callback') {
    console.log(n.id, '->', n.data?.config?.['trigger.callback']?.callbackData);
  }
}
"
```

Expected:
```
trigger-cb-org-summary -> partner_org_summary
trigger-cb-team -> partner_team_page
trigger-cb-link -> partner_link
trigger-cb-payouts -> partner_payouts
trigger-cb-subject -> partner_subject
menu-balance-trigger -> menu_balance
menu-history-trigger -> menu_history
menu-level-trigger -> menu_level
menu-referrals-trigger -> menu_referrals
menu-help-trigger -> menu_help
back-to-menu-trigger -> back_to_menu
```

Only `trigger-cb-team` (`partner_team_page`) should end up flagged as dead
by the function you write in Step 1 — the rest are real, working nodes (this
is your regression check for Step 1's unit tests: don't over-match).

### 4. `TriggerNode` — where the badge goes

`src/features/workflow/components/nodes/trigger-node.tsx` (full file, 97
lines). Relevant excerpt:

```tsx
export const TriggerNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const triggerType = nodeData.type;
  const config = nodeData.config || {};
  const triggerValue =
    config['trigger.command']?.command ||
    config['trigger.message']?.pattern ||
    config['trigger.callback']?.callbackData ||
    config['trigger.callback']?.data ||
    config['trigger.schedule']?.cron ||
    'Нажмите для редактирования';

  const getTriggerDisplayText = () => {
    switch (triggerType) {
      ...
      case 'trigger.callback':
        return `Callback: ${triggerValue}`;
      ...
    }
  };

  return (
    <Card className='w-64 border-green-500 shadow-md'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Play className='mr-2 inline-block h-4 w-4 text-green-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-muted-foreground text-xs'>Триггер</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-muted-foreground line-clamp-2 text-sm'>
          {getTriggerDisplayText()}
        </p>
      </CardContent>
      ...
```

Note line 23-24 already manually resolves `callbackData ?? data` — this
duplicates `getTriggerCallbackPattern` from `callback-trigger-match.ts`.
Replace that duplication while you're in there (Step 3 tells you exactly
what to change).

### 5. `ConditionNode` — the raw-text bug

`src/features/workflow/components/nodes/condition-node.tsx` (full file, 68
lines). The bug:

```tsx
export const ConditionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const condition = nodeData.config.condition;
  const conditionText = condition
    ? `${condition.variable} ${condition.operator} ${condition.value}`
    : 'Нажмите для редактирования';
  ...
```

`condition`'s type is `ConditionConfig` (`src/types/workflow.ts:358-383`):

```ts
export interface ConditionConfig {
  // Новое поле для выражений
  expression?: string;

  // Старые поля для обратной совместимости (делаем опциональными)
  variable?: string;
  operator?:
    | 'equals' | 'not_equals' | 'contains' | 'not_contains'
    | 'greater' | 'less' | 'is_empty' | 'is_not_empty'
    | '==' | '!=' | '===' | '!==' | '>' | '<' | '>=' | '<=';
  value?: any;
  caseSensitive?: boolean;
}
```

If a node only has `condition.expression` set (no `variable`/`operator`),
the current code renders the literal string `"undefined undefined
undefined"`. This plan fixes that alongside the raw-operator problem — same
function, same file, same root cause (the display code was written only for
the legacy triplet).

### 6. The human-readable operator labels already exist — one file over

`src/features/workflow/components/workflow-properties.tsx:207-216` (the
condition property editor's operator `<select>`):

```tsx
<option value=''>Выберите оператор</option>
<option value='equals'>Равно (===)</option>
<option value='not_equals'>Не равно (!==)</option>
<option value='contains'>Содержит</option>
<option value='not_contains'>Не содержит</option>
<option value='greater'>Больше (&gt;)</option>
<option value='less'>Меньше (&lt;)</option>
<option value='is_empty'>Пустое</option>
<option value='is_not_empty'>Не пустое</option>
```

This is the exact wording to reuse on the node card — do not invent new
copy. Pull it out into a shared map so the editor dropdown and the node
card can never drift apart again (that's exactly the kind of duplication
that caused finding #1 above to go unnoticed for as long as it did).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|----------------------|
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | No new errors in files this plan touches (baseline is pre-existing red — see `baseline-tsc.log` at repo root; compare against it, don't chase unrelated errors) |
| Lint      | `npx eslint <changed files, space-separated> --quiet` | No output |
| Tests     | `npx jest __tests__/services/workflow/ __tests__/services/telegram/ --silent` | All pass, including the new files from Step 1 and Step 4 |
| Full test baseline | `npx jest --silent 2>&1 \| tail -20` | Same pass/fail counts as before your change, plus your new tests (repo has ~9 pre-existing failing tests unrelated to this area — do not try to fix those) |

## Scope

**In scope:**
- `src/lib/telegram/partner-cabinet-intercepted-callbacks.ts` (new — shared
  matcher, importable from both server and client code)
- `src/lib/telegram/bot.ts` (replace the inline boolean with a call to the
  new shared function — must produce an identical result, see Step 2)
- `src/features/workflow/components/nodes/trigger-node.tsx` (dead-node
  badge; also de-duplicate the `callbackData ?? data` lookup via
  `getTriggerCallbackPattern`)
- `src/features/workflow/components/nodes/condition-node.tsx` (human-
  readable operator text; correct handling of `expression`-mode and
  unset conditions)
- `src/features/workflow/lib/condition-operator-labels.ts` (new — shared
  label map)
- `src/features/workflow/components/workflow-properties.tsx` (source the
  `<option>` list from the same shared label map instead of separate
  hardcoded JSX, so the two can't diverge again)
- New test files under `__tests__/services/telegram/` and
  `__tests__/services/workflow/` (see Test plan)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/max-bot/bot.ts` — its intercept list is a strict subset of the
  Telegram one (payout entries only). Using the Telegram list as the single
  source of truth for the editor's dead-node check already covers it (a
  superset check is safe/conservative); touching a second bot runtime file
  is unnecessary risk for what is otherwise a UI-only plan.
- `src/features/bot-constructor/**` — this is a **separate, older**
  constructor UI wired to `/dashboard/projects/[id]/constructor`, not the
  one used by the B2B partner-cabinet template. It happens to have a
  similarly-named `condition-node.tsx` — that is a different component in a
  different feature folder. The B2B template is installed into
  `/dashboard/projects/[id]/workflow` (confirmed by
  `src/features/projects/components/b2b-hierarchy-settings.tsx:418`:
  `` `/dashboard/projects/${projectId}/workflow?workflowId=${installedWorkflowId}` ``),
  which renders `src/features/workflow/components/*`, the directory this
  plan actually targets. Do not "fix" the bot-constructor copy — it's a
  different, unrelated code path.
- Any change to which callbacks the bot dispatcher actually intercepts —
  this plan only *reads* that list to render a warning; it must not change
  bot behavior. If Step 2's refactor changes behavior even slightly, that's
  a STOP condition, not something to "fix forward."
- The `expression` field's JS evaluation logic (wherever conditions are
  actually evaluated at runtime) — only the **display text on the node
  card** is in scope here.
- Redesigning the node's visual layout, colors, or the rest of the design-
  critique's recommendations (grouping nodes into collapsible sections,
  showing `{{user.firstName}}` instead of `{{...}}` in message previews,
  etc.) — those are separate, larger UI work; this plan is scoped to the
  two "🔴 Critical" findings only.

## Git workflow

- Branch: `advisor/016-workflow-constructor-dead-nodes-and-readable-conditions`
- Commit per step (4 commits: shared intercept matcher + bot.ts refactor;
  trigger-node badge; shared operator labels; condition-node + properties
  panel wiring), conventional-commit style matching `git log --oneline -10`
  in this repo (e.g. `fix(workflow): ...`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared intercept-matcher and its tests

Create `src/lib/telegram/partner-cabinet-intercepted-callbacks.ts`:

```ts
/**
 * @file: src/lib/telegram/partner-cabinet-intercepted-callbacks.ts
 * @description: Единственный источник правды для списка callback_data,
 *   которые src/lib/telegram/bot.ts перехватывает и уводит в
 *   PartnerCabinetService ДО workflow-движка. Используется и диспетчером
 *   бота, и визуальным конструктором (чтобы показать «мёртвые» ноды).
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */

/**
 * Точная копия условия из bot.ts — если меняете список там, меняйте и
 * здесь (или, ещё лучше, замените блок в bot.ts на вызов этой функции —
 * см. Step 2).
 */
export function isTelegramCallbackIntercepted(data: string): boolean {
  return (
    data.startsWith('partner_join_') ||
    data.startsWith('partner_team_remove:') ||
    data.startsWith('partner_team_tab:') ||
    data.startsWith('partner_team_page:') ||
    data === 'partner_requests' ||
    data === 'payout_request' ||
    data.startsWith('payout_cancel:') ||
    data.startsWith('payout_method:') ||
    data === 'payout_method_cancel'
  );
}

/**
 * Для ноды конструктора: pattern хранится "голым" (см.
 * callback-trigger-match.ts::matchesCallbackPattern — паттерн матчит и
 * себя самого, и `pattern:любой_параметр`). Проверяем обе представительные
 * формы, потому что реальные нажатия часто шлют именно `pattern:0`.
 */
export function isTriggerNodePatternIntercepted(pattern: string): boolean {
  return (
    isTelegramCallbackIntercepted(pattern) ||
    isTelegramCallbackIntercepted(`${pattern}:0`)
  );
}
```

Create `__tests__/services/telegram/partner-cabinet-intercepted-callbacks.test.ts`
(model the `describe`/`it` structure after `__tests__/services/node-utils.test.ts`):

```ts
import {
  isTelegramCallbackIntercepted,
  isTriggerNodePatternIntercepted
} from '@/lib/telegram/partner-cabinet-intercepted-callbacks';

describe('isTelegramCallbackIntercepted', () => {
  it('matches all documented prefix patterns with a real suffix', () => {
    expect(isTelegramCallbackIntercepted('partner_join_abc123')).toBe(true);
    expect(isTelegramCallbackIntercepted('partner_team_remove:u1')).toBe(true);
    expect(isTelegramCallbackIntercepted('partner_team_tab:clients')).toBe(true);
    expect(isTelegramCallbackIntercepted('partner_team_page:0')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_cancel:p1')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_method:card')).toBe(true);
  });

  it('matches all documented exact patterns', () => {
    expect(isTelegramCallbackIntercepted('partner_requests')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_request')).toBe(true);
    expect(isTelegramCallbackIntercepted('payout_method_cancel')).toBe(true);
  });

  it('does not match unrelated callback data', () => {
    expect(isTelegramCallbackIntercepted('partner_link')).toBe(false);
    expect(isTelegramCallbackIntercepted('partner_org_summary')).toBe(false);
    expect(isTelegramCallbackIntercepted('partner_payouts')).toBe(false);
    expect(isTelegramCallbackIntercepted('menu_referrals')).toBe(false);
    expect(isTelegramCallbackIntercepted('back_to_menu')).toBe(false);
  });

  it('does not match a bare prefix with no suffix (regression guard)', () => {
    // "partner_team_page" alone is shorter than "partner_team_page:" and
    // can never satisfy startsWith on it — this is the case that makes
    // isTriggerNodePatternIntercepted necessary.
    expect(isTelegramCallbackIntercepted('partner_team_page')).toBe(false);
  });
});

describe('isTriggerNodePatternIntercepted', () => {
  it('flags the one dead node in the shipped b2b template', () => {
    expect(isTriggerNodePatternIntercepted('partner_team_page')).toBe(true);
  });

  it('does not flag the live nodes in the shipped b2b template', () => {
    for (const pattern of [
      'partner_org_summary',
      'partner_link',
      'partner_payouts',
      'partner_subject',
      'menu_balance',
      'menu_history',
      'menu_level',
      'menu_referrals',
      'menu_help',
      'back_to_menu'
    ]) {
      expect(isTriggerNodePatternIntercepted(pattern)).toBe(false);
    }
  });

  it('flags exact-match entries too', () => {
    expect(isTriggerNodePatternIntercepted('partner_requests')).toBe(true);
    expect(isTriggerNodePatternIntercepted('payout_request')).toBe(true);
  });
});
```

**Verify**: `npx jest __tests__/services/telegram/partner-cabinet-intercepted-callbacks.test.ts --silent` → all pass (11 assertions across the cases above).

### Step 2: Point `bot.ts` at the shared function (behavior-preserving refactor)

In `src/lib/telegram/bot.ts`, add the import near the other `@/lib/services/...`
imports at the top of the file:

```ts
import { isTelegramCallbackIntercepted } from '@/lib/telegram/partner-cabinet-intercepted-callbacks';
```

Replace the `isPartnerCabinet` block (the 9-line boolean expression shown in
"Current state" §1) with:

```ts
const isPartnerCabinet = isTelegramCallbackIntercepted(data);
```

Do not change anything else in this file — same `if (trigger === 'callback'
&& ctx.callbackQuery?.data)` guard, same `if (isPartnerCabinet) { ... }`
block below it.

**Verify**:
- `npx tsc --noEmit -p tsconfig.json` → no new errors mentioning `bot.ts`.
- `grep -n "isPartnerCabinet" src/lib/telegram/bot.ts` → shows exactly one
  assignment line (the new one-liner) and the `if (isPartnerCabinet)` check;
  none of the original 9 `data.startsWith(...)` / `data ===` lines remain.

### Step 3: Add the dead-node badge to `TriggerNode`

In `src/features/workflow/components/nodes/trigger-node.tsx`:

1. Add imports:
   ```tsx
   import { AlertTriangle } from 'lucide-react';
   import {
     Tooltip,
     TooltipContent,
     TooltipTrigger
   } from '@/components/ui/tooltip';
   import { getTriggerCallbackPattern } from '@/lib/services/workflow/callback-trigger-match';
   import { isTriggerNodePatternIntercepted } from '@/lib/telegram/partner-cabinet-intercepted-callbacks';
   ```
   (Verified: `src/components/ui/tooltip.tsx` exports exactly
   `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`, and `Tooltip`
   itself already wraps children in an implicit `TooltipProvider` — see its
   lines 21-29. `workflow-constructor.tsx`, which renders this node via
   React Flow, does **not** wrap the canvas in a `TooltipProvider` of its
   own, but that's fine precisely because `Tooltip` is self-contained. You
   do not need to add a provider anywhere.)

2. Replace the manual `callbackData ?? data` lookup:
   ```tsx
   config['trigger.callback']?.callbackData ||
   config['trigger.callback']?.data ||
   ```
   with a call to the shared helper. Since `getTriggerCallbackPattern` takes
   a full `WorkflowNode`, not just the config, build a minimal node-shaped
   object inline, e.g.:
   ```tsx
   const callbackPattern =
     triggerType === 'trigger.callback'
       ? getTriggerCallbackPattern({
           id: '',
           type: triggerType,
           position: { x: 0, y: 0 },
           data: nodeData
         } as any)
       : undefined;
   ```
   and use `callbackPattern` wherever `triggerValue` was reading the
   callback fields. (Keep this pragmatic — the goal is one source of truth
   for "what is this node's pattern," not a large refactor of
   `triggerValue`'s other branches.)

3. Compute dead-ness once, near the top of the component body:
   ```tsx
   const isDead =
     triggerType === 'trigger.callback' &&
     !!callbackPattern &&
     isTriggerNodePatternIntercepted(callbackPattern);
   ```

4. Render a badge when `isDead` is true. Add it next to the existing
   `<span className='text-muted-foreground text-xs'>Триггер</span>` in the
   `CardHeader`, and change the card's border color when dead so it's
   visible at a glance without hovering:
   ```tsx
   <Card className={isDead ? 'w-64 border-amber-500 shadow-md' : 'w-64 border-green-500 shadow-md'}>
     <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
       <CardTitle className='text-sm font-medium'>
         <Play className='mr-2 inline-block h-4 w-4 text-green-500' />
         {nodeData.label}
       </CardTitle>
       <div className='flex items-center gap-1'>
         {isDead && (
           <Tooltip>
             <TooltipTrigger asChild>
               <AlertTriangle className='h-4 w-4 text-amber-500' />
             </TooltipTrigger>
             <TooltipContent>
               Не исполняется — этот callback обрабатывается сервером
               напрямую, до того как воркфлоу успевает его увидеть.
             </TooltipContent>
           </Tooltip>
         )}
         <span className='text-muted-foreground text-xs'>Триггер</span>
       </div>
     </CardHeader>
     ...
   ```

**Verify**:
- `npx tsc --noEmit -p tsconfig.json` → no new errors mentioning `trigger-node.tsx`.
- `npx eslint src/features/workflow/components/nodes/trigger-node.tsx --quiet` → no output.
- Manual check (no component-test harness exists in this repo's jest config
  — `jest.config.cjs`'s `testMatch` only covers
  `__tests__/{services,adapters,widgets,integration}/**`, not React
  component rendering — so don't try to add a React Testing Library test
  here; verify by running the dev server and opening the constructor
  instead):
  1. Start the dev server (`.claude/launch.json` config `dev`, or
     `yarn dev` directly).
  2. Open a project's workflow constructor, install/open the "B2B Партнёр"
     template (or open an existing one built from it).
  3. Find the node labeled "Команда (callback)" — it should show the amber
     warning triangle with the tooltip text above.
  4. Find "Ссылка (callback)" / "Выплаты (callback)" / "Сводка (callback)"
     nodes (or whatever they're labeled per the template) — they must
     **not** show the badge.

### Step 4: Create the shared operator-label map and its tests

Create `src/features/workflow/lib/condition-operator-labels.ts`:

```ts
/**
 * @file: src/features/workflow/lib/condition-operator-labels.ts
 * @description: Человекочитаемые подписи операторов условия — единый
 *   источник для выпадающего списка в редакторе свойств
 *   (workflow-properties.tsx) и для текста на самой ноде (condition-node.tsx).
 *   Раньше эти два места держали текст порознь, и нода в итоге показывала
 *   admin'у сырой код (`equals`, `is_not_empty`) вместо готовых подписей.
 * @project: SaaS Bonus System
 * @created: 2026-07-06
 */
import type { ConditionConfig } from '@/types/workflow';

type Operator = NonNullable<ConditionConfig['operator']>;

/**
 * Подписи для операторов, которые реально предлагает выпадающий список в
 * workflow-properties.tsx. Символьные алиасы (`==`, `!==`, `>=`, ...)
 * из ConditionConfig не выбираемы через UI сегодня, но могут прийти из
 * старых/импортированных сценариев — тоже покрыты, чтобы не показывать
 * голый код и для них.
 */
export const CONDITION_OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'Равно (===)',
  not_equals: 'Не равно (!==)',
  contains: 'Содержит',
  not_contains: 'Не содержит',
  greater: 'Больше (>)',
  less: 'Меньше (<)',
  is_empty: 'Пустое',
  is_not_empty: 'Не пустое',
  '==': 'Равно (==)',
  '!=': 'Не равно (!=)',
  '===': 'Равно (===)',
  '!==': 'Не равно (!==)',
  '>': 'Больше (>)',
  '<': 'Меньше (<)',
  '>=': 'Больше или равно (>=)',
  '<=': 'Меньше или равно (<=)'
};

/** Порядок и подмножество, которое реально показывается в `<select>`. */
export const CONDITION_OPERATOR_SELECT_OPTIONS: Array<{
  value: Operator;
  label: string;
}> = (
  [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater',
    'less',
    'is_empty',
    'is_not_empty'
  ] as const
).map((value) => ({ value, label: CONDITION_OPERATOR_LABELS[value] }));

export function formatConditionOperator(operator?: string): string {
  if (!operator) return operator ?? '';
  return CONDITION_OPERATOR_LABELS[operator as Operator] ?? operator;
}
```

Create `__tests__/services/workflow/condition-operator-labels.test.ts`:

```ts
import {
  CONDITION_OPERATOR_LABELS,
  CONDITION_OPERATOR_SELECT_OPTIONS,
  formatConditionOperator
} from '@/features/workflow/lib/condition-operator-labels';

describe('formatConditionOperator', () => {
  it('translates every operator the property editor dropdown offers', () => {
    expect(formatConditionOperator('equals')).toBe('Равно (===)');
    expect(formatConditionOperator('not_equals')).toBe('Не равно (!==)');
    expect(formatConditionOperator('contains')).toBe('Содержит');
    expect(formatConditionOperator('not_contains')).toBe('Не содержит');
    expect(formatConditionOperator('greater')).toBe('Больше (>)');
    expect(formatConditionOperator('less')).toBe('Меньше (<)');
    expect(formatConditionOperator('is_empty')).toBe('Пустое');
    expect(formatConditionOperator('is_not_empty')).toBe('Не пустое');
  });

  it('falls back to the raw value for an unknown operator instead of throwing', () => {
    expect(formatConditionOperator('made_up_operator')).toBe('made_up_operator');
  });

  it('returns an empty string for undefined', () => {
    expect(formatConditionOperator(undefined)).toBe('');
  });
});

describe('CONDITION_OPERATOR_SELECT_OPTIONS', () => {
  it('matches the 8 options currently hardcoded in workflow-properties.tsx', () => {
    expect(CONDITION_OPERATOR_SELECT_OPTIONS.map((o) => o.value)).toEqual([
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'greater',
      'less',
      'is_empty',
      'is_not_empty'
    ]);
  });
});
```

**Verify**: `npx jest __tests__/services/workflow/condition-operator-labels.test.ts --silent` → all pass.

### Step 5: Fix `ConditionNode`'s display text

In `src/features/workflow/components/nodes/condition-node.tsx`:

1. Import the formatter:
   ```tsx
   import { formatConditionOperator } from '@/features/workflow/lib/condition-operator-labels';
   ```

2. Replace:
   ```tsx
   const condition = nodeData.config.condition;
   const conditionText = condition
     ? `${condition.variable} ${condition.operator} ${condition.value}`
     : 'Нажмите для редактирования';
   ```
   with logic that handles all three real states — expression mode, the
   legacy triplet, and unset:
   ```tsx
   const condition = nodeData.config.condition;
   const conditionText = (() => {
     if (!condition) return 'Нажмите для редактирования';
     if (condition.expression) return condition.expression;
     if (condition.variable) {
       return `${condition.variable} ${formatConditionOperator(condition.operator)} ${condition.value ?? ''}`.trim();
     }
     return 'Нажмите для редактирования';
   })();
   ```

**Verify**:
- `npx tsc --noEmit -p tsconfig.json` → no new errors mentioning `condition-node.tsx`.
- `npx eslint src/features/workflow/components/nodes/condition-node.tsx --quiet` → no output.
- Manual: in the constructor, open a condition node's properties, set
  Переменная=`user.partnerRole`, Оператор=`Равно (===)`, Значение=`DIRECTOR`
  — the node card should read `user.partnerRole Равно (===) DIRECTOR`, not
  `user.partnerRole equals DIRECTOR`.

### Step 6: Source the property-editor dropdown from the same map

In `src/features/workflow/components/workflow-properties.tsx`, import
`CONDITION_OPERATOR_SELECT_OPTIONS` and replace the 8 hardcoded `<option>`
lines (shown in "Current state" §6) with a `.map(...)`:

```tsx
<option value=''>Выберите оператор</option>
{CONDITION_OPERATOR_SELECT_OPTIONS.map((opt) => (
  <option key={opt.value} value={opt.value}>
    {opt.label}
  </option>
))}
```

Keep the `<option value=''>Выберите оператор</option>` placeholder line —
it is not part of `CONDITION_OPERATOR_SELECT_OPTIONS` on purpose (it has no
corresponding `Operator` value).

**Verify**:
- `npx tsc --noEmit -p tsconfig.json` → no new errors mentioning `workflow-properties.tsx`.
- `npx eslint src/features/workflow/components/workflow-properties.tsx --quiet` → no output.
- Manual: the operator `<select>` in the properties panel still shows the
  same 8 options in the same order, and picking one still updates the
  condition node's text (from Step 5) correctly.

## Test plan

- `__tests__/services/telegram/partner-cabinet-intercepted-callbacks.test.ts`
  (new, Step 1) — covers: every documented prefix pattern with a real
  suffix, every documented exact pattern, unrelated callback data (must be
  `false`), the bare-prefix regression guard, and the two representative
  forms used by `isTriggerNodePatternIntercepted` against the real template
  data (the one dead node + all ten live nodes from
  `b2b-partner-cabinet.json`).
- `__tests__/services/workflow/condition-operator-labels.test.ts` (new,
  Step 4) — covers: every operator the dropdown offers, an unknown operator
  (fallback, not a throw), `undefined` input, and that the select-options
  list still matches the 8 values from the current dropdown exactly (this
  test breaks loudly if a future edit to the dropdown forgets to update the
  shared map, which is the whole point of extracting it).
- Model both files' structure after `__tests__/services/node-utils.test.ts`
  (plain `describe`/`it`, no mocking needed — everything here is pure
  functions and static data).
- No React-component-rendering tests are added — this repo's
  `jest.config.cjs` `testMatch` doesn't include a jsdom-based pattern for
  `src/features/**` components, and setting one up is out of scope for this
  plan. Steps 3, 5, 6 are verified manually per their own "Verify" sections.
- Verification: `npx jest __tests__/services/telegram/ __tests__/services/workflow/ --silent` → all pass, including the 2 new files.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit -p tsconfig.json` — no new errors compared to
      `baseline-tsc.log` at repo root, and specifically none mentioning any
      file in Scope
- [ ] `npx eslint src/lib/telegram/partner-cabinet-intercepted-callbacks.ts src/lib/telegram/bot.ts src/features/workflow/components/nodes/trigger-node.tsx src/features/workflow/components/nodes/condition-node.tsx src/features/workflow/lib/condition-operator-labels.ts src/features/workflow/components/workflow-properties.tsx --quiet` — no output
- [ ] `npx jest __tests__/services/telegram/ __tests__/services/workflow/ --silent` — all pass; new test files exist and their cases from "Test plan" are present
- [ ] `npx jest --silent 2>&1 | tail -5` — total pass/fail counts are the
      same as before this plan plus the new tests added here (no
      regressions in the ~9 pre-existing unrelated failures)
- [ ] `grep -n "data.startsWith('partner_join_')" src/lib/telegram/bot.ts` —
      returns no matches (the inline literal was replaced by the shared
      function call in Step 2)
- [ ] Manual verification from Steps 3, 5, 6 all confirmed against a running
      dev server with the "B2B Партнёр" template open
- [ ] No files outside the Scope's "In scope" list are modified (`git status`)
- [ ] `plans/README.md` status row for Plan 016 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at any of the "Current state" locations doesn't match the
  excerpts in this plan (the codebase drifted since it was written) —
  re-verify with the drift-check command at the top before touching
  anything.
- The `node -e "..."` verification in "Current state" §3 prints a different
  set of nodes/patterns than the expected output — the template changed;
  re-derive which node(s) are actually dead before writing the badge logic
  against stale assumptions.
- Step 2's refactor changes `isPartnerCabinet`'s boolean result for any
  input compared to the original 9-line expression — this must be a pure
  refactor. If you can't make the shared function produce bit-identical
  results, STOP; do not "improve" the matching logic as part of this plan.
- You find additional `trigger.callback` nodes elsewhere in the codebase
  (other bot templates, not just `b2b-partner-cabinet.json`) whose patterns
  are intercepted — that's fine, the badge will correctly flag them too;
  it's not a reason to stop, just note it in your final report.

## Maintenance notes

- If someone adds a new prefix to `bot.ts`'s intercept list in the future,
  they must add it to
  `src/lib/telegram/partner-cabinet-intercepted-callbacks.ts` instead (that
  file is now the source of truth `bot.ts` calls into) — otherwise the
  editor's dead-node badge silently goes stale again, exactly like the
  duplicated-logic problem this plan just fixed.
- If someone adds a new operator to `ConditionConfig` in
  `src/types/workflow.ts`, TypeScript will force them to also add it to
  `CONDITION_OPERATOR_LABELS` in
  `src/features/workflow/lib/condition-operator-labels.ts` (the
  `Record<Operator, string>` type makes this a compile error, not a runtime
  surprise) — that's intentional, don't relax the type to `Partial<...>` to
  make an error go away.
- `src/lib/max-bot/bot.ts` was deliberately left out of scope (see Scope).
  If MAX's intercept list is ever expanded to match Telegram's (e.g. MAX
  partner-cabinet also gets a full team-management UI), revisit whether the
  editor's dead-node check should become platform-aware instead of always
  checking against the Telegram (superset) list.
- This plan does not address the rest of the design-critique findings
  (raw `{{...}}` variable placeholders in message previews, dense
  unlabeled node graph, "read-only vs. write" node grouping). Those are
  larger, separate UI work — flagged in the critique, not planned here.
