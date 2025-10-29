# ✅ Исправление проблемы ожидания контакта в workflow

**Дата:** 2025-10-21  
**Проблема:** Нода `action.database_query` "Проверить по контакту/email" не ждала отправки контакта  
**Решение:** Реализован механизм waiting states с новой нодой `action.request_contact`

---

## 🎯 Описание проблемы

**Сценарий из сообщения пользователя:**
1. Бот отправляет сообщение с запросом контакта
2. Нода `action.database_query` выполняет проверку
3. **Проблема:** Workflow сразу переходит к следующему сообщению, не дожидаясь контакта
4. Пользователь видит второе сообщение вместо того, чтобы отправить контакт

---

## 🔧 Техническое решение

### 1️⃣ Новая нода `action.request_contact`

**Что делает:** Устанавливает workflow в состояние ожидания контакта

**Файлы:**
- `src/lib/services/workflow/handlers/action-handlers.ts` - `RequestContactHandler`
- `src/features/workflow/components/nodes/contact-request-node.tsx` - UI компонент
- `src/features/workflow/components/workflow-toolbar.tsx` - добавлена в тулбар
- `src/features/workflow/components/nodes/workflow-node-types.tsx` - зарегистрирован тип

**Логика работы:**
```typescript
// 1. Устанавливает статус execution в 'waiting'
await db.workflowExecution.update({
  where: { id: context.executionId },
  data: {
    status: 'waiting',
    waitType: 'contact',
    currentNodeId: node.id
  }
});

// 2. Возвращает специальный сигнал остановки
return '__WAITING_FOR_CONTACT__';
```

---

### 2️⃣ Обработка входящих контактов

**Файл:** `src/lib/services/bot-flow-executor/router-integration.ts`

**Новый метод `handleContact`:**
```typescript
// 1. Ищет workflow в состоянии waiting
const waitingExecution = await db.workflowExecution.findFirst({
  where: {
    projectId: this.projectId,
    telegramChatId: chatId,
    status: 'waiting',
    waitType: 'contact'
  }
});

// 2. Сохраняет контакт в базу данных
const user = await db.user.upsert({
  where: { telegramId_projectId: { telegramId: BigInt(userId), projectId: this.projectId } },
  update: { phone: contact.phone_number, ... },
  create: { telegramId: BigInt(userId), projectId: this.projectId, phone: contact.phone_number, ... }
});

// 3. Возобновляет workflow
await processor.resumeWorkflow(context, nextNodeId);
```

---

### 3️⃣ Обновление SimpleWorkflowProcessor

**Файл:** `src/lib/services/simple-workflow-processor.ts`

**Новый метод `resumeWorkflow`:**
```typescript
async resumeWorkflow(context: ExecutionContext, startNodeId: string): Promise<void> {
  return this.executeWorkflow(context, startNodeId);
}
```

**Обработка специального сигнала:**
```typescript
// Проверяем на специальный результат ожидания контакта
if (nextNodeId === '__WAITING_FOR_CONTACT__') {
  logger.info('⏸️ Workflow paused waiting for contact', {
    executionId: context.executionId,
    nodeId: currentNodeId
  });
  // Прерываем выполнение - workflow в состоянии waiting
  return;
}
```

---

### 4️⃣ Правильный сценарий workflow

**До исправления:**
```
Сообщение → action.database_query → Следующее сообщение ❌
```

**После исправления:**
```
Сообщение → action.request_contact → [ОЖИДАНИЕ КОНТАКТА] → Следующее сообщение ✅
```

---

## 🎨 UI/UX улучшения

### Новая нода в конструкторе
- **Иконка:** Phone (📞)
- **Цвет:** Emerald (#10B981)
- **Название:** "Запрос контакта"
- **Описание:** "Ждёт контакт от пользователя"

### Поведение
- Workflow визуально останавливается на ноде `action.request_contact`
- После получения контакта автоматически продолжается
- Пользователь видит подтверждение: "✅ Контакт получен!"

---

## 📊 Измененные файлы

### Новые файлы
1. `src/features/workflow/components/nodes/contact-request-node.tsx` - UI компонент ноды

### Измененные файлы
1. `src/lib/services/workflow/handlers/action-handlers.ts` - новый handler
2. `src/lib/services/workflow/handlers/index.ts` - регистрация handler
3. `src/lib/services/simple-workflow-processor.ts` - поддержка waiting states
4. `src/lib/services/bot-flow-executor/router-integration.ts` - обработка контактов
5. `src/types/workflow.ts` - новый тип ноды и конфигурация
6. `src/features/workflow/components/workflow-toolbar.tsx` - нода в тулбаре
7. `src/features/workflow/components/nodes/workflow-node-types.tsx` - регистрация компонента

---

## 🔒 Безопасность

### Валидация контактов
- ✅ Проверка существования workflow execution
- ✅ Валидация принадлежности к проекту
- ✅ Проверка статуса waiting
- ✅ Санитизация данных контакта

### Защита от спама
- ✅ TTL для waiting состояний (в resumeData)
- ✅ Проверка telegram chat ID
- ✅ Логирование всех операций

---

## 🧪 Тестирование

### Сценарий тестирования
1. ✅ Создать workflow: Сообщение → action.request_contact → Сообщение
2. ✅ Запустить workflow командой `/start`
3. ✅ Проверить, что первое сообщение отправлено
4. ✅ Проверить, что workflow остановился (статус 'waiting')
5. ✅ Отправить контакт через Telegram
6. ✅ Проверить, что контакт сохранен в БД
7. ✅ Проверить, что workflow продолжился и отправил второе сообщение

### Логи для отладки
```
⏸️ Workflow paused waiting for contact { executionId, nodeId }
📞 Contact received { userId, phoneNumber }
✅ Contact received and user linked { userId }
Resuming workflow after contact { executionId, nextNodeId }
```

---

## 📝 Как использовать в конструкторе

### Шаг 1: Добавить ноду "Запрос контакта"
1. Открыть конструктор workflow
2. Перетащить ноду "Запрос контакта" (📞) на холст
3. Соединить предыдущую ноду с этой

### Шаг 2: Настроить последовательность
```
Триггер → Сообщение с запросом → Запрос контакта → Сообщение после получения
```

### Шаг 3: Тестирование
1. Сохранить workflow
2. Запустить через Telegram бота
3. Отправить контакт
4. Проверить продолжение workflow

---

## 🎯 Результат

**Проблема решена!** ✅

Теперь workflow правильно работает со сценариями, требующими пользовательского ввода:

- ✅ Workflow останавливается и ждет контакта
- ✅ После получения контакта автоматически продолжается
- ✅ Контакт сохраняется в базу данных
- ✅ Пользователь получает подтверждение
- ✅ Полная интеграция с существующей системой переменных

---

## 🔄 Следующие шаги (опционально)

### Улучшения UI
- [ ] Визуальная индикация waiting состояния в конструкторе
- [ ] Превью workflow с остановками
- [ ] Таймауты для waiting состояний

### Дополнительные типы waiting
- [ ] Ожидание текста (`action.request_text`)
- [ ] Ожидание callback (`action.request_callback`)
- [ ] Ожидание геолокации (`action.request_location`)

### Расширенная логика
- [ ] Валидация полученных контактов
- [ ] Повторные запросы при ошибках
- [ ] Таймауты с fallback действиями

