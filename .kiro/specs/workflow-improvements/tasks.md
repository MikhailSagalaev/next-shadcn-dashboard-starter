# Implementation Tasks: Исправление багов и история выполнения Workflow

## Phase 1: Critical Bugs (блокируют работу)

### Task 1.1: Исправление getSync в VariableManager
- [x] Добавить приватное поле `cache: Map<string, any>` в VariableManager





- [x] Добавить метод `preloadCache()` для загрузки переменных из БД в кэш


- [x] Обновить `getSync()` для возврата значения из кэша


- [x] Обновить `set()` для синхронного обновления кэша


- [x] Обновить `delete()` для удаления из кэша


- [x] Вызвать `preloadCache()` в ExecutionContextManager.createContext()




**Файлы:**
- `src/lib/services/workflow/variable-manager.ts`
- `src/lib/services/workflow/execution-context-manager.ts`

### Task 1.2: Исправление truncated condition-evaluator.ts
- [x] Восстановить полный код метода `validateAST`

- [x] Добавить проверку идентификаторов с `$` prefix
- [x] Добавить проверку валидных JavaScript идентификаторов
- [x] Протестировать с различными условиями

**Файлы:**
- `src/lib/services/workflow/condition-evaluator.ts`

### Task 1.3: Исправление Race Condition в SessionId
- [x] Создать метод `getOrCreateSessionId()` вместо `generateSessionId()`




- [x] Добавить проверку активного выполнения для пользователя


- [x] Использовать существующий sessionId для активных выполнений


- [x] Создавать новый sessionId только для новых выполнений




**Файлы:**
- `src/lib/services/simple-workflow-processor.ts`

---

## Phase 2: High Priority Bugs

### Task 2.1: Исправление типа nodes в WorkflowVersion
- [x] Создать утилиту `normalizeNodes()` в `src/lib/services/workflow/utils/node-utils.ts`



- [x] Создать утилиту `serializeNodes()` для сохранения
- [x] Обновить `buildWorkflowVersion()` в execution-service.ts
- [x] Обновить конструктор SimpleWorkflowProcessor
- [x] Обновить API endpoint сохранения workflow

**Файлы:**
- `src/lib/services/workflow/utils/node-utils.ts` (новый)
- `src/lib/services/workflow/execution-service.ts`
- `src/lib/services/simple-workflow-processor.ts`

### Task 2.2: Добавление транзакций для обновления состояния
- [x] Создать метод `updateExecutionState()` с транзакцией в ExecutionContextManager





- [x] Обновить все места изменения status execution



- [x] Добавить retry logic с exponential backoff (max 3 attempts)



**Файлы:**
- `src/lib/services/workflow/execution-context-manager.ts`
- `src/lib/services/simple-workflow-processor.ts`

### Task 2.3: Консистентная обработка waitForInput
- [x] Создать `WaitForInputHandler` с унифицированным интерфейсом




- [x] Определить `WaitForInputConfig` interface


- [x] Обновить MessageHandler для использования WaitForInputHandler


- [x] Обновить KeyboardHandler для использования WaitForInputHandler




**Файлы:**
- `src/lib/services/workflow/handlers/wait-for-input-handler.ts` (новый)
- `src/lib/services/workflow/handlers/message-handler.ts`
- `src/lib/services/workflow/handlers/keyboard-handler.ts`

---

## Phase 3: Medium Priority Bugs

### Task 3.1: Устранение дублирования логики клавиатур
- [x] Выделить всю логику клавиатур в KeyboardHandler

- [x] Создать методы `buildInlineKeyboard()`, `buildReplyKeyboard()`
- [x] Обновить MessageHandler для делегирования к KeyboardHandler
- [x] Удалить дублирующийся код из message-handler.ts

**Файлы:**
- `src/lib/services/workflow/handlers/keyboard-handler.ts`
- `src/lib/services/workflow/handlers/message-handler.ts`

