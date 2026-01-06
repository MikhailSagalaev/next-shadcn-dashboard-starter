# Requirements Document: Исправление багов и история выполнения Workflow

## Introduction

Данный документ описывает требования к исправлению критических багов конструктора workflow и добавлению функционала визуализации истории выполнения. Визуализация выполнена в стиле n8n с подсветкой нод на canvas, полным логированием payload, хранением истории 7 дней и real-time обновлениями через SSE.

## Glossary

- **Workflow** — сценарий автоматизации Telegram бота, состоящий из нод и связей
- **WorkflowNode** — элемент сценария (триггер, сообщение, условие, действие)
- **WorkflowConnection** — связь между нодами, определяющая порядок выполнения
- **ExecutionContext** — контекст выполнения workflow, содержащий переменные и состояние
- **SessionId** — идентификатор сессии пользователя для хранения переменных
- **VariableManager** — менеджер переменных с поддержкой scopes (global, project, user, session)
- **ConditionEvaluator** — компонент для вычисления условий в workflow
- **NodeHandler** — обработчик конкретного типа ноды
- **WorkflowExecution** — запись о выполнении workflow, содержащая статус, время, ошибки
- **ExecutionStep** — отдельный шаг выполнения (обработка одной ноды)
- **CanvasHighlighting** — подсветка нод на canvas в соответствии со статусом выполнения (n8n-style)
- **ExecutionReplay** — перезапуск выполнения с определённой ноды

---

## ЧАСТЬ 1: ИСПРАВЛЕНИЕ БАГОВ

### Requirement 1: Исправление Race Condition в SessionId

**User Story:** As a workflow developer, I want session variables to persist correctly between user interactions, so that callback buttons can access variables set in previous steps.

**Problem:** В `generateSessionId` для callback используется стабильный sessionId без timestamp, но для команд/сообщений добавляется timestamp. Это приводит к потере переменных при переходе между взаимодействиями.

#### Acceptance Criteria

1. WHEN a user triggers a workflow via /start command THEN the system SHALL generate a stable sessionId based on chatId and userId only
2. WHEN a user clicks a callback button THEN the system SHALL use the same sessionId as the original command
3. WHEN a user sends a message in an active workflow THEN the system SHALL reuse the existing sessionId from the active execution
4. IF an active execution exists for the user THEN the system SHALL NOT create a new sessionId
5. WHEN the workflow completes or times out THEN the system SHALL allow new sessionId generation for subsequent interactions

### Requirement 2: Исправление getSync в VariableManager

**User Story:** As a workflow developer, I want condition expressions to access session variables synchronously, so that conditions can evaluate correctly without async delays.

**Problem:** Метод `getSync` всегда возвращает `undefined`, что ломает все условия, использующие переменные.

#### Acceptance Criteria

1. WHEN VariableManager is created THEN the system SHALL initialize an in-memory cache for session variables
2. WHEN a variable is set via `set()` method THEN the system SHALL update both database and in-memory cache
3. WHEN `getSync()` is called THEN the system SHALL return the value from in-memory cache
4. WHEN a variable is deleted THEN the system SHALL remove it from both database and cache
5. WHEN ExecutionContext is created THEN the system SHALL preload session variables into cache
6. IF the variable is not in cache THEN `getSync()` SHALL return undefined (not throw error)

### Requirement 3: Исправление типа nodes в WorkflowVersion

**User Story:** As a system developer, I want consistent node storage format, so that workflow execution doesn't fail due to type mismatches.

**Problem:** В БД nodes хранятся как массив, но тип `WorkflowVersion` ожидает объект `Record<string, WorkflowNode>`.

#### Acceptance Criteria

1. WHEN saving WorkflowVersion to database THEN the system SHALL store nodes as JSON object with nodeId as keys
2. WHEN loading WorkflowVersion from database THEN the system SHALL parse nodes into `Record<string, WorkflowNode>` format
3. IF nodes are stored as array (legacy format) THEN the system SHALL convert them to object format during load
4. WHEN creating new workflow THEN the system SHALL use object format for nodes from the start
5. WHEN migrating existing workflows THEN the system SHALL preserve all node data during format conversion

### Requirement 4: Устранение дублирования логики клавиатур

**User Story:** As a system maintainer, I want keyboard handling logic to be centralized, so that changes don't need to be made in multiple places.

**Problem:** Логика обработки клавиатур дублируется в `message-handler.ts` и `keyboard-handler.ts`.

#### Acceptance Criteria

1. WHEN processing inline keyboard THEN the system SHALL use only KeyboardHandler
2. WHEN processing reply keyboard THEN the system SHALL use only KeyboardHandler
3. WHEN MessageHandler needs keyboard functionality THEN it SHALL delegate to KeyboardHandler
4. WHEN keyboard configuration changes THEN only KeyboardHandler SHALL require modification
5. WHEN adding new keyboard type THEN the system SHALL require changes only in KeyboardHandler

