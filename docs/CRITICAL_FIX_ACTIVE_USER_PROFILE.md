# 🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: active-user-profile → end-node

**Дата**: 2025-10-29  
**Проблема**: Кнопки меню работают, но создают **новые workflow executions** вместо возобновления старого

---

## ❌ Найденная проблема

### Симптомы:
```
/start → показывает главное меню ✅
Нажатие "Баланс" → создаёт НОВЫЙ execution ❌
Нажатие "История" → создаёт ЕЩЁ ОДИН НОВЫЙ execution ❌
```

### Логи показывали:
```
🚀 EXECUTING WORKFLOW FROM NODE: active-user-profile
✅ Node active-user-profile executed, nextNodeId: __WAITING_FOR_USER_INPUT__
🚀 EXECUTING WORKFLOW FROM NODE: end-node  ← WORKFLOW ЗАВЕРШАЕТСЯ!
✅ Workflow completed successfully

<Пользователь нажимает кнопку>

🆕 Creating workflow execution with payload  ← НОВЫЙ EXECUTION!
🚀 EXECUTING WORKFLOW FROM NODE: menu-balance-trigger
```

---

## 🔍 Корневая причина

В файле `Система лояльности (исправленная).json` была найдена **скрытая проблема**:

```json
{
  "id": "edge-active-user-profile-end-node-1760624947132",
  "source": "active-user-profile",  ← ГЛАВНАЯ НОДА МЕНЮ!
  "target": "end-node"               ← ЗАВЕРШАЕТ WORKFLOW!
}
```

**Почему это критично?**

`active-user-profile` — это **ПЕРВАЯ** message-нода, которая показывается пользователю при `/start`. Она содержит главное меню с кнопками:
- 💰 Баланс
- 📜 История
- 🏆 Уровень
- 👥 Рефералы
- 🔗 Пригласить
- ❓ Помощь

Если эта нода подключена к `end-node`, то workflow **ЗАВЕРШАЕТСЯ СРАЗУ** после показа главного меню. Любое нажатие на кнопку создаёт **НОВЫЙ** workflow execution.

---

## ✅ Что было исправлено

### Удалены 7 connections к `end-node`:

1. **`edge-active-user-profile-end-node`** ← **ГЛАВНАЯ ПРОБЛЕМА!**
2. `edge-show-balance-details-end-node`
3. `edge-show-history-list-end-node`
4. `edge-show-level-info-end-node`
5. `edge-show-referrals-stats-end-node`
6. `edge-show-invite-link-end-node`
7. `edge-show-help-info-end-node`

### Осталось 3 connections (для завершающих нод):

- `already-active-message → end-node` (показывается при попытке активации уже активного аккаунта)
- `success-activated-user → end-node` (показывается после успешной активации)
- `website-registration-required → end-node` (показывается при отсутствии регистрации на сайте)

---

## 📊 До и После

### ДО исправления:
```
/start → workflow_execution_1 (status: waiting)
  ↓
active-user-profile показывает меню
  ↓
end-node ЗАВЕРШАЕТ workflow_execution_1 (status: completed) ← ЗАВЕРШЁН!
  ↓
Нажатие "Баланс" → workflow_execution_2 (status: waiting) ← НОВЫЙ!
  ↓
Нажатие "История" → workflow_execution_3 (status: waiting) ← ЕЩЁ НОВЫЙ!
```

### ПОСЛЕ исправления:
```
/start → workflow_execution_1 (status: waiting)
  ↓
active-user-profile показывает меню
  ↓
workflow_execution_1 ОСТАЁТСЯ В waiting state ← ОСТАЁТСЯ!
  ↓
Нажатие "Баланс" → workflow_execution_1 возобновляется ← ТОТ ЖЕ!
  ↓
Нажатие "История" → workflow_execution_1 возобновляется ← ТОТ ЖЕ!
  ↓
Нажатие "Уровень" → workflow_execution_1 возобновляется ← ТОТ ЖЕ!
```

---

## 🎯 Ожидаемый результат

После импорта исправленного сценария и перезапуска сервера:

✅ `/start` → показывает главное меню (workflow остаётся в `status: waiting`)  
✅ Нажатие **любой** кнопки меню → возобновляет **ТОТ ЖЕ** execution  
✅ Кнопка "Назад в меню" → возвращает в `active-user-profile`  
✅ В БД создаётся **ТОЛЬКО ОДИН** `workflow_execution` для всей сессии меню  

---

## 🚀 Как применить исправление

### 1️⃣ Импортировать обновлённый сценарий

1. Откройте админку Dashboard
2. Перейдите в раздел **Workflows**
3. Найдите workflow "Система лояльности"
4. Нажмите кнопку **"Импорт"** или **"Заменить"**
5. Выберите файл: `Система лояльности (исправленная).json`
6. **СОХРАНИТЕ** изменения

### 2️⃣ Перезапустить dev сервер

```powershell
# Остановите текущий сервер:
Ctrl+C

# Запустите заново:
pnpm dev
```

### 3️⃣ Протестировать

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Нажмите **любую** кнопку меню (например, "💰 Баланс")
4. Нажмите другую кнопку (например, "📜 История")
5. Проверьте логи — **НЕ** должно быть `Creating workflow execution with payload`
6. Проверьте БД — должен быть **ТОЛЬКО ОДИН** `workflow_execution` с `status = 'waiting'`

---

## 📁 Изменённые файлы

1. `Система лояльности (исправленная).json` — удалены 7 connections
2. `docs/changelog.md` — добавлена запись об исправлении
3. `docs/WORKFLOW_MENU_PERSISTENCE_FIX.md` — обновлён отчёт
4. `docs/CRITICAL_FIX_ACTIVE_USER_PROFILE.md` — этот документ

---

## 🧪 Как проверить, что исправление работает

### В логах должно быть:

```
✅ STEP 5: Executing node active-user-profile
✅ Node active-user-profile executed, nextNodeId: __WAITING_FOR_USER_INPUT__
✅ Workflow execution loop completed successfully

<Пользователь нажимает кнопку "Баланс">

✅ checkAndResumeWaitingWorkflow: Found waiting execution: cmhbtqcrk0009v8ag1p8h58c7
✅ RESUMING WORKFLOW FROM NODE: menu-balance-trigger  ← ВОЗОБНОВЛЕНИЕ!
✅ STEP 1: Executing node menu-balance-trigger
```

### В логах НЕ ДОЛЖНО быть:

```
❌ Creating workflow execution with payload  ← НЕТ НОВЫХ EXECUTIONS!
❌ Starting workflow execution with node: menu-balance-trigger
```

---

*Документ создан 2025-10-29 в рамках критического исправления системы меню для Telegram бота.*

