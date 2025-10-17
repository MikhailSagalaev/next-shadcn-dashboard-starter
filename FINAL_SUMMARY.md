# 🎯 Критическая ошибка: Условия не работали!

## ❌ Что было не так

### Проблема #1: Проверялся неправильный атрибут

**Код (БЫЛ НЕПРАВИЛЬНЫЙ):**
```typescript
// В getNextNodeId()
const matchingConnection = relevantConnections.find(conn =>
  conn.type === (conditionResult ? 'true' : 'false')  ← НЕПРАВИЛЬНО!
);
```

**Что происходило:**
- `conn.type` - это `WorkflowConnectionType` ('default', 'timeout', etc.)
- Но для условий нужно проверять `sourceHandle` ('true' или 'false')

**Результат:**
```
Condition result: false  ← Пользователь существует
↓
Проверяет conn.type === 'false'  ← Но type = 'default'!
↓
Не находит совпадение
↓
Берёт первую connection (по умолчанию)
↓
Идёт в create-user вместо existing-user-message ❌
```

### Проблема #2: Переменные перезаписывались

```
check-existing-user → user = найден
check-user → user = ПЕРЕЗАПИСЬ! ← Старое значение потеряно
is-new-user → проверяет user ← Проверяет новое значение!
```

## ✅ Исправления

### Исправление #1: Проверка sourceHandle

```typescript
// ПРАВИЛЬНО:
const matchingConnection = relevantConnections.find(conn => {
  const expectedHandle = conditionResult ? 'true' : 'false';
  return (conn as any).sourceHandle === expectedHandle;
});

console.log(`✅ Condition result=${conditionResult}, following "${expectedHandle}" → ${target}`);
```

### Исправление #2: Уникальные переменные

```json
{
  "id": "check-user",
  "config": {
    "assignTo": "userByContact"  ← Уникальное имя
  }
},
{
  "id": "is-new-user",
  "config": {
    "variable": "userByContact"  ← Проверяем правильную переменную
  }
}
```

## 📊 Как это работает теперь

### Структура Connection в JSON:

```json
{
  "source": "is-new-user",
  "target": "create-user",
  "type": "default",           ← Тип связи (default/timeout/etc)
  "sourceHandle": "true",      ← Выход ноды (true/false для условий)
  "targetHandle": "input"      ← Вход целевой ноды
}
```

### Логика выбора следующей ноды:

```typescript
// 1. Получаем все connections от текущей ноды
const connections = getAllConnectionsFrom(currentNodeId);

// 2. Для condition ноды:
if (nodeType === 'condition') {
  const result = getConditionResult();  // true or false
  
  // 3. Ищем connection с правильным sourceHandle
  const next = connections.find(c => 
    c.sourceHandle === (result ? 'true' : 'false')
  );
  
  return next.target;
}
```

### Пример правильной работы:

```
[DEBUG] Step 6 Node is-new-user: Condition result: false
✅ Condition is-new-user: result=false, following sourceHandle="false" → existing-user-message
[INFO] Step 7 Node existing-user-message: Message sent ✅
```

## 🧪 Тестирование

### Сценарий 1: Новый пользователь
```
1. /start
2. check-existing-user → user = null
3. user-exists-check (is_empty) → false → welcome-message ✅
4. Отправка контакта
5. check-user → userByContact = null
6. is-new-user (is_empty on userByContact) → true → create-user ✅
```

### Сценарий 2: Существующий пользователь
```
1. /start
2. check-existing-user → user = {...}
3. user-exists-check (is_not_empty) → true → existing-user-message ✅
```

### Сценарий 3: Пользователь без TG ID, с контактом
```
1. /start
2. check-existing-user (by telegram_id) → user = null
3. user-exists-check → false → welcome-message
4. Отправка контакта
5. check-user (by phone + telegram_id) → userByContact = {...}
6. is-new-user (is_empty on userByContact) → false → existing-user-message ✅
```

## 📝 Что нужно запомнить

### 1. Для conditions используется sourceHandle

```json
// ПРАВИЛЬНО ✅
{
  "source": "my-condition",
  "sourceHandle": "true",  ← Это проверяется!
  "target": "success-node"
}

// НЕ type:
{
  "type": "default"  ← Это НЕ для условий!
}
```

### 2. Переменные должны быть уникальными

```typescript
// НЕПРАВИЛЬНО ❌
assignTo: "user"  // Обе ноды пишут в user
assignTo: "user"  // Вторая перезапишет первую!

// ПРАВИЛЬНО ✅
assignTo: "userByTelegramId"
assignTo: "userByContact"
```

### 3. Debug логи помогают

Теперь в логах видно:
```
✅ Condition is-new-user: result=false, following sourceHandle="false" → existing-user-message
```

Или предупреждение:
```
⚠️ No matching connection found for condition is-new-user, result=false
```

## 🚀 Результат

- ✅ Условия работают правильно
- ✅ Нет дублирования пользователей
- ✅ Нет перезаписи переменных
- ✅ Детальные логи для отладки

## 📚 Документация обновлена

- `docs/workflow-debugging.md` - полное руководство по отладке
- `docs/changelog.md` - история изменений
- В коде добавлены console.log для отладки условий

---

**Вывод**: Была критическая ошибка в логике обработки условий. Проверялся `type` вместо `sourceHandle`. Теперь исправлено и всё работает! 🎉