### Requirement 5: Валидация goto_node в кнопках

**User Story:** As a workflow designer, I want the system to validate goto_node references, so that I don't create broken workflows.

**Problem:** Нет валидации существования целевой ноды при использовании `goto_node` в кнопках.

#### Acceptance Criteria

1. WHEN saving workflow with goto_node in button config THEN the system SHALL validate that target node exists
2. IF goto_node references non-existent node THEN the system SHALL return validation error with node details
3. WHEN deleting a node THEN the system SHALL check for goto_node references to this node
4. IF deleted node is referenced by goto_node THEN the system SHALL warn user about broken references
5. WHEN importing workflow THEN the system SHALL validate all goto_node references

### Requirement 6: Консистентная обработка waitForInput

**User Story:** As a workflow developer, I want waitForInput to work consistently across all message types, so that user input collection is reliable.

**Problem:** Флаг `waitForInput` обрабатывается по-разному в разных handlers.

#### Acceptance Criteria

1. WHEN message node has waitForInput=true THEN the system SHALL pause execution and wait for user response
2. WHEN user responds to waitForInput THEN the system SHALL store response in specified variable
3. WHEN waitForInput times out THEN the system SHALL continue to timeout branch or fail gracefully
4. WHEN inline keyboard has waitForInput THEN the system SHALL wait for callback selection
5. WHEN reply keyboard has waitForInput THEN the system SHALL wait for button press or text input

### Requirement 7: Исправление truncated condition-evaluator.ts

**User Story:** As a system developer, I want condition-evaluator.ts to be complete, so that all condition types work correctly.

**Problem:** Файл `condition-evaluator.ts` обрезан примерно на строке 150 в середине условия.

#### Acceptance Criteria

1. WHEN condition-evaluator.ts is loaded THEN the system SHALL have complete validateAST method
2. WHEN validating identifier in AST THEN the system SHALL check against ALLOWED_IDENTIFIERS
3. WHEN identifier starts with $ THEN the system SHALL allow it as variable reference
4. WHEN identifier matches valid JavaScript identifier pattern THEN the system SHALL allow it
5. WHEN condition uses complex expression THEN the system SHALL evaluate it correctly via AST

### Requirement 8: Добавление транзакций для обновления состояния

**User Story:** As a system administrator, I want execution state updates to be atomic, so that partial failures don't corrupt workflow state.

**Problem:** Нет транзакций при обновлении состояния выполнения, что может привести к несогласованности данных.

#### Acceptance Criteria

1. WHEN updating execution status and variables THEN the system SHALL use database transaction
2. WHEN transaction fails THEN the system SHALL rollback all changes
3. WHEN logging execution step THEN the system SHALL include it in the same transaction as state update
4. IF execution update fails THEN the system SHALL retry with exponential backoff (max 3 attempts)
5. WHEN concurrent updates occur THEN the system SHALL use optimistic locking to prevent conflicts

### Requirement 9: Конфигурируемые лимиты вместо hardcoded

**User Story:** As a project owner, I want to configure workflow limits per project, so that I can adjust them based on my needs.

**Problem:** Лимиты (maxSteps, timeout) захардкожены вместо конфигурации.

#### Acceptance Criteria

1. WHEN creating project THEN the system SHALL use default workflow limits from system config
2. WHEN project owner opens settings THEN the system SHALL display configurable workflow limits
3. WHEN workflow executes THEN the system SHALL use project-specific limits
4. IF project limit is not set THEN the system SHALL fall back to system default
5. WHEN system admin changes default limits THEN existing projects SHALL keep their custom limits

### Requirement 10: Реализация flow.sub_workflow

**User Story:** As a workflow developer, I want to call sub-workflows, so that I can reuse common logic across multiple workflows.

**Problem:** `flow.sub_workflow` является заглушкой и не работает.

#### Acceptance Criteria

1. WHEN sub_workflow node is executed THEN the system SHALL start execution of referenced workflow
2. WHEN sub_workflow completes THEN the system SHALL return to parent workflow
3. WHEN sub_workflow has inputMapping THEN the system SHALL pass variables to sub-workflow context
4. WHEN sub_workflow has outputMapping THEN the system SHALL copy results back to parent context
5. IF sub_workflow fails THEN the system SHALL propagate error to parent workflow
6. WHEN sub_workflow calls another sub_workflow THEN the system SHALL support up to 5 levels of nesting

---

## ЧАСТЬ 2: ИСТОРИЯ ВЫПОЛНЕНИЯ WORKFLOW

### Requirement 11: Список выполнений Workflow

**User Story:** As a workflow developer, I want to see a list of all workflow executions, so that I can monitor and debug my workflows.

#### Acceptance Criteria

