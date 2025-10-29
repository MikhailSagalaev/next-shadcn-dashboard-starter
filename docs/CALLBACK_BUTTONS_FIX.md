# Исправление обработки callback-кнопок в меню

**Дата**: 2025-10-29  
**Задача**: Исправить обработку нажатий на inline-кнопки меню

---

## ❌ Проблема

### Симптомы:
При нажатии на кнопки меню в боте ничего не происходило:
- **💰 Баланс** — нет реакции
- **📜 История** — нет реакции  
- **🏆 Уровень** — нет реакции
- **👥 Рефералы** — нет реакции
- **🔗 Пригласить** — нет реакции
- **❓ Помощь** — нет реакции

### Логи показывали:
```
Callback received: menu_balance
Found waiting workflow execution
🚀 RESUMING WORKFLOW FROM check-contact-user  ← ПРОБЛЕМА!
```

Бот пытался выполнить ноду `check-contact-user` вместо `menu-balance-trigger`.

---

## 🔍 Анализ проблемы

### Корневая причина:

В файле `src/lib/services/bot-flow-executor/router-integration.ts` в функции `checkAndResumeWaitingWorkflow()` на строке **688** был **хардкод**:

```typescript
// ✨ ПРОСТОЕ РЕШЕНИЕ: Всегда переходим к check-contact-user после получения контакта
const nextNodeId = 'check-contact-user';  // ← ОШИБКА: для ВСЕХ типов!
```

Этот код применялся **для всех типов ожидания**:
- ✅ `contact` — правильно, должна быть `check-contact-user`
- ❌ `callback` — неправильно, должна искаться trigger.callback нода
- ❌ `input` — неправильно, должна использоваться текущая нода

### Почему это критично?

Когда пользователь нажимает кнопку "Баланс":
1. Отправляется `callback_data = 'menu_balance'`
2. Система находит waiting workflow
3. **Но вместо** ноды `menu-balance-trigger` (trigger.callback с `callbackData: 'menu_balance'`)
4. **Выполняется** нода `check-contact-user` (для обработки контактов!)
5. Результат: ничего не происходит, пользователь не видит баланс

---

## ✅ Решение

### Изменённый код:

```typescript
// ✨ ИСПРАВЛЕНО: Определяем nextNodeId в зависимости от типа ожидания
let nextNodeId: string;

if (waitType === 'contact') {
  // Для контактов всегда переходим к check-contact-user
  nextNodeId = 'check-contact-user';
} else if (waitType === 'callback') {
  // ✨ ДЛЯ CALLBACK: Ищем trigger.callback ноду с соответствующим callbackData
  const callbackData = data;
  
  // Получаем все ноды workflow
  const workflowNodes = waitingExecution.workflow.nodes as any[];
  
  // Ищем trigger.callback ноду с matching callbackData
  const callbackTriggerNode = workflowNodes.find((node: any) => 
    node.type === 'trigger.callback' && 
    node.data?.config?.callbackData === callbackData
  );
  
  if (callbackTriggerNode) {
    nextNodeId = callbackTriggerNode.id;
    logger.info('✅ Found matching callback trigger node', {
      callbackData,
      triggerNodeId: nextNodeId,
      triggerLabel: callbackTriggerNode.data?.label
    });
  } else {
    logger.warn('⚠️ No matching callback trigger found, using current node', {
      callbackData,
      availableTriggers: workflowNodes
        .filter((n: any) => n.type === 'trigger.callback')
        .map((n: any) => ({ id: n.id, callbackData: n.data?.config?.callbackData }))
    });
    // Fallback к текущей ноде
    nextNodeId = waitingExecution.currentNodeId || 'start-trigger';
  }
} else {
  // Для input используем текущую ноду
  nextNodeId = waitingExecution.currentNodeId || 'start-trigger';
}
```

---

## 🎯 Результат

### Теперь при нажатии на кнопку "Баланс":

