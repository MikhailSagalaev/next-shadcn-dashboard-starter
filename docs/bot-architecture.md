# Архитектура управления Telegram ботами

## Обзор

Система управления ботами построена на принципе **разделения ответственности**:
- **Настройки бота** - только подключение и запуск/остановка
- **Конструктор Workflow** - вся логика поведения бота

## Почему так?

### Проблема старой архитектуры

Раньше были **два конфликтующих места** для настройки бота:

1. **Страница настроек** (`/dashboard/projects/[id]/bot`)
   - Табы "Сообщения" и "Функционал"
   - Настройки приветственных сообщений
   - Кнопки и команды
   - Включение/отключение функций

2. **Конструктор Workflow** (`/dashboard/projects/[id]/workflow`)
   - Визуальное создание сценариев
   - Узлы для сообщений, действий, условий
   - Полный контроль над логикой

**Конфликты:**
- Приветственное сообщение из настроек vs сообщение из workflow
- Кнопки из настроек vs кнопки из workflow узла
- Команды из настроек vs обработчики в workflow
- Непонятно, что приоритетнее

### Новая архитектура

```
┌─────────────────────────────────────────────────────┐
│         Настройки бота                              │
│  (/dashboard/projects/[id]/bot)                     │
│                                                      │
│  ✅ Токен бота                                       │
│  ✅ Статус (Запустить/Остановить)                    │
│  ✅ Ссылка на конструктор workflow                   │
│                                                      │
│  ❌ Никаких сообщений                                │
│  ❌ Никаких кнопок                                   │
│  ❌ Никаких команд                                   │
└─────────────────────────────────────────────────────┘
                      │
                      │ Бот подключен
                      ▼
┌─────────────────────────────────────────────────────┐
│      Конструктор Workflow                           │
│  (/dashboard/projects/[id]/workflow)                │
│                                                      │
│  ✅ ВСЯ логика бота                                  │
│  ✅ Сообщения (узлы Message)                         │
│  ✅ Кнопки (узлы Button)                             │
│  ✅ Команды (узлы Command)                           │
│  ✅ Условия (узлы Condition)                         │
│  ✅ Действия (узлы Action)                           │
│  ✅ Интеграции (узлы API)                            │
└─────────────────────────────────────────────────────┘
```

## Страница настроек бота

### Карточка 1: Подключение бота
```typescript
{
  botToken: string;      // Токен от @BotFather
  botUsername: string;   // Имя пользователя бота
}
```

**Функции:**
- Редактирование токена
- Сохранение токена в БД
- Проверка валидности токена

### Карточка 2: Управление ботом
```typescript
{
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  controls: {
    start: () => void;   // Запустить бота
    stop: () => void;    // Остановить бота
  }
}
```

**Функции:**
- Динамическая кнопка: "Запустить" или "Остановить"
- Отображение текущего статуса
- Автообновление статуса каждые 10 секунд

### Карточка 3: Конструктор Workflow
```typescript
{
  description: string;   // Пояснение про workflow
  action: () => void;    // Переход в конструктор
}
```

**Функции:**
- Информация о том, что вся логика в workflow
- Большая кнопка "Открыть конструктор Workflow"

## Конструктор Workflow

### Узлы для настройки бота

#### 1. Message Node (Сообщение)
```typescript
{
  type: 'message';
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  buttons?: Button[];
  image?: string;
}
```

Заменяет старые настройки:
- ❌ `welcomeMessage` → ✅ Message node
- ❌ `helpMessage` → ✅ Message node
- ❌ `balanceMessage` → ✅ Message node

#### 2. Command Node (Команда)
```typescript
{
  type: 'command';
  command: string;      // /start, /help, /balance
  description: string;
  action: WorkflowNode;
}
```

Заменяет старые настройки:
- ❌ Функционал "Показать баланс" → ✅ Command node
- ❌ Функционал "Показать реферальную программу" → ✅ Command node

#### 3. Button Node (Кнопка)
```typescript
{
  type: 'button';
  text: string;
  action: 'url' | 'callback';
  value: string;
}
```

