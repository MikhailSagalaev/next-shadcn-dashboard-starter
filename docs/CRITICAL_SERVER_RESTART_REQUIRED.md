# 🚨 КРИТИЧЕСКОЕ: ТРЕБУЕТСЯ РЕСТАРТ СЕРВЕРА!

**Дата**: 2025-10-29  
**Проблема**: Кнопки "Назад" и другие inline-кнопки меню не работают корректно

---

## ❌ Текущая ситуация

### Что происходит:
1. **Каждое нажатие кнопки создаёт НОВЫЙ workflow execution** вместо возобновления существующего
2. **Кнопки "Назад в меню" не работают** - просто ничего не происходит
3. **Система НЕ находит waiting execution** при нажатии кнопки

### Симптомы в логах:
```
✅ Node show-balance-details executed, nextNodeId: __WAITING_FOR_USER_INPUT__
Workflow execution loop completed successfully

<Пользователь нажимает кнопку "История">

🆕 Creating workflow execution with payload  ← НОВЫЙ EXECUTION!
Starting workflow execution with node: menu-history-trigger
```

**КРИТИЧНО**: В логах **ОТСУТСТВУЮТ** строки с `🔵 CALLBACK RECEIVED`!

---

## 🔍 Диагностика проблемы

### Корневая причина:
**Dev сервер НЕ БЫЛ ПЕРЕЗАПУЩЕН** после внесения изменений в код!

### Внесённые изменения (НЕ применены в runtime):
1. **Файл**: `src/lib/services/bot-flow-executor/router-integration.ts`
2. **Изменения**:
   - Добавлено подробное логирование в `handleCallback`:
     ```typescript
     logger.info('🔵 CALLBACK RECEIVED', {
       callbackData,
       userId: ctx.from?.id,
       projectId: this.projectId,
       timestamp: new Date().toISOString()
     });
     ```
   - Добавлено логирование в `checkAndResumeWaitingWorkflow`:
     ```typescript
     logger.info('🔎 SEARCHING FOR WAITING EXECUTION', {
       projectId: this.projectId,
       chatId: ctx.chat?.id,
       waitType
     });
     ```

### Почему логи не появляются:
- Next.js использует **hot reloading**, НО не всегда корректно применяет изменения в backend-коде
- Изменения в файлах сервисов (`src/lib/services/*`) **ТРЕБУЮТ ПОЛНОГО РЕСТАРТА**
- Без рестарта код продолжает работать со **СТАРОЙ ВЕРСИЕЙ** файлов

---

## ✅ Решение: РЕСТАРТ СЕРВЕРА

### Шаг 1: Остановка сервера
1. Найдите окно PowerShell с запущенным `pnpm dev`
2. Нажмите **Ctrl+C**
3. Дождитесь полной остановки (должно появиться `Process exited`)

### Шаг 2: Запуск сервера
1. Выполните команду:
   ```powershell
   pnpm dev
   ```
2. Дождитесь сообщения:
   ```
   ✓ Ready in X.Xs
   ○ Local: http://localhost:3000
   ```

### Шаг 3: Проверка применения изменений
После рестарта в логах **ДОЛЖНЫ** появиться новые строки при работе с ботом:
```
🔵 CALLBACK RECEIVED
🔍 CHECKING FOR WAITING WORKFLOW
🔎 SEARCHING FOR WAITING EXECUTION
✅ FOUND WAITING WORKFLOW EXECUTION
✅ WORKFLOW RESUMED
```

---

## 🧪 Тестирование после рестарта

### Тест 1: Базовая работа меню
1. Откройте бота в Telegram
2. Отправьте `/start`
3. Нажмите кнопку **"💰 Баланс"**
4. **Ожидается**:
   - В логах появится `🔵 CALLBACK RECEIVED` с `callbackData: "menu_balance"`
   - Бот покажет сообщение с балансом
   - В логах появится `✅ WORKFLOW RESUMED`

