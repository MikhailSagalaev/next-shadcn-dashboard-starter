# 🎯 План доработки простого конструктора ботов

## 🎨 Концепция
**Простой визуальный конструктор Telegram ботов** для создания интерактивных сценариев без кода.

## ✅ Что уже есть (хорошо)
- ✅ Triggers: command, message, callback, contact
- ✅ Message: текстовые сообщения с переменными
- ✅ Condition: отличная логика с AST
- ✅ Flow control: delay, end, jump
- ✅ Variables: set/get переменные

## 🔴 Критические фиксы (P0) - Начинаем отсюда!

### 1. SQL Injection (КРИТИЧНО!)
**Файл**: `src/lib/services/workflow/handlers/action-handlers.ts`
**Проблема**: Использует `$queryRaw` - SQL injection риск
**Решение**: Создать whitelist безопасных запросов

### 2. Защита от циклов
**Файл**: `src/lib/services/workflow/simple-workflow-processor.ts`
**Проблема**: Можно создать бесконечный цикл
**Решение**: Max iterations counter

### 3. Blocking delays
**Файл**: `src/lib/services/workflow/handlers/flow-handlers.ts`
**Проблема**: Блокирует event loop
**Решение**: Убрать или сделать async через job queue

### 4. Rate Limiting
**Проблема**: Нет защиты от спама
**Решение**: Rate limiter middleware

## 🟡 Недостающие ноды для простого бота (P1)

### Message Nodes (критично для UX)
- [ ] `message.photo` - отправка фото
- [ ] `message.video` - отправка видео
- [ ] `message.document` - отправка файлов
- [ ] `message.keyboard.inline` - inline кнопки
- [ ] `message.keyboard.reply` - reply клавиатура
- [ ] `message.edit` - редактирование сообщений
- [ ] `message.delete` - удаление сообщений

### Action Nodes (для работы с данными)
- [ ] `action.add_to_list` - добавить в список
- [ ] `action.remove_from_list` - удалить из списка
- [ ] `action.increment` - увеличить счетчик
- [ ] `action.decrement` - уменьшить счетчик
- [ ] `action.calculate` - простые вычисления

### Flow Control (для сложных сценариев)
- [ ] `flow.loop` - реализовать циклы (сейчас заглушка)
- [ ] `flow.switch` - множественный выбор
- [ ] `flow.random` - случайный выбор ветки
- [ ] `flow.wait_for_input` - ожидание ввода

### Trigger Nodes (для интерактивности)
- [ ] `trigger.photo` - получение фото
- [ ] `trigger.document` - получение файлов
- [ ] `trigger.location` - получение геолокации

## 🎯 Приоритетный план (2-3 недели)

### Sprint 1 (Week 1): Критические фиксы
**Цель**: Безопасность и стабильность

#### День 1-2: SQL Injection Fix
- [ ] Создать `src/lib/services/workflow/query-executor.ts`
- [ ] Whitelist безопасных запросов
- [ ] Заменить `$queryRaw` на безопасные методы

#### День 3: Защита от циклов
- [ ] Добавить `maxIterations = 200`
- [ ] Добавить `visitedNodes: Set<string>`
- [ ] Cycle detection

#### День 4: Rate Limiting
- [ ] Redis-based rate limiter
- [ ] Per-user limits
- [ ] Middleware integration

#### День 5: Тестирование
- [ ] Unit тесты для фиксов
- [ ] Integration тесты
- [ ] Security audit

---

### Sprint 2 (Week 2): Кнопки и клавиатуры
**Цель**: Интерактивные элементы

#### День 1-2: Inline кнопки
- [ ] `message.keyboard.inline` handler
- [ ] Поддержка callback_data
- [ ] Поддержка URL кнопок
- [ ] Layout (rows/columns)

#### День 3: Reply клавиатуры
- [ ] `message.keyboard.reply` handler
- [ ] Resize keyboard
- [ ] One-time keyboard
- [ ] Remove keyboard

#### День 4-5: Медиа сообщения
- [ ] `message.photo` - отправка фото
- [ ] `message.video` - отправка видео
- [ ] Caption support
- [ ] File upload

---

### Sprint 3 (Week 3): Flow Control
**Цель**: Сложные сценарии

#### День 1-2: Loop реализация
- [ ] For loop (count)
- [ ] Foreach loop (array)
- [ ] Max iterations protection
- [ ] Break/continue support

#### День 3: Switch/Case
- [ ] `flow.switch` handler
- [ ] Multiple branches
- [ ] Default case
- [ ] Value matching

#### День 4-5: Дополнительные ноды
- [ ] `flow.random` - случайный выбор
- [ ] `flow.wait_for_input` - ожидание
- [ ] `action.calculate` - вычисления
- [ ] Тестирование