### Task 3.2: Валидация goto_node в кнопках
- [x] Добавить метод `validateGotoNodes()` в WorkflowValidator
- [x] Проверять inline keyboard buttons на существование target node
- [x] Проверять flow.jump на существование target node
- [x] Вызывать валидацию при сохранении workflow

**Файлы:**
- `src/lib/services/workflow/workflow-validator.ts`
- `src/app/api/projects/[id]/workflows/[workflowId]/route.ts`

### Task 3.3: Конфигурируемые лимиты
- [x] Добавить поля в Prisma schema: workflowMaxSteps, workflowTimeoutMs
- [x] Создать миграцию
- [x] Обновить SimpleWorkflowProcessor для использования настроек проекта
- [x] Добавить UI для настройки лимитов в Project Settings

**Файлы:**
- `prisma/schema.prisma`
- `src/lib/services/simple-workflow-processor.ts`
- `src/features/projects/components/project-settings-view.tsx`

---

## Phase 4: История выполнения Workflow

### Task 4.1: Database Schema для полного payload
- [x] Добавить поля в WorkflowExecution: parentExecutionId, restartedFromNodeId
- [x] Добавить поля в WorkflowLog: inputData, outputData, variablesBefore, variablesAfter, httpRequest, httpResponse, duration
- [x] Создать миграцию
- [x] Запустить `npx prisma generate`

**Файлы:**
- `prisma/schema.prisma`

### Task 4.2: Расширенное логирование полного payload
- [x] Обновить ExecutionContextManager для логирования inputData/outputData
- [x] Добавить логирование variablesBefore/variablesAfter
- [x] Добавить логирование HTTP requests/responses в ApiRequestHandler
- [x] Добавить измерение duration для каждого шага
- [x] Добавить санитизацию чувствительных данных (токены, пароли)

**Файлы:**
- `src/lib/services/workflow/execution-context-manager.ts`
- `src/lib/services/workflow/handlers/action-handlers.ts`

### Task 4.3: API Endpoint списка выполнений
- [x] Создать GET `/api/projects/[id]/workflows/[workflowId]/executions`
- [x] Реализовать пагинацию (20 per page)
- [x] Добавить фильтры: status, dateFrom, dateTo, userId, search
- [x] Добавить сортировку по startedAt

**Файлы:**
- `src/app/api/projects/[id]/workflows/[workflowId]/executions/route.ts`

### Task 4.4: API Endpoint деталей выполнения
- [x] Создать GET `/api/projects/[id]/workflows/[workflowId]/executions/[executionId]`
- [x] Возвращать execution metadata, steps с полным payload, variables, path

**Файлы:**
- `src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/route.ts`

### Task 4.5: SSE Endpoint для real-time
- [x] Создать GET `/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/stream`
- [x] Реализовать SSE streaming с событиями: step_completed, execution_status
- [x] Добавить heartbeat для поддержания соединения
- [x] Реализовать graceful shutdown при отключении клиента

**Файлы:**
- `src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/stream/route.ts`

### Task 4.6: API Endpoint перезапуска
- [x] Создать POST `/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/restart`
- [x] Реализовать restart from specific node
- [x] Добавить опцию resetVariables
- [x] Связать новое выполнение с оригинальным через parentExecutionId

**Файлы:**
- `src/app/api/projects/[id]/workflows/[workflowId]/executions/[executionId]/restart/route.ts`

### Task 4.7: UI - ExecutionsList Component
- [x] Создать компонент `ExecutionsList`
- [x] Реализовать таблицу с колонками: status, startedAt, duration, user, steps
- [x] Добавить пагинацию
- [x] Добавить фильтры (tabs для статусов, date picker, search)

**Файлы:**
- `src/features/workflow/components/executions-list.tsx`

