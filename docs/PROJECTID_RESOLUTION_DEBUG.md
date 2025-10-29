# Диагностика проблемы `projectId = undefined` в Workflow Context

## 📋 Краткое описание

**Проблема**: При выполнении workflow query `check-telegram-user`, параметр `projectId` резолвится как `undefined`, что приводит к:
- ❌ Пользователи НЕ находятся в базе данных (query с `projectId = undefined`)
- ❌ Workflow идёт по неправильному пути (`welcome-message` вместо `active-user-profile`)
- ❌ При повторном `/start` система не распознаёт уже зарегистрированных пользователей

## 🔍 Анализ логов

### Проблемные строки из логов

**Строка 378** (первый `/start`):
```
🔍 Resolving workflow variable: projectId
✅ Resolved projectId: undefined
```

**Строка 490** (повторный `/start` после sharing contact):
```
🔍 Resolving workflow variable: projectId
✅ Resolved projectId: undefined
```

**Строка 382** (SQL query):
```sql
SELECT ... FROM "public"."users" 
WHERE ("public"."users"."telegram_id" = $1 AND "public"."users"."project_id" = $2)
```
**$2 = undefined** ❌

## 🧬 Цепочка вызовов

### 1. Bot Middleware (`src/lib/telegram/bot.ts`)

**Строка 70**:
```typescript
const projectId = ctx.session?.projectId;
```

**Вывод**: `projectId` ЕСТЬ в сессии (передаётся через `BotSessionService.createSessionMiddleware(projectId)`)

### 2. Workflow Execution (`src/lib/services/workflow-runtime.service.ts`)

**Строка 300-302**:
```typescript
static async executeWorkflow(projectId: string, trigger: 'start' | 'message' | 'callback', context: any): Promise<boolean> {
  // ✅ КРИТИЧНО: Инициализируем handlers в начале
  this.initializeHandlers();
```

**Вывод**: `projectId` передаётся в `executeWorkflow` как параметр

### 3. Processor Creation (`src/lib/services/workflow-runtime.service.ts`)

**Строка 515**:
```typescript
const processor = this.getWorkflowProcessor(projectId, workflowVersion);
```

**Строка 130**:
```typescript
const processor = new SimpleWorkflowProcessor(workflowVersion, projectId);
```

**Вывод**: `projectId` передаётся в конструктор `SimpleWorkflowProcessor`

### 4. Context Creation (`src/lib/services/simple-workflow-processor.ts`)

**Строка 103-114**:
```typescript
context = await ExecutionContextManager.createContext(
  this.projectId,  // ✅ Передаётся
  this.workflowVersion.workflowId,
  this.workflowVersion.version,
  this.generateSessionId(ctx),
  userId,
  chatId,
  telegramUserId,
  ctx.from?.username,
  ctx.message?.text,
  ctx.callbackQuery?.data
);
```

**Вывод**: `this.projectId` передаётся в `createContext`

### 5. ExecutionContext Setup (`src/lib/services/workflow/execution-context-manager.ts`)

**Строка 88-90**:
```typescript
const context: ExecutionContext = {
  executionId: execution.id,
  projectId,  // ✅ Добавляется в контекст
  workflowId,
  version,
  ...
};
```

**Вывод**: `projectId` ЕСТЬ в `ExecutionContext` как top-level свойство

### 6. Variable Resolution (`src/lib/services/workflow/handlers/utils.ts`)

**Строка 132** (`resolveVariablePath`):
```typescript
async function resolveVariablePath(path: string, context: ExecutionContext): Promise<any> {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  const [root, ...rest] = segments;
  
  // ...
  
  // Доступ к полям контекста напрямую (projectId, userId и т.д.)
  if ((context as any)[root] !== undefined) {
    return rest.reduce((acc: any, key) => acc?.[key], (context as any)[root]);
  }
  
  // ...
}
```

**Ожидаемое поведение**: 
- `path = "projectId"`
- `root = "projectId"`
- `(context as any)["projectId"]` должен вернуть значение `projectId` из `ExecutionContext`

**Фактическое поведение**:
- Резолв возвращает `undefined`

## 🚨 ГИПОТЕЗА

**Возможные причины**:

1. **Код не обновился после изменений** (горячая перезагрузка Next.js не сработала)
   - Node.js процессы запущены **ДО** внесения исправлений в код
   - Кэш модулей содержит старую версию кода

2. **`context.projectId` на самом деле `undefined`**
   - `this.projectId` в `SimpleWorkflowProcessor` мог не установиться корректно
   - Возможна проблема с передачей через constructor

3. **Проблема с типизацией `ExecutionContext`**
   - `(context as any)[root]` может не работать из-за Proxy/getter

## ✅ РЕШЕНИЕ: Детальное логирование

Добавлено debug-логирование в `utils.ts` (строка 171-181):

```typescript
// Доступ к полям контекста напрямую (projectId, userId и т.д.)
console.log(`🔍 DEBUG: Checking context.${root}:`, {
  rootValue: (context as any)[root],
  isDefined: (context as any)[root] !== undefined,
  contextKeys: Object.keys(context)
});

if ((context as any)[root] !== undefined) {
  const result = rest.reduce((acc: any, key) => acc?.[key], (context as any)[root]);
  console.log(`✅ DEBUG: Resolved context.${root} =`, result);
  return result;
}
```

**Что покажут логи**:
1. `rootValue` — фактическое значение `context.projectId`
2. `isDefined` — результат проверки `!== undefined`
3. `contextKeys` — все ключи объекта `context` (чтобы убедиться, что `projectId` там есть)

## 📊 Следующие шаги

### ШАГ 1: Перезапустить dev сервер

```powershell
# В окне PowerShell с 'pnpm dev':
Ctrl+C
pnpm dev
```

### ШАГ 2: Протестировать `/start`

```
/start
```

### ШАГ 3: Проверить логи

Искать строки:
```
🔍 DEBUG: Checking context.projectId:
✅ DEBUG: Resolved context.projectId =
```

### ШАГ 4: Анализ результатов

**Если `rootValue = undefined`**:
- Проблема в создании `ExecutionContext`
- Проверить, что `this.projectId` в `SimpleWorkflowProcessor` установлен корректно

**Если `rootValue = "cmh2d0uv30000v8h8ujr7u233"` (корректный ID)**:
- Проблема в логике `if ((context as any)[root] !== undefined)`
- Возможно, нужно другой способ доступа к свойствам контекста

**Если логи вообще не появляются**:
- Код не обновился
- Требуется более радикальный рестарт (убить все Node.js процессы вручную)

## 🎯 Ожидаемый результат

После исправления:
- ✅ `projectId` резолвится корректно
- ✅ Query `check-telegram-user` находит пользователя по Telegram ID
- ✅ Workflow идёт по пути `check-user-active` → `active-user-profile`
- ✅ Повторный `/start` показывает профиль, а не welcome message

---

**Дата создания**: 2025-10-28  
**Статус**: В процессе диагностики  
**Приоритет**: 🔴 КРИТИЧЕСКИЙ  

