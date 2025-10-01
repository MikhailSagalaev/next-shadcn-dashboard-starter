# 🚀 План реализации конструктора Telegram ботов

## 📋 Обзор проекта

Создание полноценного визуального конструктора Telegram ботов для SaaS платформы бонусных программ, позволяющего пользователям создавать сложные боты без программирования.

## 🏗️ Текущая архитектура

### ✅ Что уже есть:
- **База данных**: Модель `BotSettings` с JSON полями `messageSettings` и `functionalSettings`
- **API**: CRUD операции для управления ботами
- **UI**: Базовые компоненты управления ботом
- **Backend**: Grammy.js фреймворк для Telegram ботов
- **Интеграция**: Система пользователей и бонусов

### ❌ Ограничения текущей системы:
- Только базовые текстовые сообщения
- Нет визуального конструктора
- Ограниченная логика диалогов
- Нет состояний и ветвлений
- Отсутствие аналитики

## 🎯 Цели конструктора

### Основные возможности:
1. **Визуальный конструктор** - drag & drop интерфейс на базе React Flow
2. **Диалоговые сценарии** - ветвление и состояния с использованием Grammy Sessions
3. **Настраиваемые команды** - кастомные команды и ответы через Grammy Commands
4. **Интерактивные элементы** - кнопки, клавиатуры, формы через Callback Queries
5. **Условная логика** - if/then/else условия с Grammy Middleware
6. **Интеграция с внешними сервисами** - API, базы данных через Grammy API
7. **Аналитика и метрики** - статистика использования бота
8. **Шаблоны и импорт/экспорт** - готовые решения и экспорт в Grammy код

## 🛠️ Техническая архитектура

### 1. База данных (расширение)

```prisma
model BotFlow {
  id          String   @id @default(cuid())
  projectId   String   @unique
  name        String
  description String?
  version     Int      @default(1)
  isActive    Boolean  @default(false)
  nodes       Json     // Массив нод конструктора
  connections Json     // Связи между нодами
  variables   Json     // Переменные бота
  settings    Json     // Общие настройки
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id])
}

model BotSession {
  id        String   @id @default(cuid())
  projectId String
  userId    String   // Telegram user ID
  flowId    String
  state     Json     // Текущее состояние диалога
  variables Json     // Переменные сессии
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectId, userId, flowId])
}
```

### 2. Типы данных

```typescript
// Типы нод конструктора
export type NodeType =
  | 'start'        // Начало диалога
  | 'message'      // Отправка сообщения
  | 'input'        // Ожидание ввода
  | 'condition'    // Условный переход
  | 'action'       // Действие (API, база данных)
  | 'end';         // Завершение

export interface BotNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface NodeData {
  label: string;
  description?: string;
  config: NodeConfig;
}

export interface NodeConfig {
  // Grammy-based конфигурации
  message?: MessageConfig;      // ctx.reply(), ctx.api.sendMessage()
  command?: CommandConfig;      // bot.command()
  callback?: CallbackConfig;    // bot.callbackQuery()
  input?: InputConfig;          // Ожидание ввода с валидацией
  condition?: ConditionConfig;  // Условная логика Grammy
  action?: ActionConfig;        // API calls, DB queries, variables
  middleware?: MiddlewareConfig; // Grammy middleware
  session?: SessionConfig;      // Работа с сессиями
}

export interface MessageConfig {
  text: string;
  keyboard?: KeyboardConfig;
  attachments?: Attachment[];
}

export interface KeyboardConfig {
  type: 'inline' | 'reply';
  buttons: ButtonConfig[];
}

export interface ConditionConfig {
  variable: string;
  operator: 'equals' | 'contains' | 'greater' | 'less';
  value: any;
  trueNodeId: string;
  falseNodeId: string;
}

export interface CommandConfig {
  command: string;              // Имя команды без /
  description?: string;         // Описание для /help
  aliases?: string[];           // Альтернативные имена
}

export interface CallbackConfig {
  data: string;                 // Callback data для кнопки
  pattern?: string;             // Регулярное выражение для matching
  hideKeyboard?: boolean;       // Скрыть клавиатуру после нажатия
}

export interface MiddlewareConfig {
  type: 'logging' | 'auth' | 'rate_limit' | 'custom';
  priority: number;             // Порядок выполнения
  condition?: string;           // Условие выполнения
  code?: string;                // Пользовательский код middleware
}

export interface SessionConfig {
  key: string;                  // Ключ переменной сессии
  value: any;                   // Значение для установки
  operation: 'set' | 'get' | 'delete' | 'increment';
}

export interface ActionConfig {
  type: 'api_call' | 'db_query' | 'set_variable' | 'send_notification' | 'grammy_api';
  config: ActionDetails & {
    // Grammy-specific actions
    grammyMethod?: string;      // ctx.api.sendMessage, ctx.reply и т.д.
    grammyParams?: Record<string, any>; // Параметры для Grammy метода
  };
}
```

## 🎨 UI/UX Дизайн

