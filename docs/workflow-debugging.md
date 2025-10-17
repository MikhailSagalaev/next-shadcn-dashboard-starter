# 🔍 Отладка Workflow сценариев

## Как читать логи выполнения

### Структура логов

Каждый шаг workflow создаёт записи в формате:
```
[LEVEL] Execution {executionId} Step {step} Node {nodeId}: {message}
```

### Уровни логирования:
- `DEBUG` - детальная информация (результаты условий, данные переменных)
- `INFO` - основные события (отправка сообщений, выполнение запросов)
- `WARN` - предупреждения
- `ERROR` - ошибки выполнения

### Пример анализа логов:

```log
[INFO] Step 2 Node check-existing-user: Executing safe database query
[DEBUG] Step 2 Node check-existing-user: Query result assigned to variable: user
[INFO] Step 2 Node check-existing-user: Database query executed successfully

[DEBUG] Step 3 Node user-exists-check: Evaluating simple condition
[DEBUG] Step 3 Node user-exists-check: Condition result: true
[INFO] Step 3 Node user-exists-check: Condition evaluated
```

**Что видно:**
1. Step 2: Выполнен запрос `check-existing-user`
2. Результат сохранён в переменную `user`
3. Step 3: Условие `user-exists-check` вернуло `true`
4. Workflow пойдёт по ветке `sourceHandle: "true"`

## Типичные проблемы

### 1. Переменные перезаписываются

**Симптомы:**
```log
[DEBUG] Step 2: Query result assigned to variable: user
[DEBUG] Step 5: Query result assigned to variable: user  ← перезапись!
[DEBUG] Step 6: Condition result: false  ← неправильный результат
```

**Решение:** Используйте разные имена переменных
```json
{
  "action.database_query": {
    "query": "check_user_by_telegram",
    "assignTo": "userByContact"  ← уникальное имя
  }
}
```

### 2. Ошибка "Unique constraint failed"

**Симптом:**
```log
Workflow execution failed: Unique constraint failed on the (not available)
```

**Причина:** Попытка создать дубликат пользователя

**Как найти:** Проверьте логи условий перед ошибкой:
```log
[DEBUG] Step 6 Node is-new-user: Condition result: false  ← user exists
[INFO] Step 7 Node create-user: Executing safe database query  ← но идёт создание!
```

**Решение:** Проверьте connections в JSON - возможно перепутаны `sourceHandle: "true"` и `"false"`

### 3. Контакт не обрабатывается

**Симптом:** После отправки контакта ничего не происходит

**Проверьте:**
1. Контакт должен быть в контексте:
```log
Telegram context: {
  contact: { phoneNumber: "+...", firstName: "..." }
}
```

2. Переменные должны использовать правильный путь:
```json
"parameters": {
  "phone": "{{telegram.contact.phoneNumber}}",  ← правильно
  "firstName": "{{telegram.contact.firstName}}"
}
```

Не:
```json
"phone": "{{contact.phone}}"  ← неправильно (старый формат)
```

## Инструменты отладки

### 1. Просмотр логов workflow в БД

```sql
SELECT 
  wl.step,
  wl.node_id,
  wl.level,
  wl.message,
  wl.data,
  wl.timestamp
FROM workflow_logs wl
WHERE execution_id = 'YOUR_EXECUTION_ID'
ORDER BY step ASC;
```

### 2. Проверка переменных

```sql
SELECT 
  key,
  value,
  scope,
  expires_at
FROM workflow_variables
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at DESC;
```

### 3. Проверка executions

```sql
SELECT 
  id,
  status,
  error,
  step_count,
  started_at,
  finished_at
FROM workflow_executions
WHERE telegram_chat_id = 'YOUR_CHAT_ID'
ORDER BY started_at DESC
LIMIT 5;
```

## Как проверить action.database_query

### Структура ноды:

```json
{
  "id": "check-user",
  "type": "action.database_query",
  "data": {
    "config": {
      "action.database_query": {
        "query": "check_user_by_telegram",
        "parameters": {
          "phone": "{{telegram.contact.phoneNumber}}",
          "telegramId": "{{telegram.userId}}"
        },
        "assignTo": "user"
      }
    }
  }
}
```

### Что происходит:

1. **Резолв переменных** - `{{...}}` заменяются на реальные значения:
```
"phone": "{{telegram.contact.phoneNumber}}" 
→ "phone": "+79620024188"
```

2. **Выполнение запроса** - вызывается predefined query из `database-queries-registry.ts`

3. **Сохранение результата**:
```typescript
await context.variables.set('user', result);
```

4. **Логирование**:
```log
[INFO] Executing safe database query
[DEBUG] Query result assigned to variable: user
[INFO] Database query executed successfully
```

### Проверка резолва переменных:

В логах ищите:
```log
prisma:query SELECT ... WHERE ("telegram_id" = $1 AND "project_id" = $2)
```

Если видите `$1 = undefined` или пустые значения - переменная не резолвится.

## Debugging Workflow в реальном времени

### 1. Включите debug логи Prisma

В `.env.local`:
```env
DATABASE_URL="postgresql://..."
DEBUG="prisma:query"
```

### 2. Следите за терминалом dev сервера

Ищите паттерны:
- `Starting workflow execution with node: ...`
- `Workflow execution loop completed successfully`
- `Workflow execution failed: ...`

### 3. Используйте workflow logs API

```bash
curl http://localhost:3000/api/projects/{projectId}/workflows/logs?executionId={id}
```

## Checklist для отладки

- [ ] Проверить логи execution в БД
- [ ] Убедиться что переменные имеют уникальные имена
- [ ] Проверить connections между нодами (true/false не перепутаны)
- [ ] Убедиться что `telegram.contact` заполнен при обработке контакта
- [ ] Проверить что predefined query существует в registry
- [ ] Убедиться что параметры передаются правильно (не `undefined`)
- [ ] Проверить что условия используют правильные переменные

## Полезные команды

```bash
# Очистить кэш workflow
curl -X POST http://localhost:3000/api/admin/clear-workflow-cache

# Обновить workflow из файла
npx tsx scripts/force-update-workflow.ts

# Посмотреть активные executions
npx prisma studio
# → откройте таблицу workflow_executions
```

---

**Важно:** При изменении workflow в конструкторе всегда **сохраняйте** его, чтобы изменения попали в БД!