1. WHEN user opens workflow page THEN the system SHALL display "Executions" tab alongside "Editor" tab
2. WHEN Executions tab is active THEN the system SHALL show paginated list of executions (20 per page)
3. WHEN displaying execution item THEN the system SHALL show: status icon, start time, duration, user info, step count
4. WHEN user clicks on execution THEN the system SHALL open execution details view
5. WHEN user applies filters THEN the system SHALL filter by: status, date range, user, search query
6. WHEN new execution starts THEN the system SHALL add it to the top of the list in real-time via SSE

### Requirement 12: Детальный просмотр выполнения с полным payload

**User Story:** As a workflow developer, I want to see detailed information about each execution including full payload, so that I can understand what happened at each step.

#### Acceptance Criteria

1. WHEN execution details are opened THEN the system SHALL display execution metadata (id, status, times, user)
2. WHEN execution details are opened THEN the system SHALL display timeline of all steps
3. WHEN step is displayed in timeline THEN the system SHALL show: node name, type, status, duration, timestamp
4. WHEN user clicks on step THEN the system SHALL open StepInspector panel with full payload
5. WHEN StepInspector is open THEN the system SHALL show: input data, output data, variables before/after, HTTP responses, errors
6. WHEN execution has error THEN the system SHALL highlight error step and show full error message with stack trace

### Requirement 13: Визуализация пути на Canvas (n8n-style)

**User Story:** As a workflow developer, I want to see the execution path highlighted on the workflow canvas like in n8n, so that I can visually understand the flow.

#### Acceptance Criteria

1. WHEN viewing execution details THEN the system SHALL display workflow canvas with execution path
2. WHEN node was executed successfully THEN the system SHALL highlight it with green border/glow
3. WHEN node execution failed THEN the system SHALL highlight it with red border/glow
4. WHEN node is currently executing THEN the system SHALL show pulsing animation
5. WHEN node was skipped (condition false) THEN the system SHALL show it with gray/dimmed style
6. WHEN connection was traversed THEN the system SHALL animate the edge with flow direction
7. WHEN user hovers over executed node THEN the system SHALL show tooltip with step summary and payload preview

### Requirement 14: Real-time выполнение через SSE

**User Story:** As a workflow developer, I want to watch workflow execution in real-time, so that I can debug issues as they happen.

#### Acceptance Criteria

1. WHEN execution is running THEN the system SHALL show "Live" indicator
2. WHEN execution is running THEN the system SHALL update timeline via SSE (Server-Sent Events)
3. WHEN new step completes THEN the system SHALL add it to timeline and update canvas highlighting immediately
4. WHEN execution completes THEN the system SHALL update status and show completion notification
5. WHEN user opens running execution THEN the system SHALL automatically enable live mode
6. WHEN SSE connection drops THEN the system SHALL attempt reconnection with exponential backoff

### Requirement 15: Перезапуск выполнения (Replay)

**User Story:** As a workflow developer, I want to restart execution from a specific node like in n8n, so that I can test fixes without triggering the whole workflow.

#### Acceptance Criteria

1. WHEN viewing execution details THEN the system SHALL show "Restart" button on each completed node
2. WHEN user clicks Restart on a node THEN the system SHALL show options: with/without variable reset
3. WHEN restarting from specific node THEN the system SHALL preserve variables up to that point (unless reset requested)
4. WHEN restart is initiated THEN the system SHALL create new execution linked to original
5. IF original execution was failed THEN restart SHALL be available from any completed node before failure
6. WHEN restart completes THEN the system SHALL show comparison with original execution path

### Requirement 16: Хранение истории (7 дней по умолчанию)

**User Story:** As a project owner, I want execution history to be automatically cleaned up after 7 days, so that storage is managed efficiently.

#### Acceptance Criteria

1. WHEN project is created THEN the system SHALL use default retention period of 7 days
2. WHEN retention period expires THEN the system SHALL automatically delete old executions and logs
3. WHEN deleting execution THEN the system SHALL delete all related logs, variables, and payload data
4. WHEN user manually deletes execution THEN the system SHALL remove it immediately
5. WHEN cleanup job runs THEN the system SHALL log number of deleted executions

### Requirement 17: Логирование полного payload

**User Story:** As a workflow developer, I want full payload logged for each step, so that I can debug complex data transformations.

#### Acceptance Criteria

1. WHEN step executes THEN the system SHALL log: start time, end time, full input data, full output data, variables changed
2. WHEN step has API call THEN the system SHALL log: request URL, method, headers (sanitized), request body, response status, full response body
3. WHEN step has database query THEN the system SHALL log: query (sanitized), parameters, full result set, execution time
4. WHEN step has condition THEN the system SHALL log: expression, all evaluated values, result (true/false)
5. WHEN step has error THEN the system SHALL log: error type, message, full stack trace
6. WHEN payload exceeds 1MB THEN the system SHALL truncate with "[truncated]" marker and store reference to full data