### 1. Главная страница конструктора

```
┌─────────────────────────────────────────────────┐
│ 🤖 Конструктор бота: [Название проекта]        │
├─────────────────────────────────────────────────┤
│ ┌─ Панель инструментов ──────────────────────┐ │
│ │ [+] Добавить ноду  [💾] Сохранить  [▶] Тест │ │
│ │ [📊] Аналитика    [⚙️] Настройки  [📤] Экспорт│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Холст конструктора ────────────────────────┐ │
│ │                                             │ │
│ │  🟢 START ──────▶ 💬 Сообщение ──────▶ 🔀   │ │
│ │                                             │ │
│ │             Условие ──────▶ 🎯 Действие      │ │
│ │                                             │ │
│ │                    ⏹️ END                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Панель свойств ─────────────────────────────┐ │
│ │ 📝 Свойства выбранной ноды                   │ │
│ │                                             │ │
│ │ Текст: Привет! Как дела?                    │ │
│ │ Кнопки: [Да] [Нет]                          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2. Типы нод

#### 🟢 **START Node** (Grammy: bot.start())
- Точка входа в диалог
- Автоматически срабатывает на команды `/start`, `/help`
- Инициализация сессии пользователя

#### 💬 **Message Node** (Grammy: ctx.reply(), ctx.api.sendMessage())
- Отправка текстового сообщения
- Настраиваемые кнопки (inline/reply через Grammy keyboards)
- Вложения (фото, документы через Grammy files)
- Поддержка Markdown/HTML форматирования
- Переход к следующей ноде

#### 🎯 **Command Node** (Grammy: bot.command())
- Обработка команд типа `/balance`, `/help`, `/settings`
- Автоматическая регистрация команд
- Поддержка алиасов и описаний
- Интеграция с Telegram Bot Father

#### 👆 **Callback Query Node** (Grammy: bot.callbackQuery())
- Обработка нажатий на inline кнопки
- Поддержка регулярных выражений для группировки
- Автоматическое скрытие клавиатуры (опционально)
- Обновление сообщений без отправки новых

#### 📝 **Input Node** (Grammy: Conversations plugin)
- Ожидание ввода от пользователя с таймаутом
- Валидация (email, телефон, число, текст, regex)
- Сохранение в переменные сессии
- Повторные запросы при ошибках

#### 🔀 **Condition Node** (Grammy: Middleware logic)
- Условные переходы с поддержкой Grammy context
- Операторы: ==, !=, >, <, contains, regex, in_array
- Переменные: ctx.message.text, session data, user data, API responses
- Множественные выходы для сложной логики

#### ⚙️ **Middleware Node** (Grammy: bot.use())
- Перехват и модификация запросов
- Логирование, аутентификация, rate limiting
- Модификация контекста перед обработкой
- Прерывание цепочки выполнения

#### 💾 **Session Node** (Grammy: Sessions plugin)
- Работа с переменными сессии
- Операции: get, set, delete, increment
- Поддержка различных хранилищ (Redis, Memory, DB)
- Управление состоянием диалога

#### ⚡ **Action Node** (Grammy: ctx.api.*)
- Вызов Grammy API методов
- Запросы к внешним API
- Операции с базой данных
- Отправка уведомлений и email
- Интеграция с платежными системами

#### ⏹️ **END Node** (Grammy: Conversation end)
- Завершение диалога
- Очистка состояния сессии
- Опциональное прощальное сообщение
- Логирование завершения

## 📋 План реализации (фазы)

### **Фаза 1: Базовая инфраструктура** (3 недели)
- [ ] Расширение схемы БД: `BotFlow`, `BotSession` модели
- [ ] Grammy Sessions интеграция для хранения состояний
- [ ] Создание базовых TypeScript типов для конструктора
- [ ] API endpoints для CRUD операций с потоками
- [ ] Интеграция с существующей системой BotManager

### **Фаза 2: Визуальный конструктор** (4 недели)
- [ ] React Flow интеграция для drag & drop холста
- [ ] Панель инструментов с Grammy-специфичными нодами
- [ ] Система соединений и валидации потоков
- [ ] Сериализация потоков в Grammy-compatible формат
- [ ] Preview режим для тестирования потоков

### **Фаза 3: Grammy-специфичные редакторы** (3 недели)
- [ ] Message Node: WYSIWYG редактор с Markdown/HTML
- [ ] Command Node: регистрация команд с Bot Father интеграцией
- [ ] Callback Node: конструктор inline клавиатур
- [ ] Condition Node: визуальный билдер условий с Grammy context
- [ ] Middleware Node: настройка перехватчиков и модификаторов
- [ ] Session Node: управление переменными сессии

### **Фаза 4: Исполнение потоков** (4 недели)
- [ ] Модификация Grammy обработчиков для поддержки потоков
- [ ] Интеграция Conversations plugin для многошаговых сценариев
- [ ] Система исполнения нод с поддержкой async/await
- [ ] Обработка ошибок и fallback сценариев
- [ ] Оптимизация производительности для больших потоков

### **Фаза 5: Продвинутые возможности** (3 недели)
- [ ] Grammy Router интеграция для сложной маршрутизации
- [ ] Внешние API интеграции через Grammy middleware
- [ ] Расширенная система переменных и выражений
- [ ] Таймауты, retry логика и rate limiting
- [ ] Webhook система для внешних уведомлений

### **Фаза 6: Аналитика и шаблоны** (3 недели)
- [ ] Метрики использования: просмотры, конверсии, ошибки
- [ ] Аналитический дашборд для каждого потока
- [ ] Каталог готовых шаблонов (регистрация, заказы, поддержка)
- [ ] Импорт/экспорт потоков в JSON/Grammy код
- [ ] Marketplace для пользовательских шаблонов

## 🔧 Технические детали

### Frontend технологии:
- **React Flow** - для визуального конструктора
- **shadcn/ui** - компоненты интерфейса
- **Zustand** - управление состоянием
- **React Hook Form** - формы редактирования
- **Monaco Editor** - для пользовательского кода

### Backend технологии:
- **Prisma** - работа с базой данных
- **Grammy.js** - Telegram бот фреймворк (основной движок)
- **Grammy Sessions** - управление состояниями пользователей
- **Grammy Conversations** - многошаговые диалоги
- **Grammy Router** - маршрутизация запросов
- **Redis** - кэширование и сессии
- **Bull** - очередь задач

### Архитектура:
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bot Builder   │    │     API         │    │   Grammy Engine │
│   (React)       │◄──►│   (Next.js)     │◄──►│   (Grammy.js)   │
│                 │    │                 │    │                 │
│ • Visual Editor │    │ • CRUD Flows    │    │ • Flow Executor │
│ • Node Config   │    │ • Bot Sessions  │    │ • Grammy API    │
│ • Templates     │    │ • Analytics     │    │ • Middleware    │
│ • Code Export   │    │ • Webhooks      │    │ • Sessions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Grammy Integration Details:

#### **Core Components:**
- **Bot Constructor** → Создает визуальные потоки
- **Flow Serializer** → Конвертирует в Grammy handlers
- **Session Manager** → Управление состояниями через Grammy Sessions
- **Middleware Engine** → Преобразование нод в Grammy middleware
- **Command Router** → Grammy Router для команд и callback'ов

#### **Execution Flow:**
1. **User Input** → Grammy handler получает обновление
2. **Flow Lookup** → Определяется активный поток для пользователя
3. **Node Execution** → Последовательно выполняются ноды
4. **Context Passing** → Передача данных между нодами через ctx
5. **State Updates** → Сохранение состояния в сессии

#### **Node → Grammy Mapping:**
- **Message Node** → `ctx.reply()` или `ctx.api.sendMessage()`
- **Command Node** → `bot.command('name')`
- **Callback Node** → `bot.callbackQuery('data')`
- **Condition Node** → Middleware с условной логикой
- **Session Node** → Работа с `ctx.session`

## 📊 Метрики успеха

### Функциональные:
- Количество созданных ботов: **>100**
- Среднее время создания бота: **<30 минут**
- Уровень отказов: **<5%**

### Технические:
- Время отклика: **<500ms**
- Доступность: **99.9%**
- Память: **<200MB** на проект

## 🚀 Риски и mitigation

### Риски:
1. **Сложность UX** - решение: итеративное тестирование
2. **Производительность** - решение: оптимизация React Flow
3. **Совместимость** - решение: постепенное развертывание
4. **Безопасность** - решение: аудит и penetration testing

### Mitigation стратегии:
- **A/B тестирование** для новых фич
- **Feature flags** для постепенного релиза
- **Мониторинг** производительности
- **Резервные копии** всех конфигураций

## 📅 Таймлайн

```
Месяц 1: Фазы 1-2 (Базовая инфраструктура + Визуальный конструктор)
Месяц 2: Фазы 3-4 (Редактор нод + Исполнение потоков)
Месяц 3: Фазы 5-6 (Продвинутые возможности + Аналитика)
```

## 💰 Бюджет и ресурсы

### Команда:
- **Frontend Developer** (2 чел.) - React, UI/UX
- **Backend Developer** (1 чел.) - Node.js, Telegram API
- **DevOps** (0.5 чел.) - инфраструктура
- **QA Tester** (1 чел.) - тестирование

### Инструменты:
- **Figma** - дизайн прототипов
- **Linear** - управление задачами
- **Vercel** - развертывание
- **Sentry** - мониторинг ошибок

## 🎯 Следующие шаги

1. **Создать прототип** базового конструктора
2. **Провести пользовательское тестирование** MVP
3. **Собрать обратную связь** от ранних пользователей
4. **Итеративно улучшить** на основе отзывов
5. **Запустить beta версию** с ограниченным набором функций

---

*Этот план является основой для реализации полноценного конструктора Telegram ботов. Он может быть адаптирован на основе требований и обратной связи от пользователей.*
