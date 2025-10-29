# 🔧 План исправлений Workflow Конструктора

**Дата:** 2025-10-21  
**Приоритет:** Высокий  
**Статус:** Готово к реализации

---

## 🎯 Цель

Привести конструктор workflow в полностью рабочее состояние с исправлением всех TypeScript ошибок и добавлением недостающего функционала.

---

## 📋 Задачи

### ✅ Фаза 1: Исправление TypeScript errors (КРИТИЧНО)

#### 1.1 Обновить типы в `src/types/workflow.ts`

**Файл:** `src/types/workflow.ts`  
**Строка:** 13-26

**Изменение:**
```typescript
export type WorkflowNodeType =
  // Триггеры
  | 'trigger.command' | 'trigger.message' | 'trigger.callback' 
  | 'trigger.webhook' | 'trigger.email'
  // Сообщения
  | 'message'
  | 'message.keyboard.inline' | 'message.keyboard.reply'  // ДОБАВИТЬ
  | 'message.photo' | 'message.video' | 'message.document' // ДОБАВИТЬ
  | 'message.edit' | 'message.delete'                      // ДОБАВИТЬ
  // Действия
  | 'action.api_request' | 'action.database_query' 
  | 'action.set_variable' | 'action.get_variable'
  | 'action.send_notification' | 'action.check_user_linked' 
  | 'action.find_user_by_contact' | 'action.link_telegram_account' 
  | 'action.get_user_balance'
  // Условия
  | 'condition'
  | 'flow.switch'  // ДОБАВИТЬ
  // Поток управления
  | 'flow.delay' | 'flow.loop' | 'flow.sub_workflow' 
  | 'flow.jump' | 'flow.end'
  // Интеграции
  | 'integration.webhook' | 'integration.analytics';
```

**Причина:** Handlers проверяют эти типы, но они не определены в union type.

---

#### 1.2 Исправить ошибки в тестовых файлах

**Файлы для исправления:**
- `scripts/check-workflow-nodes.ts`
- `scripts/debug-bot-status.ts`
- `scripts/restart-bots.ts`
- `scripts/test-workflow.ts`
- `test-workflow-components.ts`
- `test-workflow-sync.ts`

**Действия:**
1. Удалить обращения к приватным полям
2. Использовать публичные методы API
3. Добавить недостающие поля в mock объекты
4. Исправить типы параметров

---

#### 1.3 Исправить ошибку в `database-query-editor.tsx`

**Файл:** `src/features/bot-constructor/components/editors/database-query-editor.tsx`  
**Строка:** 215

**Текущий код:**
```tsx
Используйте переменные: {`{{telegram.userId}}`, `{{user.id}}`, `{{telegram.contact.phone}}`}
```

**Исправление:**
```tsx
Используйте переменные: {`{{telegram.userId}}, {{user.id}}, {{telegram.contact.phone}}`}
```

**Причина:** JSX не позволяет использовать запятые между template literals.

---

#### 1.4 Исправить ошибку в `variable-selector.tsx`

**Файл:** `src/components/ui/variable-selector.tsx`  
**Строка:** 115

**Проблема:** Пустой объект не соответствует типу `VARIABLE_CATEGORIES`.

**Решение:** Инициализировать с правильной структурой или изменить тип.

---

#### 1.5 Добавить флаг `--downlevelIteration` в tsconfig.json

**Файл:** `tsconfig.json`

**Добавить:**
```json
{
  "compilerOptions": {
    "downlevelIteration": true,
    // ... остальные опции
  }
}
```

**Причина:** Решает ошибки итерации по Map/Set в старых версиях target.

---

### 🔨 Фаза 2: Реализация недостающих handlers (ВЫСОКИЙ ПРИОРИТЕТ)

#### 2.1 API Request Handler

**Файл:** `src/lib/services/workflow/handlers/action-handlers.ts`

**Добавить:**
```typescript
export class ApiRequestHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.api_request';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult> {
    const config = node.data.config?.['action.api_request'];
    if (!config) return null;

    // Реализация HTTP запроса
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: AbortSignal.timeout(config.timeout || 30000)
    });

    const data = await response.json();
    
    // Response mapping в переменные
    if (config.responseMapping) {
      for (const [key, path] of Object.entries(config.responseMapping)) {
        const value = getValueByPath(data, path);
        await context.variables.set(key, value, 'session');
      }
    }

    return null;
  }
}
```

---

