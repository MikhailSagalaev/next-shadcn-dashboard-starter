# Действия (Actions)

Ноды для выполнения различных действий: работа с API, базой данных, пользователями и уведомлениями.

---

## action.api_request

**Описание**: Выполняет HTTP-запрос к внешнему API.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `url` | string | ✅ | URL для запроса (поддерживает переменные) |
| `method` | enum | ✅ | `GET`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `headers` | object | ❌ | Заголовки запроса |
| `body` | string | ❌ | Тело запроса (JSON string) |
| `saveToVariable` | string | ❌ | Имя переменной для сохранения ответа |
| `timeout` | number | ❌ | Таймаут в мс (по умолчанию 30000) |

### Пример использования

```json
{
  "type": "action.api_request",
  "config": {
    "action.api_request": {
      "url": "https://api.example.com/users/{{user.id}}/balance",
      "method": "GET",
      "headers": {
        "Authorization": "Bearer {{api.token}}",
        "Content-Type": "application/json"
      },
      "saveToVariable": "externalBalance",
      "timeout": 10000
    }
  }
}
```

### Доступные переменные после выполнения

- `{{externalBalance}}` — Ответ API (JSON)
- `{{externalBalance.data}}` — Вложенные поля ответа

### Best Practices

- Используйте переменные для API токенов
- Обрабатывайте ошибки через условия
- Устанавливайте разумные таймауты
- Логируйте запросы для отладки

### Troubleshooting

**Проблема**: Timeout ошибка
- Увеличьте `timeout`
- Проверьте доступность API
- Используйте retry механизм

---

## action.database_query

**Описание**: Выполняет безопасный запрос к базе данных проекта.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `operation` | enum | ✅ | `findFirst`, `findMany`, `count`, `aggregate` |
| `table` | enum | ✅ | `User`, `Bonus`, `Transaction` |
| `where` | object | ❌ | Условия фильтрации |
| `select` | object | ❌ | Поля для выборки |
| `orderBy` | object | ❌ | Сортировка |
| `take` | number | ❌ | Лимит записей |
| `saveToVariable` | string | ❌ | Имя переменной для результата |

### Пример использования

```json
{
  "type": "action.database_query",
  "config": {
    "action.database_query": {
      "operation": "findMany",
      "table": "Bonus",
      "where": {
        "userId": "{{user.id}}",
        "expiresAt": { "gt": "{{now}}" }
      },
      "select": {
        "amount": true,
        "expiresAt": true
      },
      "orderBy": { "expiresAt": "asc" },
      "take": 10,
      "saveToVariable": "userBonuses"
    }
  }
}
```

### Безопасность

- ✅ Автоматическая фильтрация по `projectId`
- ✅ Whitelist разрешённых операций
- ✅ Валидация параметров
- ❌ Нельзя выполнить `delete` или `update` (используйте специальные actions)

### Best Practices

- Используйте `select` для ограничения выборки полей
- Добавляйте `take` для лимита записей
- Для агрегации используйте `aggregate` вместо `findMany`

---

## action.set_variable

**Описание**: Устанавливает значение переменной.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `name` | string | ✅ | Имя переменной |
| `value` | any | ✅ | Значение (поддерживает выражения) |
| `scope` | enum | ❌ | `session`, `user`, `project`, `global` |
| `ttl` | number | ❌ | Время жизни в секундах |

### Пример использования

```json
{
  "type": "action.set_variable",
  "config": {
    "action.set_variable": {
      "name": "userScore",
      "value": "{{userBonuses.length * 10}}",
      "scope": "user",
      "ttl": 86400
    }
  }
}
```

### Scopes переменных

- `session` — Только для текущей сессии workflow
- `user` — Для пользователя (сохраняется между сессиями)
- `project` — Для всего проекта (общие настройки)
- `global` — Глобально (редко используется)

---

## action.check_user_linked

**Описание**: Проверяет, связан ли Telegram аккаунт с пользователем в системе.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `telegramUserId` | string | ✅ | ID пользователя Telegram |
| `saveToVariable` | string | ❌ | Имя переменной для результата (boolean) |

### Пример использования

```json
{
  "type": "action.check_user_linked",
  "config": {
    "action.check_user_linked": {
      "telegramUserId": "{{telegram.userId}}",
      "saveToVariable": "isLinked"
    }
  }
}
```

### Использование с условием

```
[check_user_linked] → [condition: isLinked?]
                         ├─ true → [show_balance]
                         └─ false → [request_contact]
```

---

## action.find_user_by_contact

**Описание**: Находит пользователя по телефону или email.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `contactType` | enum | ✅ | `phone`, `email` |
| `contactValue` | string | ✅ | Значение контакта |
| `saveToVariable` | string | ❌ | Имя переменной для найденного пользователя |

### Пример использования

```json
{
  "type": "action.find_user_by_contact",
  "config": {
    "action.find_user_by_contact": {
      "contactType": "phone",
      "contactValue": "{{contactReceived.phoneNumber}}",
      "saveToVariable": "foundUser"
    }
  }
}
```

### Доступные поля в `foundUser`

- `{{foundUser.id}}` — ID пользователя
- `{{foundUser.name}}` — Имя
- `{{foundUser.email}}` — Email
- `{{foundUser.phone}}` — Телефон
- `{{foundUser.balance}}` — Баланс бонусов

---

## action.link_telegram_account

**Описание**: Связывает Telegram аккаунт с существующим пользователем.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `userId` | string | ✅ | ID пользователя в системе |
| `telegramUserId` | string | ✅ | ID пользователя Telegram |
| `telegramUsername` | string | ❌ | Username Telegram |

### Пример использования

```json
{
  "type": "action.link_telegram_account",
  "config": {
    "action.link_telegram_account": {
      "userId": "{{foundUser.id}}",
      "telegramUserId": "{{telegram.userId}}",
      "telegramUsername": "{{telegram.username}}"
    }
  }
}
```

### Типичный flow привязки

```
[request_contact] → [find_user_by_contact] → [condition: found?]
                                               ├─ true → [link_telegram_account]
                                               └─ false → [create_new_user]
```

---

## action.get_user_balance

**Описание**: Получает текущий баланс бонусов пользователя.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `userId` | string | ✅ | ID пользователя |
| `saveToVariable` | string | ❌ | Имя переменной для баланса |

### Пример использования

```json
{
  "type": "action.get_user_balance",
  "config": {
    "action.get_user_balance": {
      "userId": "{{user.id}}",
      "saveToVariable": "currentBalance"
    }
  }
}
```

---

## action.send_notification

**Описание**: Отправляет уведомление через различные каналы.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `channel` | enum | ✅ | `telegram`, `email`, `webhook` |
| `recipient` | string | ✅ | Получатель (ID, email, URL) |
| `message` | string | ✅ | Текст уведомления |
| `priority` | enum | ❌ | `low`, `normal`, `high` |

### Пример использования

```json
{
  "type": "action.send_notification",
  "config": {
    "action.send_notification": {
      "channel": "email",
      "recipient": "{{user.email}}",
      "message": "Ваш баланс: {{currentBalance}} бонусов",
      "priority": "normal"
    }
  }
}
```

---

## Общие рекомендации

1. **Обработка ошибок**: Всегда добавляйте условия для проверки результата
2. **Переменные**: Сохраняйте результаты в переменные для последующего использования
3. **Производительность**: Минимизируйте количество запросов к БД и API
4. **Безопасность**: Не храните чувствительные данные в переменных с большим TTL
5. **Логирование**: Используйте логи для отладки сложных action chains

