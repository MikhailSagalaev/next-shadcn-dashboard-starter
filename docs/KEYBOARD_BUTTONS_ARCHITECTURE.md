# 🎯 Архитектура кнопок в конструкторе ботов

**Дата:** 2025-10-14  
**Проект:** SaaS Bonus System  
**Автор:** AI Assistant + User

---

## 📚 Анализ популярных конструкторов

### 1️⃣ **n8n (Workflow Automation)**
```
Send Message Node (with keyboard)
    ↓
Wait for Message Node (слушает ответ)
    ↓
Process Response Node
```

### 2️⃣ **ManyChat / BotHelp**
```
Message Block (with buttons)
    ↓
Button Click Trigger → Next Block
    ↓
Action/Response
```

### 3️⃣ **Botpress**
```
Say Node (with quick replies)
    ↓
Listen Node (with expectations)
    ↓
Condition Node → Route
```

---

## 🔍 Ключевые паттерны

### ✅ Что делают правильно:

1. **Отделение отправки от обработки**
   - Нода "Отправить кнопку" ≠ Нода "Обработать нажатие"
   - Используют **callback_query** для inline кнопок
   - Используют **message** триггер для reply кнопок

2. **Состояния workflow**
   - Workflow **не останавливается** после отправки кнопки
   - Используют **ожидание** (wait for input)
   - Или **отдельные триггеры** на callback/message

3. **Типы кнопок:**
   - **Inline Keyboard** → `callback_query` trigger
   - **Reply Keyboard** → `message` trigger (с проверкой текста)
   - **Request Contact** → `contact` trigger
   - **Request Location** → `location` trigger

---

## 🎯 Наша текущая проблема

### ❌ Что не так:

```
/start → welcome-message (с кнопкой "Поделиться контактом")
  ↓
Workflow ЗАВЕРШАЕТСЯ ❌
  ↓
Пользователь нажимает кнопку
  ↓
Контакт отправляется, но workflow уже завершен!
```

### ✅ Правильный подход:

**Вариант 1: Отдельные Workflows (как в ManyChat)**
```
Workflow #1: Registration Start
/start → welcome-message (с кнопкой)

Workflow #2: Contact Received  
trigger.contact → check-user → create/existing
```

**Вариант 2: Единый Workflow с триггерами (как в n8n)**
```
trigger.command (/start) → welcome-message (с кнопкой)

trigger.contact → check-user → create/existing
  ↑
  └─ Тот же workflow, другая точка входа
```

---

## 🛠️ Решение для нашего проекта

### Архитектура с **множественными триггерами**:

```typescript
// Workflow с несколькими entry points
{
  "nodes": [
    // Триггер 1: Команда /start
    {
      "id": "start-trigger",
      "type": "trigger.command",
      "config": { "command": "/start" }
    },
    
    // Сообщение с кнопкой
    {
      "id": "welcome-message",
      "type": "message.keyboard.reply",
      "config": {
        "text": "Нажмите кнопку:",
        "keyboard": [[
          { "text": "📱 Контакт", "request_contact": true }
        ]]
      }
    },
    
    // Триггер 2: Получение контакта
    {
      "id": "contact-trigger",
      "type": "trigger.contact"
    },
    
    // Обработка контакта
    {
      "id": "check-user",
      "type": "action.database_query",
      "config": { "query": "check_user_by_telegram" }
    }
  ],
  
  "connections": [
    // Путь 1: /start → кнопка
    { "source": "start-trigger", "target": "welcome-message" },
    
    // Путь 2: контакт → проверка
    { "source": "contact-trigger", "target": "check-user" }
  ]
}
```

### Логика выполнения:

1. **При `/start`:**
   - Находим `trigger.command` с `/start`
   - Выполняем `welcome-message`
   - Отправляем кнопку
   - Workflow **завершается**

2. **При получении контакта:**
   - Находим `trigger.contact`
   - Выполняем `check-user`
   - Продолжаем workflow

---

## 🚀 Реализация

### 1. Обновить `SimpleWorkflowProcessor.findTriggerNode()`

**Было:**
```typescript
private findTriggerNode(trigger: string): WorkflowNode | undefined {
  for (const node of Array.from(this.nodesMap.values())) {
    if (node.type === 'trigger.command') {
      const config = node.data?.config?.['trigger.command'];
      if (config?.command === `/${trigger}`) {
        return node;
      }
    }
  }
  return undefined;
}
```