#### 2.2 Send Notification Handler

**Файл:** `src/lib/services/workflow/handlers/action-handlers.ts`

**Добавить:**
```typescript
export class SendNotificationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.send_notification';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult> {
    const config = node.data.config?.['action.send_notification'];
    if (!config) return null;

    // Отправка уведомления через соответствующий канал
    switch (config.notificationType) {
      case 'telegram':
        // Telegram notification
        break;
      case 'email':
        // Email notification
        break;
      case 'webhook':
        // Webhook notification
        break;
    }

    return null;
  }
}
```

---

#### 2.3 User Linking Handlers

**Файлы:** 
- `CheckUserLinkedHandler`
- `FindUserByContactHandler`
- `LinkTelegramAccountHandler`
- `GetUserBalanceHandler`

**Добавить в:** `src/lib/services/workflow/handlers/action-handlers.ts`

---

#### 2.4 Webhook Trigger Handler

**Файл:** `src/lib/services/workflow/handlers/trigger-handlers.ts`

**Добавить:**
```typescript
export class WebhookTriggerHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'trigger.webhook';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult> {
    // Webhook triggers обрабатываются внешним API endpoint
    // Этот handler просто передает управление дальше
    return null;
  }
}
```

---

#### 2.5 Integration Handlers

**Файл:** Создать `src/lib/services/workflow/handlers/integration-handlers.ts`

**Содержимое:**
```typescript
export class WebhookIntegrationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'integration.webhook';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult> {
    // Webhook integration logic
    return null;
  }
}

export class AnalyticsIntegrationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'integration.analytics';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<HandlerResult> {
    // Analytics tracking logic
    return null;
  }
}
```

---

#### 2.6 Обновить регистрацию handlers

**Файл:** `src/lib/services/workflow/handlers/index.ts`

**Добавить импорты и регистрацию всех новых handlers:**
```typescript
import { 
  ApiRequestHandler,
  SendNotificationHandler,
  CheckUserLinkedHandler,
  FindUserByContactHandler,
  LinkTelegramAccountHandler,
  GetUserBalanceHandler
} from './action-handlers';

import { WebhookTriggerHandler } from './trigger-handlers';

import { 
  WebhookIntegrationHandler,
  AnalyticsIntegrationHandler 
} from './integration-handlers';

// В функции initializeNodeHandlers():
export function initializeNodeHandlers(): void {
  // ... существующие handlers

  // Новые action handlers
  nodeHandlersRegistry.register(new ApiRequestHandler());
  nodeHandlersRegistry.register(new SendNotificationHandler());
  nodeHandlersRegistry.register(new CheckUserLinkedHandler());
  nodeHandlersRegistry.register(new FindUserByContactHandler());
  nodeHandlersRegistry.register(new LinkTelegramAccountHandler());
  nodeHandlersRegistry.register(new GetUserBalanceHandler());

  // Новый trigger handler
  nodeHandlersRegistry.register(new WebhookTriggerHandler());

  // Integration handlers
  nodeHandlersRegistry.register(new WebhookIntegrationHandler());
  nodeHandlersRegistry.register(new AnalyticsIntegrationHandler());

  console.log('✅ All node handlers initialized and registered');
}
```

---

### 🎨 Фаза 3: Улучшение UI (СРЕДНИЙ ПРИОРИТЕТ)

#### 3.1 Расширить тулбар с категориями

**Файл:** `src/features/workflow/components/workflow-toolbar.tsx`

**Изменения:**
1. Группировать ноды по категориям
2. Добавить раскрывающиеся секции
3. Добавить поиск по нодам
4. Добавить иконки для всех типов нод

**Структура:**
```
📁 Триггеры
  - Команда
  - Сообщение
  - Callback
  - Webhook
  - Email

📁 Сообщения
  - Текст
  - С клавиатурой
  - Фото
  - Видео
  - Документ

📁 Действия
  - API запрос
  - База данных
  - Переменные
  - Уведомления
  - Пользователи

📁 Логика
  - Условие
  - Switch
  - Цикл
  - Прыжок

📁 Поток
  - Задержка
  - Вложенный workflow
  - Завершение
```

---

#### 3.2 Добавить валидацию connections

**Файл:** `src/features/workflow/hooks/use-workflow.ts`