### Task 4.8: UI - ExecutionCanvas с n8n-style highlighting
- [x] Создать компонент `ExecutionCanvas`
- [x] Интегрировать с React Flow (read-only mode)
- [x] Реализовать highlighting нод: green glow (success), red glow (error), pulse (running), gray (skipped)
- [x] Добавить анимацию edges для execution flow
- [x] Добавить tooltips с payload preview

**Файлы:**
- `src/features/workflow/components/execution-canvas.tsx`

### Task 4.9: UI - StepInspector с полным payload
- [x] Создать компонент `StepInspector`
- [x] Добавить tabs: Input, Output, Variables, HTTP, Error
- [x] Интегрировать JSON viewer с syntax highlighting
- [x] Добавить кнопку "Restart from here"
- [x] Добавить copy to clipboard

**Файлы:**
- `src/features/workflow/components/step-inspector.tsx`

### Task 4.10: UI - SSE Client Hook
- [x] Создать hook `useExecutionStream`
- [x] Реализовать подключение к SSE endpoint
- [x] Обработать события: step_completed, execution_status
- [x] Добавить reconnection с exponential backoff

**Файлы:**
- `src/features/workflow/hooks/use-execution-stream.ts`

### Task 4.11: Интеграция в Workflow Constructor
- [x] Добавить tabs "Editor" / "Executions" в workflow page
- [x] Создать layout для execution details view
- [x] Добавить mini execution status в Editor mode

**Файлы:**
- `src/features/workflow/components/workflow-page-tabs.tsx`
- `src/features/workflow/components/workflow-constructor.tsx`
- `src/app/dashboard/projects/[id]/workflow/page.tsx`

### Task 4.12: Cleanup Job (7 дней)
- [x] Создать cron job `/api/cron/cleanup-executions`
- [x] Реализовать удаление executions старше 7 дней
- [x] Каскадное удаление связанных logs
- [x] Добавить логирование количества удалённых записей

**Файлы:**
- `src/app/api/cron/cleanup-executions/route.ts`

---

## Phase 5: Low Priority

### Task 5.1: Реализация flow.sub_workflow
- [x] Создать SubWorkflowHandler в flow-handlers.ts



- [x] Добавить проверку уровня вложенности (max 5)
- [x] Реализовать загрузку sub-workflow по ID
- [x] Создать метод `createSubContext()` в ExecutionContextManager
- [x] Реализовать inputMapping и outputMapping
- [x] Добавить UI для выбора sub-workflow в конструкторе

**Файлы:**
- `src/lib/services/workflow/handlers/flow-handlers.ts`
- `src/lib/services/workflow/execution-context-manager.ts`
- `src/features/workflow/components/node-config-panels/sub-workflow-config.tsx`

---

## Testing & Documentation

### Task 6.1: Unit Tests
- [x] Тесты для VariableManager (getSync, cache, preload)
- [x] Тесты для ConditionEvaluator (validateAST)
- [x] Тесты для WorkflowValidator (validateGotoNodes)
- [x] Тесты для normalizeNodes utility

**Файлы:**
- `__tests__/services/variable-manager.test.ts`
- `__tests__/services/condition-evaluator.test.ts`
- `__tests__/services/workflow-validator.test.ts`
- `__tests__/services/node-utils.test.ts`

### Task 6.2: Integration Tests
- [-] Тест полного цикла выполнения workflow с переменными
- [-] Тест callback с сохранением переменных между взаимодействиями
- [-] Тест SSE streaming

**Файлы:**
- `__tests__/integration/workflow-execution.test.ts`

### Task 6.3: Documentation
- [x] Обновить changelog.md
- [x] Обновить tasktracker.md
- [x] Обновить workflow-constructor-guide.md
- [x] Добавить документацию по истории выполнения в user-docs

**Файлы:**
- `docs/changelog.md`
- `docs/tasktracker.md`
- `docs/workflow-constructor-guide.md`
- `user-docs/app/workflow-constructor/page.mdx`

