# 🤖 Промпт для AI: Планирование полной реализации Workflow Constructor

## Контекст проекта
Вы работаете над **SaaS платформой бонусных программ** с Telegram ботами. Проект использует:
- **Технологии**: Next.js 15, React 19, TypeScript, PostgreSQL, Prisma ORM, Grammy (Telegram bot framework)
- **Архитектура**: Мультитенантная SaaS система
- **Цель**: Визуальный конструктор workflow для настройки поведения Telegram ботов без программирования

## Текущее состояние
- ✅ Есть UI конструктора на React Flow
- ✅ Есть базовая структура БД (таблица `workflows` с JSON полями `nodes`, `connections`, `variables`)
- ✅ Есть базовый набор компонентов нод (trigger, message, action, condition, end)
- ❌ НЕТ полноценного runtime executor для выполнения workflow
- ❌ НЕТ реализации action handlers (работа с БД, API)
- ❌ НЕТ системы переменных и контекста выполнения
- ❌ НЕТ обработки сложных условий и ветвлений

## Задача для AI

Создайте **детальный план реализации полноценного Workflow Constructor** для Telegram ботов. План должен включать:

### 1. Архитектура системы

Опишите:
- **Компоненты системы** (UI Constructor, Workflow Runtime, Action Handlers, Context Manager, etc.)
- **Схему взаимодействия** между компонентами
- **Data Flow**: как данные проходят от UI конструктора до выполнения в боте
- **Хранение данных**: структура JSON в БД для nodes, connections, variables, settings
- **Версионирование workflow**: как хранить историю изменений и откатываться

### 2. Runtime Executor

Спроектируйте:
- **Интерпретатор workflow**: как парсить JSON и выполнять ноды последовательно
- **Execution Context**: структура контекста выполнения (переменные, состояние пользователя, session)
- **Node Handlers**: архитектура обработчиков для каждого типа ноды
- **Error Handling**: как обрабатывать ошибки, retry, fallback
- **Performance**: кэширование скомпилированных workflow, оптимизация запросов к БД

### 3. Типы нод и их реализация

Для каждого типа ноды опишите:

#### Trigger Nodes:
- `command` - команды бота (/start, /help, etc.)
- `message` - текстовые сообщения
- `callback` - нажатия на кнопки
- `contact` - получение контакта пользователя
- `location` - получение геолокации
- `photo` - получение фото
- `document` - получение документов

#### Message Nodes:
- Отправка текста с Markdown/HTML
- Поддержка inline/reply клавиатур
- Вставка переменных `{{user.name}}`
- Отправка фото/видео/документов
- Edit предыдущих сообщений

#### Action Nodes (Работа с данными):
- `check_user_linked` - проверка привязки пользователя
- `find_user_by_contact` - поиск по телефону
- `find_user_by_email` - поиск по email
- `link_telegram_account` - привязка аккаунта
- `get_user_balance` - получение баланса бонусов
- `get_referral_stats` - статистика рефералов
- `get_transaction_history` - история транзакций
- `check_user_level` - проверка уровня пользователя
- `api_request` - произвольный API запрос
- `database_query` - кастомный запрос к БД
- `set_variable` - установка переменной
- `get_variable` - получение переменной

#### Condition Nodes:
- Операторы сравнения: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Логические операторы: `AND`, `OR`, `NOT`
- Проверки: `is_empty`, `is_not_empty`, `contains`, `starts_with`, `ends_with`
- Работа с переменными контекста
- Множественные ветвления (switch-case)

#### Flow Control Nodes:
- `delay` - задержка выполнения
- `loop` - циклы
- `sub_workflow` - вызов другого workflow
- `jump` - переход к конкретной ноде
- `end` - завершение workflow

#### Integration Nodes:
- `webhook` - отправка webhook
- `email` - отправка email
- `sms` - отправка SMS
- `analytics` - отправка событий в аналитику

### 4. Система переменных

Определите:
- **Scope переменных**: global, project, user, session
- **Типы данных**: string, number, boolean, object, array
- **Встроенные переменные**: `{{user.id}}`, `{{user.name}}`, `{{project.name}}`, `{{balance}}`, etc.
- **Операции с переменными**: set, get, increment, decrement, append
- **Persistence**: где и как хранить переменные (Redis, БД)

### 5. Конструктор UI

Опишите:
- **Компоненты React Flow**: кастомные ноды, handles, edges
- **Property Panels**: формы настройки каждого типа ноды
- **Validation**: проверка корректности workflow до сохранения
- **Debug Mode**: пошаговое выполнение workflow с визуализацией
- **Testing Tools**: инструменты для тестирования workflow без реального бота
- **Templates Library**: библиотека готовых шаблонов workflow

### 6. Интеграция с Grammy Bot

Опишите:
- Как подключить workflow к Grammy bot instances
- Как обрабатывать updates через workflow
- Как совмещать workflow с hardcoded handlers
- Middleware архитектура
- Session management

### 7. Безопасность и производительность

Рассмотрите:
- **Rate Limiting**: ограничение выполнения workflow
- **Timeout**: максимальное время выполнения
- **Infinite Loop Protection**: защита от бесконечных циклов
- **Resource Limits**: ограничение на количество нод, глубину вложенности
- **Sandbox**: изоляция выполнения кастомного кода
- **Caching Strategy**: что и как кэшировать

