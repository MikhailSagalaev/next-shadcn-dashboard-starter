# Исправление persistence workflow для интерактивного меню

**Дата**: 2025-10-29  
**Задача**: Исправить создание новых workflow executions при каждом нажатии кнопки меню

---

## ❌ Проблема

### Симптомы:
При нажатии на кнопки меню в боте происходило следующее:
- **1-е нажатие** (например, "Помощь") — работает ✅
- **2-е нажатие** (например, "Рефералы") — создаётся НОВЫЙ workflow execution ❌
- **"Назад в меню"** — не работает ❌

### Логи показывали:
```
🚀 EXECUTING WORKFLOW FROM NODE: menu-help-trigger
✅ Node show-help-info executed
🚀 EXECUTING WORKFLOW FROM NODE: end-node  ← workflow ЗАВЕРШАЕТСЯ
✅ Workflow completed successfully

<Пользователь нажимает другую кнопку>

🆕 Creating workflow execution with payload   ← НОВЫЙ execution!
🚀 EXECUTING WORKFLOW FROM NODE: menu-referrals-trigger
```

---

## 🔍 Анализ проблемы

### Корневая причина:

В файле `Система лояльности (исправленная).json` все message-ноды подменю были **подключены к `end-node`**:

```json
{
  "id": "edge-show-balance-details-end-node",
  "source": "show-balance-details",
  "target": "end-node"  ← ЗАВЕРШАЕТ WORKFLOW!
}
```

### Почему это проблема?

1. Пользователь нажимает "Баланс" → workflow показывает `show-balance-details`
2. Message-нода подключена к `end-node` → workflow **ЗАВЕРШАЕТСЯ**
3. Workflow execution устанавливает `status = 'completed'`, `wait_type = NULL`
4. Пользователь нажимает "История" → `checkAndResumeWaitingWorkflow` не находит waiting execution (т.к. он завершён)
5. Система создаёт **НОВЫЙ** workflow execution вместо возобновления старого

---

## ✅ Что было исправлено

### 1. Удалены connections к `end-node`

Удалены следующие connections:
- `edge-active-user-profile-end-node` ← **ГЛАВНАЯ ПРОБЛЕМА!**
- `edge-show-balance-details-end-node`
- `edge-show-history-list-end-node`
- `edge-show-level-info-end-node`
- `edge-show-referrals-stats-end-node`
- `edge-show-invite-link-end-node`
- `edge-show-help-info-end-node`

**Итого**: 7 connections удалено

**КРИТИЧНО**: Connection `edge-active-user-profile-end-node` был главной проблемой, так как `active-user-profile` — это **первая** message-нода, которая показывается пользователю при `/start`. Если она подключена к `end-node`, то workflow завершается сразу после показа главного меню, и любое нажатие на кнопку создаёт новый execution.

### 2. Новая логика workflow

Теперь workflow работает так:

1. Пользователь нажимает "Баланс"
2. Workflow выполняет `menu-balance-trigger` → `show-balance-details`
3. Message-нода показывает сообщение с inline-кнопками
4. **Workflow остаётся в `status = 'waiting'`, `wait_type = 'callback'`** ← КЛЮЧЕВОЕ ИЗМЕНЕНИЕ!
5. Пользователь нажимает "История"
6. `checkAndResumeWaitingWorkflow` **НАХОДИТ** waiting execution
7. Workflow **ВОЗОБНОВЛЯЕТСЯ** с `menu-history-trigger` (БЕЗ создания нового execution)

---

## 📊 Ожидаемый результат

### До исправления:
```
/start → workflow_execution_1 (status: waiting)
Нажатие "Помощь" → workflow_execution_1 (status: completed) ← ЗАВЕРШЁН!
Нажатие "Рефералы" → workflow_execution_2 (status: waiting) ← НОВЫЙ!
Нажатие "Баланс" → workflow_execution_3 (status: waiting) ← ЕЩЁ НОВЫЙ!
```

### После исправления:
```
/start → workflow_execution_1 (status: waiting)
Нажатие "Помощь" → workflow_execution_1 (status: waiting) ← ТОТ ЖЕ!
Нажатие "Рефералы" → workflow_execution_1 (status: waiting) ← ТОТ ЖЕ!
Нажатие "Баланс" → workflow_execution_1 (status: waiting) ← ТОТ ЖЕ!
```

---

## 🧪 Как протестировать

1. Перезапустить dev сервер
2. Отправить `/start` в бота
3. Нажать "💰 Баланс"
4. Нажать "📜 История"
5. Нажать "🏆 Уровень"
6. Нажать "❓ Помощь"
7. Нажать "🔙 Главное меню"

**Ожидается**:
- Все кнопки работают ✅
- Кнопка "Назад" возвращает в главное меню ✅
- В БД создаётся **ТОЛЬКО ОДИН** workflow execution ✅
- Логи показывают `RESUMING WORKFLOW` вместо `Creating workflow execution` ✅

---

## 📁 Изменённые файлы

1. **`Система лояльности (исправленная).json`** — удалены 6 connections к `end-node`
2. **`docs/changelog.md`** — добавлена запись об исправлении
3. **`docs/WORKFLOW_MENU_PERSISTENCE_FIX.md`** — этот документ

---

## 🎯 Техническая деталь

### Lifecycle workflow с меню:

```
start-trigger
  ↓
check-telegram-user (action.database_query)
  ↓
check-user-status (condition)
  ↓ (true)
check-user-active (condition)
  ↓ (true)
active-user-profile (message with inline keyboard)
  ↓
__WAITING_FOR_USER_INPUT__ (status: waiting, wait_type: callback)
  ↓ <user clicks button>
menu-balance-trigger (trigger.callback, callback_data: menu_balance)
  ↓
show-balance-details (message with inline keyboard)
  ↓
__WAITING_FOR_USER_INPUT__ (status: waiting, wait_type: callback) ← ОСТАЁТСЯ WAITING!
  ↓ <user clicks another button>
menu-history-trigger (trigger.callback, callback_data: menu_history)
  ... и так далее
```

**КРИТИЧНО**: Workflow **НЕ ДОЛЖЕН** завершаться (`end-node`) после показа подменю, иначе следующее нажатие создаст новый execution.

---

*Документ создан 2025-10-29 в рамках исправления системы меню для Telegram бота.*