**Добавить функцию:**
```typescript
function validateWorkflow(nodes: WorkflowNode[], connections: WorkflowConnection[]): ValidationResult {
  const errors: string[] = [];

  // 1. Проверка триггера
  const triggers = nodes.filter(n => n.type.startsWith('trigger.'));
  if (triggers.length === 0) {
    errors.push('Workflow должен содержать хотя бы один триггер');
  }

  // 2. Проверка orphan nodes
  const connectedNodeIds = new Set([
    ...connections.map(c => c.source),
    ...connections.map(c => c.target)
  ]);
  
  const orphanNodes = nodes.filter(n => 
    !connectedNodeIds.has(n.id) && 
    !n.type.startsWith('trigger.')
  );
  
  if (orphanNodes.length > 0) {
    errors.push(`Найдены несвязанные ноды: ${orphanNodes.map(n => n.data.label).join(', ')}`);
  }

  // 3. Проверка циклов
  const hasCycles = detectCycles(nodes, connections);
  if (hasCycles) {
    errors.push('Обнаружены циклические зависимости (бесконечный цикл)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

#### 3.3 Добавить предпросмотр выполнения

**Файл:** Создать `src/features/workflow/components/workflow-preview.tsx`

**Функционал:**
- Пошаговое выполнение workflow
- Просмотр значений переменных на каждом шаге
- Подсветка активной ноды
- Просмотр логов выполнения

---

### 📚 Фаза 4: Документация (НИЗКИЙ ПРИОРИТЕТ)

#### 4.1 Создать руководство для каждого типа ноды

**Файл:** `docs/nodes-reference/`

Создать отдельные файлы для каждого типа:
- `trigger-command.md`
- `message.md`
- `condition.md`
- `action-database.md`
- и т.д.

---

#### 4.2 Добавить примеры workflow

**Файл:** `docs/workflow-examples/`

Создать готовые примеры:
- `loyalty-program.json` - программа лояльности
- `user-onboarding.json` - онбординг пользователей
- `feedback-collection.json` - сбор обратной связи
- `support-bot.json` - бот поддержки

---

### ✅ Фаза 5: Тестирование

#### 5.1 Unit тесты для handlers

**Файл:** `__tests__/workflow/handlers/`

Создать тесты для каждого handler:
- `message-handler.test.ts`
- `condition-handler.test.ts`
- `database-query-handler.test.ts`
- и т.д.

---

#### 5.2 Integration тесты

**Файл:** `__tests__/workflow/integration/`

Тесты для полного flow:
- `simple-workflow.test.ts`
- `conditional-workflow.test.ts`
- `loop-workflow.test.ts`
- `error-handling.test.ts`

---

## 📊 Приоритеты выполнения

| Фаза | Приоритет | Срок | Статус |
|------|-----------|------|--------|
| Фаза 1: TypeScript fixes | 🔴 КРИТИЧНО | 1 день | ⏳ Ожидает |
| Фаза 2: Недостающие handlers | 🟠 ВЫСОКИЙ | 2-3 дня | ⏳ Ожидает |
| Фаза 3: UI улучшения | 🟡 СРЕДНИЙ | 3-5 дней | ⏳ Ожидает |
| Фаза 4: Документация | 🟢 НИЗКИЙ | 2-3 дня | ⏳ Ожидает |
| Фаза 5: Тестирование | 🟠 ВЫСОКИЙ | 3-4 дня | ⏳ Ожидает |

---

## 🎯 Критерии готовности

### Минимальный MVP (для продакшена)
- ✅ Исправлены все TypeScript ошибки
- ✅ Реализованы основные handlers (message, condition, database, variables)
- ✅ Работает создание, редактирование и выполнение workflow
- ✅ Базовая валидация

### Полная версия
- ✅ Все handlers реализованы
- ✅ Расширенный UI с категориями
- ✅ Валидация connections и циклов
- ✅ Предпросмотр выполнения
- ✅ Документация
- ✅ Unit и integration тесты
- ✅ Примеры workflow

---

## 📝 Заключение

План охватывает все необходимые исправления и улучшения для приведения workflow конструктора в полностью рабочее состояние.

**Рекомендуемый порядок:**
1. Начать с Фазы 1 (TypeScript fixes) - блокирует push
2. Параллельно работать над Фазой 2 (handlers) - критичный функционал
3. После завершения 1-2, добавить тесты (Фаза 5)
4. Улучшить UI (Фаза 3)
5. Завершить документацией (Фаза 4)

**Оценка времени:** 10-15 рабочих дней для полной реализации всех фаз.