### 8. Мониторинг и отладка

Предложите:
- **Logging**: что логировать на каждом этапе
- **Metrics**: какие метрики собирать (execution time, error rate, etc.)
- **Analytics Dashboard**: визуализация статистики выполнения workflow
- **Error Tracking**: интеграция с Sentry или аналогами
- **Debug Console**: real-time отладка workflow

### 9. API и Webhooks

Определите:
- **REST API**: для управления workflow извне
- **Webhook Integration**: триггеры от внешних систем
- **Event System**: публикация событий выполнения workflow
- **Rate Limits** для API

### 10. Database Schema

Предложите:
- **Структуру таблиц** (workflows, workflow_executions, workflow_logs, workflow_variables)
- **Индексы** для оптимизации запросов
- **Миграции**: как версионировать схему БД
- **Backups**: стратегия бэкапов workflow

### 11. Этапы разработки

Разбейте реализацию на итерации:
- **Iteration 1 (MVP)**: базовый runtime + простые ноды (trigger, message, end)
- **Iteration 2**: action nodes + работа с БД
- **Iteration 3**: condition nodes + ветвления
- **Iteration 4**: переменные + контекст
- **Iteration 5**: продвинутые фичи (loops, sub-workflows, integrations)
- **Iteration 6**: debug tools + analytics

Для каждой итерации укажите:
- Задачи
- Приоритет
- Оценка времени
- Зависимости
- Критерии завершения

### 12. Testing Strategy

Опишите:
- **Unit Tests**: для каждого node handler
- **Integration Tests**: выполнение workflow end-to-end
- **Load Tests**: производительность под нагрузкой
- **User Acceptance Tests**: тестирование с реальными пользователями

### 13. Documentation

Что нужно задокументировать:
- **Для разработчиков**: архитектура, API, как добавлять новые типы нод
- **Для пользователей**: как создавать workflow в UI, примеры, best practices
- **Troubleshooting Guide**: частые проблемы и их решения

### 14. Migration Plan

Как мигрировать с hardcoded ботов на workflow:
- Стратегия постепенного перехода
- Обратная совместимость
- Rollback plan

### 15. Risks и Mitigation

Определите риски:
- Производительность при большом количестве workflow
- Сложность отладки
- Уязвимости безопасности
- Vendor Lock-in

Для каждого риска предложите план митигации.

---

## Формат ответа

Создайте структурированный документ в Markdown со следующими разделами:

```markdown
# Workflow Constructor - Architecture & Implementation Plan

## Executive Summary
[Краткое описание, цели, ключевые решения]

## 1. System Architecture
### 1.1 Component Diagram
### 1.2 Data Flow
### 1.3 Technology Stack

## 2. Core Components
### 2.1 Workflow Runtime Executor
### 2.2 Node Handlers Registry
### 2.3 Execution Context Manager
### 2.4 Variable System
### 2.5 Condition Evaluator

## 3. Node Types Specification
[Для каждого типа: описание, config schema, handler implementation]

## 4. Database Schema
[SQL DDL + описание]

## 5. API Specification
[OpenAPI/Swagger spec]

## 6. UI Constructor
[Компоненты, UX flow]

## 7. Implementation Roadmap
[Детальный план по итерациям]

## 8. Testing Strategy
[Unit, Integration, E2E tests]

## 9. Monitoring & Observability
[Metrics, Logging, Dashboards]

## 10. Security & Performance
[Best practices, limitations]

## 11. Documentation Plan
[Что документировать]

## 12. Risks & Mitigation
[Таблица рисков]

## Appendix
### A. Code Examples
### B. Configuration Examples
### C. Glossary
```

---

## Ожидаемый результат

После выполнения этого промпта AI должен предоставить **полную спецификацию** системы Workflow Constructor, которую можно:
1. Использовать как техническое задание для разработки
2. Показать инвесторам/стейкхолдерам
3. Разбить на задачи в Jira/Linear
4. Оценить по времени и стоимости
5. Начать имплементировать по этапам

---

## Дополнительные требования

- **Практичность**: решения должны быть реализуемы с текущим tech stack
- **Масштабируемость**: система должна работать с 1000+ активных workflow
- **UX**: конструктор должен быть понятен non-technical пользователям
- **Надёжность**: 99.9% uptime, graceful degradation
- **Cost-effectiveness**: оптимальное использование ресурсов (БД, RAM, CPU)

---

## Примеры для вдохновения

Рассмотрите архитектуру:
- **n8n** (workflow automation)
- **Zapier** (no-code automation)
- **Botpress** (chatbot builder)
- **Dialogflow CX** (conversational AI)
- **Temporal** (workflow engine)

Но адаптируйте под специфику Telegram ботов и SaaS бонусной системы.

---

## Финальный чеклист

AI должен ответить на все вопросы:
- ✅ Как workflow хранится в БД?
- ✅ Как workflow компилируется и выполняется?
- ✅ Как обрабатываются ошибки?
- ✅ Как работают переменные?
- ✅ Как тестировать workflow?
- ✅ Как мониторить выполнение?
- ✅ Сколько времени займёт реализация?
- ✅ Какие риски и как их минимизировать?
- ✅ Как масштабировать систему?
- ✅ Как документировать?

---

**Используйте этот промпт с Claude/GPT-4/Gemini для получения детального плана!**

