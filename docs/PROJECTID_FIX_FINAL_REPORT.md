# 🎉 КРИТИЧЕСКАЯ ПРОБЛЕМА РЕШЕНА: `projectId = undefined`

**Дата**: 2025-10-28  
**Статус**: ✅ ИСПРАВЛЕНО  
**Приоритет**: 🔴 КРИТИЧЕСКИЙ  

---

## 📋 Краткое резюме

**Проблема**: При выполнении workflow query, переменная `{{projectId}}` резолвилась как `undefined`, что приводило к тому, что пользователи НЕ находились в базе данных, и workflow шёл по неправильному пути.

**Причина**: Метод `resolveVariablePath` в `action-handlers.ts` искал **ВСЕ** переменные только в `workflow_variables` (БД), игнорируя **top-level свойства** `ExecutionContext` (`projectId`, `userId`, `workflowId` и т.д.).

**Решение**: Добавлена проверка `context` напрямую **ДО** обращения к `workflow_variables`.

---

## 🔍 Диагностика (хронология)

### Этап 1: Обнаружение проблемы

**Симптомы**:
- При повторном `/start` бот показывал "welcome-message" вместо "active-user-profile"
- Логи показывали: `✅ Resolved projectId: undefined`
- SQL query: `WHERE telegram_id = ... AND project_id = NULL`
- Пользователи НЕ находились в БД, хотя были зарегистрированы

### Этап 2: Добавление debug-логирования

**Файлы изменены**:
- `src/lib/services/workflow/handlers/utils.ts` (строка 171-181)
- `src/lib/services/workflow/handlers/action-handlers.ts` (добавлены console.log)

**Результат**:
```javascript
🔍 DEBUG: Checking context.projectId: {
  rootValue: 'cmh2d0uv30000v8h8ujr7u233',  // ✅ Значение ЕСТЬ в контексте!
  isDefined: true,
  contextKeys: ['executionId', 'projectId', 'workflowId', ...]
}

✅ Resolved projectId: undefined  // ❌ НО резолвится как undefined!
```

### Этап 3: Выявление корневой причины

**Анализ кода**:

```typescript
// action-handlers.ts, строка 172-177 (ДО ИСПРАВЛЕНИЯ)
private async resolveVariablePath(varPath: string, context: ExecutionContext): Promise<any> {
  const parts = varPath.split('.');
  
  // Если это простая переменная без точек
  if (parts.length === 1) {
    return await context.variables.get(varPath, 'session'); // ❌ Искал только в БД!
  }
  // ...
}
```

**Проблема**: 
- `context.variables.get('projectId', 'session')` ищет переменную с ключом `'projectId'` в таблице `workflow_variables`
- **НО** `projectId` — это **top-level свойство** `ExecutionContext`, а НЕ переменная в БД!

---

## ✅ Решение

### Изменение 1: Простые переменные

**Файл**: `src/lib/services/workflow/handlers/action-handlers.ts`  
**Строки**: 172-185

```typescript
private async resolveVariablePath(varPath: string, context: ExecutionContext): Promise<any> {
  const parts = varPath.split('.');
  
  // Если это простая переменная без точек
  if (parts.length === 1) {
    // ✅ КРИТИЧНО: Сначала проверяем, есть ли это свойство в контексте напрямую
    if ((context as any)[varPath] !== undefined) {
      console.log(`✅ Resolved ${varPath} from context:`, (context as any)[varPath]);
      return (context as any)[varPath];
    }
    
    // Если нет в контексте, ищем в session-scope переменных
    return await context.variables.get(varPath, 'session');
  }
  // ...
}
```

### Изменение 2: Вложенные переменные

**Строки**: 187-201

