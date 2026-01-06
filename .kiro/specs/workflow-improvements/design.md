# Design Document: Исправление багов и история выполнения Workflow

## Overview

Комплексное улучшение системы workflow: исправление 10 критических багов и добавление визуализации истории выполнения в стиле n8n с подсветкой на canvas, полным логированием payload, хранением 7 дней и real-time SSE.

## Architecture

### Компоненты системы

```
┌─────────────────────────────────────────────────────────────────┐
│                    Workflow Constructor UI                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │ Executions   │  │              Canvas View                  │ │
│  │ List Panel   │  │  ┌─────────────────────────────────────┐ │ │
│  │              │  │  │  Workflow Canvas (n8n-style)        │ │ │
│  │ - Filters    │  │  │  - Green glow: Success              │ │ │
│  │ - Pagination │  │  │  - Red glow: Error                  │ │ │
│  │ - Search     │  │  │  - Pulse: Running                   │ │ │
│  │ - SSE Live   │  │  │  - Gray: Skipped                    │ │ │
│  └──────────────┘  │  │  - Animated edges                   │ │ │
│                    │  └─────────────────────────────────────┘ │ │
│                    │  ┌─────────────────────────────────────┐ │ │
│                    │  │    Step Inspector (Full Payload)    │ │ │
│                    │  │  - Input/Output data                │ │ │
│                    │  │  - Variables before/after           │ │ │
│                    │  │  - HTTP requests/responses          │ │ │
│                    │  │  - Restart from node button         │ │ │
│                    │  └─────────────────────────────────────┘ │ │
│                    └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow для SSE

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram   │────▶│  Workflow   │────▶│  Database   │
│   Message   │     │  Processor  │     │  (Prisma)   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                           ▼                    │
                    ┌─────────────┐             │
                    │  Execution  │◀────────────┘
                    │   Logger    │
                    │ (Full Payload)
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    SSE      │────▶│   Browser   │
                    │  Endpoint   │     │   Client    │
                    └─────────────┘     └─────────────┘
```

---

## ЧАСТЬ 1: ИСПРАВЛЕНИЕ БАГОВ

### Bug 1: Race Condition в SessionId

**Текущая проблема:**
```typescript
// simple-workflow-processor.ts
private generateSessionId(ctx: Context): string {
  const isCallback = !!ctx.callbackQuery;
  const sessionId = isCallback
    ? `${chatId}_${userId}` // Стабильный для callback
    : `${chatId}_${userId}_${Date.now()}`; // Уникальный для команд - ПРОБЛЕМА!
  return sessionId;
}
```

**Решение:**
```typescript
private async getOrCreateSessionId(ctx: Context): Promise<string> {
  const chatId = ctx.chat?.id || ctx.from?.id || 'unknown';
  const userId = ctx.from?.id || 'unknown';
  const baseSessionId = `${chatId}_${userId}`;
  
  // Проверяем активное выполнение
  const activeExecution = await db.workflowExecution.findFirst({
    where: {
      projectId: this.projectId,
      workflowId: this.workflowVersion.workflowId,
      telegramChatId: chatId.toString(),
      status: { in: ['running', 'waiting'] }
    },
    orderBy: { startedAt: 'desc' }
  });
  
  if (activeExecution) {
    return activeExecution.sessionId; // Используем существующий
  }
  
  return `${baseSessionId}_${Date.now()}`; // Новый только если нет активного
}
```

### Bug 2: getSync в VariableManager

**Текущая проблема:**
```typescript
getSync(name: string, scope: VariableScope = 'session'): any {
  return undefined; // Всегда undefined!
}
```

**Решение:**
```typescript
export class VariableManager implements IVariableManager {
  private cache: Map<string, any> = new Map();
  
  async preloadCache(): Promise<void> {
    const variables = await db.workflowVariable.findMany({
      where: {
        projectId: this.projectId,
        sessionId: this.sessionId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    
    for (const v of variables) {
      this.cache.set(`${v.scope}:${v.key}`, v.value);
    }
  }
  
  getSync(name: string, scope: VariableScope = 'session'): any {
    return this.cache.get(`${scope}:${name}`);
  }
  
  async set(name: string, value: any, scope: VariableScope = 'session'): Promise<void> {
    this.cache.set(`${scope}:${name}`, value); // Обновляем кэш сразу
    // ... сохранение в БД
  }
}
```

### Bug 3: Тип nodes в WorkflowVersion

**Утилита конвертации:**
```typescript
// src/lib/services/workflow/utils/node-utils.ts
export function normalizeNodes(source: unknown): Record<string, WorkflowNode> {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return source as Record<string, WorkflowNode>;
  }
  
  if (Array.isArray(source)) {
    return source.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {} as Record<string, WorkflowNode>);
  }
  
  if (typeof source === 'string') {
    return normalizeNodes(JSON.parse(source));
  }
  
  return {};
}
```

### Bug 7: Truncated condition-evaluator.ts

**Восстановленный код:**
```typescript
private static validateAST(node: any): void {
  if (!node || typeof node !== 'object') {
    throw new Error('Invalid AST node');
  }

  if (!this.ALLOWED_NODE_TYPES.has(node.type)) {
    throw new Error(`Disallowed AST node type: ${node.type}`);
  }

  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end') continue;

    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && item.type) {
          this.validateAST(item);
        }
      });
    } else if (value && typeof value === 'object' && value.type) {
      this.validateAST(value);
    } else if (key === 'name' && typeof value === 'string') {
      if (!this.ALLOWED_IDENTIFIERS.has(value) &&
          !value.startsWith('$') &&
          !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
        throw new Error(`Disallowed identifier: ${value}`);
      }
    }
  }
}
```

