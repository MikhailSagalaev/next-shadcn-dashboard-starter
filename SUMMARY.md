# ✅ Упрощение обработки контакта + кнопка автовыравнивания

## 🎯 Что сделано

### 1. Упрощена архитектура обработки контакта
**Проблема**: При использовании `flow.wait_contact` создавался новый workflow execution, что приводило к дублированию сообщений и потере контекста.

**Решение**: 
- Убрана нода `flow.wait_contact` и вся логика waiting state
- Контакт теперь обрабатывается как обычное сообщение через `context.telegram.contact`
- Workflow выполняется линейно без разрывов контекста

### 2. Добавлена кнопка автоматического выравнивания нод
**Что добавлено**:
- Кнопка "Выравнять" в правом верхнем углу конструктора
- Используется библиотека `dagre` для автоматической раскладки графа
- Алгоритм: слева направо (LR), с отступами между нодами
- Автоматическое позиционирование viewport после выравнивания

## 📝 Удаленные файлы и код

### Удаленные файлы:
- `src/features/workflow/components/nodes/wait-contact-node.tsx`
- `src/lib/services/workflow/handlers/contact-handler.ts`

### Удаленные интерфейсы и типы:
```typescript
// Из src/types/workflow.ts
interface WaitContactFlowConfig { ... }
interface WaitResult { ... }
interface WaitingState { ... }

// Из WorkflowNodeType
'flow.wait_contact'
```

### Удаленные методы:
```typescript
// Из ExecutionContextManager
findWaitingExecution()
resumeContext()
markWaiting()
```

## 🔄 Изменённые файлы

### Frontend:
1. `src/features/workflow/components/workflow-constructor.tsx`
   - Добавлена функция `onAutoLayout()` с dagre
   - Добавлена кнопка выравнивания
   - Удалены case для `flow.wait_contact`

2. `src/features/workflow/components/workflow-properties.tsx`
   - Удален UI для настройки `flow.wait_contact`

3. `src/features/workflow/components/workflow-toolbar.tsx`
   - Удалена иконка и item для `flow.wait_contact`

4. `src/features/workflow/components/nodes/workflow-node-types.tsx`
   - Удален импорт и маппинг `WaitContactNode`

### Backend:
5. `src/lib/services/simple-workflow-processor.ts`
   - Убрана логика поиска и возобновления waiting executions
   - Упрощен метод `executeWorkflow` - теперь возвращает `void` вместо `boolean`
   - Удалён метод `isWaitResult()`

6. `src/lib/services/workflow/execution-context-manager.ts`
   - Полностью перезаписан без методов waiting
   - Оставлены только: `createContext`, `updateContextForStep`, `completeExecution`, `log`

7. `src/lib/services/workflow/handlers/flow-handlers.ts`
   - Удален класс `WaitContactFlowHandler`

8. `src/lib/services/workflow/handlers/index.ts`
   - Убрана регистрация `WaitContactFlowHandler`

9. `src/lib/services/workflow/node-handlers-registry.ts`
   - Убран `flow.wait_contact` из списка поддерживаемых типов

### Типы:
10. `src/types/workflow.ts`
    - Удалены: `WaitContactFlowConfig`, `WaitResult`, `WaitingState`
    - Упрощен `HandlerResult` до `string | null`
    - Удалено поле `waiting?` из `ExecutionContext`

### Шаблон:
11. `Система лояльности (шаблон) (2).json`
    - Удалена нода `wait-contact`
    - Обновлены connections: `welcome-message` → `check-user` напрямую
    - Изменены переменные: `{{contact.phoneNumber}}` → `{{telegram.contact.phoneNumber}}`

## 📦 Новые зависимости

```json
{
  "dependencies": {
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52"
  }
}
```

## 🧪 Как это работает теперь

### Старая схема (с проблемами):
```
1. /start → создаётся execution #1
2. Отправка сообщения с request_contact кнопкой
3. flow.wait_contact → execution #1 переходит в статус "waiting"
4. Пользователь отправляет контакт
5. Создаётся НОВЫЙ execution #2 ← ПРОБЛЕМА!
6. Дублирование сообщений
```

### Новая схема (упрощённая):
```
1. /start → создаётся execution
2. Отправка сообщения с request_contact кнопкой
3. Следующая нода сразу обрабатывает telegram.contact
4. Если контакт уже есть - используется
5. Если контакта нет - просто null
6. Логика обработки на стороне условий
```

## 🎨 Автовыравнивание

```typescript
const onAutoLayout = () => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ 
    rankdir: 'LR',      // Слева направо
    nodesep: 100,       // Отступ между нодами
    ranksep: 150        // Отступ между уровнями
  });

  // Добавляем ноды и edges в граф
  // Запускаем layout
  dagre.layout(dagreGraph);

  // Применяем новые позиции к нодам
  // Центрируем viewport
};
```

## 📊 Результат

- ✅ Нет дублирования сообщений
- ✅ Контекст workflow сохраняется
- ✅ Простая и понятная логика
- ✅ Красивое выравнивание нод одним кликом
- ✅ Минус ~500 строк сложного кода

## 🔍 Changelog

Обновлён `docs/changelog.md`:
- Добавлена секция с описанием упрощения
- Указаны все удалённые компоненты
- Описаны исправленные баги