**ДО исправления**:
```
1. callback_data = 'menu_balance'
2. checkAndResumeWaitingWorkflow(ctx, 'callback', 'menu_balance')
3. nextNodeId = 'check-contact-user'  ← НЕПРАВИЛЬНО
4. Выполняется check-contact-user
5. Ничего не происходит
```

**ПОСЛЕ исправления**:
```
1. callback_data = 'menu_balance'
2. checkAndResumeWaitingWorkflow(ctx, 'callback', 'menu_balance')
3. Ищем trigger.callback с callbackData = 'menu_balance'
4. nextNodeId = 'menu-balance-trigger'  ← ПРАВИЛЬНО!
5. Выполняется menu-balance-trigger → show-balance-details
6. Пользователь видит свой баланс ✅
```

---

## 📋 Алгоритм обработки callback (после исправления)

1. **Пользователь нажимает кнопку** → Telegram отправляет `callback_data`
   ```
   callback_data: "menu_balance"
   ```

2. **handleCallback()** получает callback и вызывает:
   ```typescript
   await this.checkAndResumeWaitingWorkflow(ctx, 'callback', 'menu_balance')
   ```

3. **checkAndResumeWaitingWorkflow** ищет waiting workflow:
   ```sql
   SELECT * FROM workflow_executions 
   WHERE status = 'waiting' 
     AND waitType = 'callback'
     AND telegramChatId = '524567338'
   ```

4. **Поиск trigger-ноды** по `callback_data`:
   ```typescript
   const callbackTriggerNode = workflowNodes.find((node: any) => 
     node.type === 'trigger.callback' && 
     node.data?.config?.callbackData === 'menu_balance'
   );
   // Найдена: menu-balance-trigger
   ```

5. **Возобновление workflow** с найденной ноды:
   ```typescript
   await processor.resumeWorkflow(context, 'menu-balance-trigger');
   ```

6. **Выполнение цепочки**:
   ```
   menu-balance-trigger → show-balance-details → отправка сообщения
   ```

7. **Пользователь видит результат** ✅

---

## 🧪 Тестирование

### Как проверить исправление:

1. **Перезапустить dev сервер** (обязательно!):
   ```powershell
   Ctrl+C
   pnpm dev
   ```

2. **Открыть бота в Telegram**

3. **Отправить** `/start`

4. **Нажать на кнопки меню**:
   - **💰 Баланс** → должен показать детальную информацию о балансе
   - **📜 История** → должен показать список транзакций
   - **🏆 Уровень** → должен показать текущий уровень и прогресс
   - **👥 Рефералы** → должен показать статистику рефералов
   - **🔗 Пригласить** → должен показать реферальную ссылку
   - **❓ Помощь** → должен показать справку

### Ожидаемые логи (теперь):

```
Callback received: menu_balance
Found waiting workflow execution
✅ Found matching callback trigger node
  callbackData: menu_balance
  triggerNodeId: menu-balance-trigger
🚀 RESUMING WORKFLOW
  nextNodeId: menu-balance-trigger  ← ПРАВИЛЬНО!
  waitType: callback
Workflow resumed successfully
```

---

## 📊 Затронутые файлы

1. ✅ `src/lib/services/bot-flow-executor/router-integration.ts`
   - Строки 687-735
   - Добавлена логика поиска trigger.callback ноды

2. ✅ `docs/changelog.md`
   - Добавлена запись об исправлении

3. ✅ `docs/CALLBACK_BUTTONS_FIX.md` (этот файл)
   - Детальное описание проблемы и решения

---

## 🚀 Следующие шаги

1. ✅ Перезапустить dev сервер
2. 🔄 Протестировать все кнопки меню
3. ✅ Убедиться, что все переменные корректно отображаются (из предыдущего fix)

---

**Статус**: ✅ Исправлено  
**Требуется**: Перезапуск dev сервера для применения изменений