### Bug 8: Транзакции для обновления состояния

```typescript
static async updateExecutionState(
  context: ExecutionContext,
  updates: ExecutionStateUpdate
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.workflowExecution.update({
      where: { id: context.executionId },
      data: {
        status: updates.status,
        currentNodeId: updates.currentNodeId,
        stepCount: updates.stepCount,
        error: updates.error
      }
    });
    
    if (updates.variables) {
      for (const v of updates.variables) {
        await tx.workflowVariable.upsert({
          where: {
            projectId_sessionId_scope_key: {
              projectId: context.projectId,
              sessionId: context.sessionId,
              scope: v.scope,
              key: v.key
            }
          },
          create: { ...v, projectId: context.projectId, sessionId: context.sessionId },
          update: { value: v.value }
        });
      }
    }
  });
}
```

---

## ЧАСТЬ 2: ИСТОРИЯ ВЫПОЛНЕНИЯ

### Database Schema Changes

```prisma
model WorkflowExecution {
  // Existing fields...
  
  // Restart tracking
  parentExecutionId   String?
  parentExecution     WorkflowExecution?  @relation("ExecutionRestart", fields: [parentExecutionId], references: [id])
  childExecutions     WorkflowExecution[] @relation("ExecutionRestart")
  restartedFromNodeId String?
}

model WorkflowLog {
  // Existing fields...
  
  // Full payload logging
  inputData       Json?   // Full input data
  outputData      Json?   // Full output data  
  variablesBefore Json?   // Variables state before
  variablesAfter  Json?   // Variables state after
  httpRequest     Json?   // HTTP request details
  httpResponse    Json?   // HTTP response details
  duration        Int?    // Step duration in ms
}
```

### API Endpoints

#### GET /api/projects/[id]/workflows/[workflowId]/executions
```typescript
interface ExecutionListResponse {
  executions: {
    id: string;
    status: 'running' | 'waiting' | 'completed' | 'failed';
    startedAt: string;
    duration?: number;
    userId?: string;
    stepCount: number;
  }[];
  pagination: { page: number; total: number; };
}
```

#### GET /api/projects/[id]/workflows/[workflowId]/executions/[executionId]/stream
SSE endpoint для real-time обновлений:
```typescript
// Events
{ type: 'step_completed', step: ExecutionStep }
{ type: 'execution_status', status: string, error?: string }
{ type: 'heartbeat' }
```

#### POST /api/projects/[id]/workflows/[workflowId]/executions/[executionId]/restart
```typescript
interface RestartRequest {
  fromNodeId: string;
  resetVariables?: boolean;
}
```

### UI Components

#### ExecutionCanvas (n8n-style highlighting)
```typescript
interface ExecutionCanvasProps {
  workflowVersion: WorkflowVersion;
  executionPath: string[];
  stepStatuses: Record<string, 'success' | 'error' | 'running' | 'skipped'>;
}

// CSS classes for highlighting
.node-success { box-shadow: 0 0 10px #22c55e; border-color: #22c55e; }
.node-error { box-shadow: 0 0 10px #ef4444; border-color: #ef4444; }
.node-running { animation: pulse 1.5s infinite; }
.node-skipped { opacity: 0.5; }
.edge-animated { stroke-dasharray: 5; animation: dash 0.5s linear infinite; }
```

#### StepInspector (Full Payload)
```typescript
interface StepInspectorProps {
  step: {
    nodeId: string;
    inputData: any;
    outputData: any;
    variablesBefore: Record<string, any>;
    variablesAfter: Record<string, any>;
    httpRequest?: { url: string; method: string; headers: any; body: any; };
    httpResponse?: { status: number; body: any; };
    error?: { message: string; stack: string; };
  };
  onRestart: (nodeId: string) => void;
}
```

### Cleanup Job (7 days retention)

```typescript
// src/app/api/cron/cleanup-executions/route.ts
export async function GET() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  
  const result = await db.workflowExecution.deleteMany({
    where: { startedAt: { lt: cutoffDate } }
  });
  
  return Response.json({ deleted: result.count });
}
```

---

## Implementation Priority

### Phase 1: Critical Bugs (блокируют работу)
1. Bug #2: getSync в VariableManager
2. Bug #7: truncated condition-evaluator.ts  
3. Bug #1: Race Condition в SessionId

### Phase 2: High Priority Bugs
4. Bug #3: Тип nodes в WorkflowVersion
5. Bug #8: Транзакции для обновления состояния
6. Bug #6: Консистентная обработка waitForInput

### Phase 3: Medium Priority Bugs
7. Bug #4: Дублирование логики клавиатур
8. Bug #5: Валидация goto_node
9. Bug #9: Конфигурируемые лимиты

### Phase 4: New Feature - Execution History
10. Database schema changes
11. API endpoints (list, details, SSE, restart)
12. UI components (list, canvas highlighting, inspector)
13. Cleanup job

### Phase 5: Low Priority
14. Bug #10: flow.sub_workflow