**Стало:**
```typescript
private findTriggerNode(trigger: string, ctx: Context): WorkflowNode | undefined {
  // 1. Проверяем наличие контакта
  if (ctx.message?.contact) {
    return this.findTriggerByType('trigger.contact');
  }
  
  // 2. Проверяем callback query
  if (ctx.callbackQuery) {
    const callbackData = ctx.callbackQuery.data;
    return this.findCallbackTrigger(callbackData);
  }
  
  // 3. Проверяем команду
  if (trigger === 'start') {
    return this.findCommandTrigger('/start');
  }
  
  // 4. Проверяем обычное сообщение
  return this.findMessageTrigger();
}
```

### 2. Добавить методы поиска триггеров

```typescript
private findTriggerByType(type: string): WorkflowNode | undefined {
  for (const node of Array.from(this.nodesMap.values())) {
    if (node.type === type) {
      return node;
    }
  }
  return undefined;
}

private findCommandTrigger(command: string): WorkflowNode | undefined {
  for (const node of Array.from(this.nodesMap.values())) {
    if (node.type === 'trigger.command') {
      const config = node.data?.config?.['trigger.command'];
      if (config?.command === command) {
        return node;
      }
    }
  }
  return undefined;
}

private findCallbackTrigger(callbackData: string): WorkflowNode | undefined {
  for (const node of Array.from(this.nodesMap.values())) {
    if (node.type === 'trigger.callback') {
      const config = node.data?.config?.['trigger.callback'];
      if (config?.callback_data === callbackData) {
        return node;
      }
    }
  }
  return undefined;
}
```

### 3. Обновить контекст

```typescript
// В ExecutionContextManager.createContext()
const telegram = {
  chatId: String(ctx.chat?.id || ctx.from?.id || ''),
  userId: String(ctx.from?.id || ''),
  username: ctx.from?.username,
  firstName: ctx.from?.first_name,
  botToken: botToken,
  message: {
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    contact: ctx.message?.contact,  // ← Добавить
    location: ctx.message?.location // ← Добавить
  }
};
```

---

## 📊 Сравнение подходов

| Подход | Преимущества | Недостатки |
|--------|-------------|------------|
| **Отдельные Workflows** | Просто понять, легко дебажить | Дублирование логики |
| **Множественные триггеры** | Единая логика, компактно | Сложнее понять flow |
| **Wait for Input** | Как в n8n, гибко | Требует состояния сессии |

**Рекомендация:** Использовать **множественные триггеры** (как в Botpress/ManyChat).

---

## ✅ Чек-лист реализации

- [ ] Обновить `findTriggerNode()` для поддержки всех типов триггеров
- [ ] Добавить `contact` и `location` в `telegram` контекст
- [ ] Обновить `ContactHandler` для обработки входящих контактов
- [ ] Создать тесты для каждого типа триггера
- [ ] Обновить документацию и примеры
- [ ] Обновить UI конструктора для визуализации множественных точек входа

---

## 📖 Примеры использования

### Пример 1: Регистрация с контактом

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger.command",
      "config": { "command": "/start" }
    },
    {
      "id": "ask-contact",
      "type": "message.keyboard.reply",
      "config": {
        "text": "Поделитесь контактом:",
        "keyboard": [[{ "text": "📱 Контакт", "request_contact": true }]]
      }
    },
    {
      "id": "contact-received",
      "type": "trigger.contact"
    },
    {
      "id": "save-user",
      "type": "action.database_query",
      "config": { "query": "create_user" }
    },
    {
      "id": "confirm",
      "type": "message",
      "config": { "text": "✅ Регистрация завершена!" }
    }
  ],
  "connections": [
    { "source": "start", "target": "ask-contact" },
    { "source": "contact-received", "target": "save-user" },
    { "source": "save-user", "target": "confirm" }
  ]
}
```

### Пример 2: Меню с inline кнопками

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger.command",
      "config": { "command": "/start" }
    },
    {
      "id": "menu",
      "type": "message.keyboard.inline",
      "config": {
        "text": "Выберите:",
        "buttons": [[
          { "text": "💰 Баланс", "callback_data": "balance" },
          { "text": "📜 История", "callback_data": "history" }
        ]]
      }
    },
    {
      "id": "balance-callback",
      "type": "trigger.callback",
      "config": { "callback_data": "balance" }
    },
    {
      "id": "show-balance",
      "type": "message",
      "config": { "text": "Ваш баланс: {{balance}}" }
    }
  ],
  "connections": [
    { "source": "start", "target": "menu" },
    { "source": "balance-callback", "target": "show-balance" }
  ]
}
```

---

**Статус:** 📝 В разработке  
**Приоритет:** 🔴 P0 (Критичный для функциональности кнопок)