Заменяет старые настройки:
- ❌ `welcomeButtons` → ✅ Button nodes в Message node
- ❌ `helpButtons` → ✅ Button nodes в Message node

## API Endpoints

### Настройки бота
```
POST   /api/projects/[id]/bot          # Сохранить токен
GET    /api/projects/[id]/bot/status   # Статус бота
POST   /api/projects/[id]/bot/setup    # Запустить бота
POST   /api/projects/[id]/bot/restart  # Остановить бота (stop: true)
```

### Workflow
```
GET    /api/projects/[id]/workflows               # Список workflows
POST   /api/projects/[id]/workflows               # Создать workflow
GET    /api/projects/[id]/workflows/[workflowId]  # Получить workflow
PUT    /api/projects/[id]/workflows/[workflowId]  # Обновить workflow
DELETE /api/projects/[id]/workflows/[workflowId]  # Удалить workflow
```

## Преимущества новой архитектуры

### 1. Нет конфликтов
- Один источник истины - workflow
- Настройки бота не влияют на поведение
- Понятная иерархия

### 2. Гибкость
- Любая логика через workflow
- Условия, циклы, переменные
- Визуальная разработка

### 3. Простота
- Страница настроек минималистична
- Все сложное - в конструкторе
- Новичкам проще разобраться

### 4. Масштабируемость
- Добавление новых типов узлов
- Шаблоны workflow
- Переиспользование workflow

## Миграция со старой архитектуры

### Шаг 1: Сохранить существующие настройки
Если у проекта были настройки в старом формате, их нужно преобразовать:

```typescript
// Было
{
  welcomeMessage: "Привет!",
  welcomeButtons: [{ text: "Помощь", callback_data: "help" }]
}

// Стало (workflow)
{
  nodes: [
    {
      type: 'trigger',
      event: 'start'
    },
    {
      type: 'message',
      text: "Привет!",
      buttons: [{ text: "Помощь", action: "callback", value: "help" }]
    }
  ]
}
```

### Шаг 2: Удалить устаревшие API
- ❌ `/api/projects/[id]/bot/messages`
- ❌ `/api/projects/[id]/bot/features`

### Шаг 3: Обновить документацию
- Обновить README
- Создать примеры workflow
- Видеоинструкции

## Примеры использования

### Простой бот-приветствие
```typescript
{
  name: "Бот-приветствие",
  nodes: [
    {
      type: 'trigger',
      event: 'start',
      next: 'message-1'
    },
    {
      id: 'message-1',
      type: 'message',
      text: "👋 Привет! Я помогу тебе управлять бонусами.",
      buttons: [
        { text: "💰 Мой баланс", action: "callback", value: "balance" },
        { text: "📊 История", action: "callback", value: "history" }
      ]
    }
  ]
}
```

### Бот с условиями
```typescript
{
  name: "Бот с проверкой баланса",
  nodes: [
    {
      type: 'trigger',
      event: 'command',
      command: '/balance',
      next: 'check-balance'
    },
    {
      id: 'check-balance',
      type: 'action',
      action: 'getUserBalance',
      next: 'condition-1'
    },
    {
      id: 'condition-1',
      type: 'condition',
      condition: 'balance > 1000',
      trueNext: 'message-rich',
      falseNext: 'message-poor'
    },
    {
      id: 'message-rich',
      type: 'message',
      text: "🎉 У вас {balance}₽! Вы богаты!"
    },
    {
      id: 'message-poor',
      type: 'message',
      text: "💰 У вас {balance}₽. Покупайте больше!"
    }
  ]
}
```

## FAQ

### Где теперь настраивать приветственное сообщение?
В конструкторе workflow, создайте узел Message с триггером "start".

### Можно ли использовать старые настройки сообщений?
Нет, они удалены. Используйте workflow.

### Что делать с существующими ботами?
Они продолжат работать, но для изменений используйте workflow.

### Как добавить новую команду?
В конструкторе workflow: Trigger → Command → Message/Action.

### Можно ли вернуть старые настройки?
Нет, старая архитектура создавала конфликты. Workflow - единственный способ.

---

**Дата создания:** 2025-01-12  
**Версия:** 2.0  
**Автор:** AI Assistant + User