---

## 📋 Детальные задачи

### Задача 1: Fix SQL Injection (P0)

**Файлы**:
- `src/lib/services/workflow/query-executor.ts` (новый)
- `src/lib/services/workflow/handlers/action-handlers.ts` (изменить)

**Реализация**:
```typescript
// query-executor.ts
export const SAFE_QUERIES = {
  check_user_by_telegram: async (db, params) => {
    return await db.user.findFirst({
      where: {
        telegramId: params.telegramId,
        projectId: params.projectId
      }
    });
  },
  create_user: async (db, params) => {
    return await db.user.create({
      data: {
        telegramId: params.telegramId,
        projectId: params.projectId,
        phone: params.phone,
        email: params.email
      }
    });
  },
  add_bonus: async (db, params) => {
    return await db.bonus.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        type: params.type
      }
    });
  }
};
```

---

### Задача 2: Inline Keyboard (P1)

**Файл**: `src/lib/services/workflow/handlers/keyboard-handler.ts` (новый)

**Конфигурация**:
```typescript
{
  type: 'message.keyboard.inline',
  config: {
    'message.keyboard.inline': {
      text: 'Выберите действие:',
      buttons: [
        [
          { text: 'Кнопка 1', callback_data: 'action_1' },
          { text: 'Кнопка 2', callback_data: 'action_2' }
        ],
        [
          { text: 'Ссылка', url: 'https://example.com' }
        ]
      ]
    }
  }
}
```

---

### Задача 3: Loop Implementation (P1)

**Файл**: `src/lib/services/workflow/handlers/flow-handlers.ts` (обновить)

**Конфигурация**:
```typescript
{
  type: 'flow.loop',
  config: {
    'flow.loop': {
      type: 'count', // 'count' | 'foreach' | 'while'
      count: 5, // для count
      array: 'items', // для foreach
      condition: 'counter < 10', // для while
      maxIterations: 100 // защита
    }
  }
}
```

---

## 🎯 Итоговый результат

### После Sprint 1 (1 неделя)
- ✅ Безопасная система
- ✅ Защита от циклов
- ✅ Rate limiting
- **Оценка**: 6/10 🟡

### После Sprint 2 (2 недели)
- ✅ Inline кнопки
- ✅ Reply клавиатуры
- ✅ Медиа сообщения
- **Оценка**: 7.5/10 🟢

### После Sprint 3 (3 недели)
- ✅ Loops
- ✅ Switch/Case
- ✅ Random flow
- **Оценка**: 8.5/10 ✅

---

## 📊 Финальный набор нод

### Triggers (7 нод)
1. ✅ trigger.command
2. ✅ trigger.message
3. ✅ trigger.callback
4. ✅ trigger.contact
5. ⭕ trigger.photo
6. ⭕ trigger.document
7. ⭕ trigger.location

### Messages (8 нод)
1. ✅ message (text)
2. ⭕ message.photo
3. ⭕ message.video
4. ⭕ message.document
5. ⭕ message.keyboard.inline
6. ⭕ message.keyboard.reply
7. ⭕ message.edit
8. ⭕ message.delete

### Actions (8 нод)
1. ✅ action.set_variable
2. ✅ action.get_variable
3. ✅ action.database_query (fix!)
4. ⭕ action.calculate
5. ⭕ action.add_to_list
6. ⭕ action.remove_from_list
7. ⭕ action.increment
8. ⭕ action.decrement

### Conditions (2 ноды)
1. ✅ condition
2. ⭕ condition.switch

### Flow Control (8 нод)
1. ✅ flow.delay (fix!)
2. ✅ flow.end
3. ✅ flow.jump
4. ⭕ flow.loop (implement!)
5. ⭕ flow.switch
6. ⭕ flow.random
7. ⭕ flow.wait_for_input
8. ⭕ flow.parallel

**Итого**: 33 ноды (vs текущие 14)

---

## ✅ Критерии готовности

### Безопасность
- ✅ Нет SQL injection
- ✅ Защита от циклов
- ✅ Rate limiting
- ✅ Input validation

### Функциональность
- ✅ Все базовые типы сообщений
- ✅ Inline и reply клавиатуры
- ✅ Медиа (фото, видео, файлы)
- ✅ Циклы и ветвления
- ✅ Переменные и вычисления

### UX
- ✅ Интуитивные ноды
- ✅ Понятные названия
- ✅ Хорошие примеры
- ✅ Документация

---

**Статус**: Ready to implement  
**Приоритет**: P0 фиксы → P1 кнопки → P1 flow control  
**Время**: 2-3 недели  
**Результат**: Полноценный простой конструктор ботов