```typescript
// Если это вложенная переменная (например, contactReceived.phoneNumber)
const baseVarName = parts[0];
const propertyPath = parts.slice(1);

console.log(`🔍 Resolving nested variable: base=${baseVarName}, path=${propertyPath.join('.')}`);

// ✅ КРИТИЧНО: Сначала проверяем, есть ли base в контексте напрямую
let baseValue: any;
if ((context as any)[baseVarName] !== undefined) {
  baseValue = (context as any)[baseVarName];
  console.log(`🔍 Base variable ${baseVarName} from context:`, baseValue);
} else {
  baseValue = await context.variables.get(baseVarName, 'session');
  console.log(`🔍 Base variable ${baseVarName} from session:`, baseValue);
}
```

---

## 🎯 Результат

### ДО исправления

```
🔍 Resolving workflow variable: projectId
✅ Resolved projectId: undefined

SQL: SELECT ... WHERE telegram_id = '524567338' AND project_id = NULL
Результат: Пользователь не найден

Workflow: start → welcome-message (НЕПРАВИЛЬНО для зарегистрированного пользователя)
```

### ПОСЛЕ исправления

```
🔍 Resolving workflow variable: projectId
✅ Resolved projectId from context: cmh2d0uv30000v8h8ujr7u233

SQL: SELECT ... WHERE telegram_id = '524567338' AND project_id = 'cmh2d0uv30000v8h8ujr7u233'
Результат: Пользователь найден!

Workflow: start → check-user-active → active-user-profile (ПРАВИЛЬНО!)
```

---

## 📊 Влияние на систему

### ✅ Исправлено

1. **Database queries**: Все query с `{{projectId}}` теперь используют правильное значение
2. **User lookup**: Пользователи находятся по `telegram_id` + `projectId`
3. **Workflow routing**: Workflow идёт по правильному пути для зарегистрированных пользователей
4. **Duplicate bonuses**: Приветственные бонусы НЕ начисляются повторно

### 🔄 Дополнительные преимущества

Также корректно резолвятся:
- `{{userId}}` — ID пользователя
- `{{workflowId}}` — ID workflow
- `{{sessionId}}` — ID сессии
- `{{executionId}}` — ID execution
- `{{telegram.*}}` — все свойства telegram контекста

---

## 🧪 Тестирование

### Тест-кейс 1: Повторный `/start` для зарегистрированного пользователя

**Шаги**:
1. Пользователь отправляет `/start`
2. Делится контактом
3. Получает приветственные бонусы
4. Снова отправляет `/start`

**Ожидаемый результат**:
- ✅ Бот показывает профиль с текущим балансом
- ✅ НЕ начисляет приветственные бонусы повторно

**Фактический результат**: ✅ **РАБОТАЕТ ПРАВИЛЬНО**

### Тест-кейс 2: Первый `/start` для нового пользователя

**Шаги**:
1. Новый пользователь отправляет `/start`

**Ожидаемый результат**:
- ✅ Бот показывает welcome-message
- ✅ Просит поделиться контактом

**Фактический результат**: ✅ **РАБОТАЕТ ПРАВИЛЬНО**

---

## 📝 Рекомендации

### 1. Удалить debug-логирование после проверки

После финального тестирования можно удалить `console.log` из `resolveVariablePath` для чистоты логов.

### 2. Документировать порядок резолва переменных

Создать документацию, объясняющую:
- Порядок поиска переменных: `context` → `workflow_variables`
- Какие переменные доступны в `context` напрямую
- Как правильно использовать `{{variableName}}` в workflow

### 3. Добавить unit-тесты

Создать тесты для `resolveVariablePath`:
- Резолв context-переменных (`projectId`, `userId`)
- Резолв session-переменных (из `workflow_variables`)
- Резолв вложенных переменных (`telegram.userId`, `user.balance`)

---

## 🎉 Заключение

**Критическая проблема полностью решена!**

Теперь все workflow query работают корректно, пользователи находятся в БД, и система правильно определяет состояние пользователя при повторных взаимодействиях.

**Время на диагностику и исправление**: ~2 часа  
**Количество изменённых строк**: ~20  
**Количество исправленных багов**: 1 критический + предотвращено множество потенциальных проблем с другими context-переменными

---

**Автор исправления**: AI Assistant  
**Дата завершения**: 2025-10-28 22:20  