### Тест 2: Кнопка "Назад в меню"
1. Нажмите кнопку **"🔙 Назад в меню"**
2. **Ожидается**:
   - В логах появится `🔵 CALLBACK RECEIVED` с `callbackData: "menu_main"`
   - Бот покажет **главное меню** (профиль с кнопками)
   - **НЕ СОЗДАЁТСЯ НОВЫЙ EXECUTION** (проверьте логи - не должно быть `INSERT INTO workflow_executions`)

### Тест 3: Переключение между разделами
1. Нажмите **"📜 История"**
2. Затем нажмите **"🏆 Уровень"**
3. Затем **"👥 Рефералы"**
4. **Ожидается**:
   - Все кнопки работают
   - В логах для каждой кнопки есть `🔵 CALLBACK RECEIVED`
   - Система **НЕ создаёт новые executions** (должна ВОЗОБНОВЛЯТЬ старый)

---

## 📊 Ожидаемое поведение ПОСЛЕ рестарта

### Корректный flow:
```
1️⃣ Пользователь отправляет /start
   → Создаётся execution #1
   → Показывается главное меню
   → Execution #1 переходит в status='waiting', wait_type='callback'

2️⃣ Пользователь нажимает "Баланс"
   → Telegram отправляет callback с data="menu_balance"
   → handleCallback получает callback
   → Логи: 🔵 CALLBACK RECEIVED
   → checkAndResumeWaitingWorkflow ищет waiting execution
   → Логи: ✅ FOUND WAITING WORKFLOW EXECUTION (execution #1)
   → Возобновляется execution #1 (НЕ создаётся новый!)
   → Показывается сообщение с балансом
   → Execution #1 снова переходит в waiting state

3️⃣ Пользователь нажимает "Назад в меню"
   → Telegram отправляет callback с data="menu_main"
   → handleCallback получает callback
   → Логи: 🔵 CALLBACK RECEIVED
   → Возобновляется ТОТЖЕ execution #1
   → Показывается главное меню
   → Execution #1 снова в waiting state
```

**ИТОГО**: **ОДИН** execution обслуживает **ВСЮ** сессию пользователя!

---

## 🐛 Если проблема сохраняется

### Что проверить:
1. **Логи после рестарта** - есть ли `🔵 CALLBACK RECEIVED`?
   - **ДА** → Код применился, ищем проблему дальше
   - **НЕТ** → Код НЕ применился, рестарт был некорректным

2. **Версия workflow** - убедитесь, что в админке загружен **обновлённый** сценарий:
   - Откройте админку → Проекты → Ваш проект → Workflow
   - Проверьте, что есть ноды: `menu-main-trigger`, `menu-balance-trigger`, etc.
   - Проверьте, что `active-user-profile` **НЕ** подключена к `end-node`

3. **Кеш Next.js** - попробуйте удалить кеш:
   ```powershell
   Remove-Item -Recurse -Force .next
   pnpm dev
   ```

### Пришлите логи:
Если проблема сохраняется, пришлите:
1. **Полный вывод терминала** после рестарта (с момента `pnpm dev`)
2. **Действия в боте** (что нажимали)
3. **Какие логи появились** (есть ли `🔵 CALLBACK RECEIVED`?)
4. **Какое поведение наблюдается** (что работает, что нет)

---

## 📝 Резюме

### Проблема:
- Кнопки меню не работают
- Каждое нажатие создаёт новый execution

### Причина:
- **Dev сервер НЕ ПЕРЕЗАПУЩЕН** после изменений в коде

### Решение:
- **Ctrl+C** → **pnpm dev** → **Протестировать бота**

### Критерий успеха:
- В логах появляется `🔵 CALLBACK RECEIVED` при нажатии кнопок
- Кнопки "Назад в меню" работают корректно
- Не создаются новые executions при каждом нажатии

---

**ВАЖНО**: Рестарт сервера - это **КРИТИЧЕСКОЕ** действие! Без него ВСЕ изменения в коде **НЕ РАБОТАЮТ**!

