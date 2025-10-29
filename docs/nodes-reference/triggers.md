# Триггеры (Triggers)

Триггеры — это точки входа в workflow. Они определяют, когда и при каких условиях запускается сценарий.

---

## trigger.command

**Описание**: Запускает workflow при получении команды от пользователя в Telegram.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `command` | string | ✅ | Команда без слеша (например, `start`, `help`) |

### Пример использования

```json
{
  "type": "trigger.command",
  "config": {
    "trigger.command": {
      "command": "start"
    }
  }
}
```

### Доступные переменные

После срабатывания триггера доступны:
- `{{telegram.userId}}` — ID пользователя Telegram
- `{{telegram.username}}` — Username пользователя
- `{{telegram.chatId}}` — ID чата
- `{{message.text}}` — Полный текст команды

### Best Practices

- Используйте короткие, понятные команды (`start`, `help`, `bonus`)
- Добавляйте описание команд через BotFather
- Для команд с параметрами используйте `trigger.message` с regex

### Troubleshooting

**Проблема**: Команда не срабатывает
- Проверьте, что команда написана без слеша в конфигурации
- Убедитесь, что workflow активирован
- Проверьте логи выполнения

---

## trigger.message

**Описание**: Запускает workflow при получении текстового сообщения, соответствующего паттерну.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `pattern` | string | ✅ | Regex паттерн или точный текст |
| `matchType` | enum | ❌ | `exact`, `contains`, `regex` (по умолчанию `exact`) |
| `caseSensitive` | boolean | ❌ | Учитывать регистр (по умолчанию `false`) |

### Пример использования

```json
{
  "type": "trigger.message",
  "config": {
    "trigger.message": {
      "pattern": "привет|здравствуй",
      "matchType": "regex",
      "caseSensitive": false
    }
  }
}
```

### Доступные переменные

- `{{message.text}}` — Текст сообщения
- `{{message.matchedGroups}}` — Группы из regex (если используется)
- `{{telegram.userId}}`, `{{telegram.username}}`, `{{telegram.chatId}}`

### Best Practices

- Для простых совпадений используйте `exact` или `contains`
- Для сложных паттернов используйте `regex`
- Тестируйте regex на [regex101.com](https://regex101.com/)

---

## trigger.callback

**Описание**: Запускает workflow при нажатии на inline-кнопку.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `callbackData` | string | ✅ | Данные callback (можно использовать паттерн) |
| `matchType` | enum | ❌ | `exact`, `starts_with`, `regex` |

### Пример использования

```json
{
  "type": "trigger.callback",
  "config": {
    "trigger.callback": {
      "callbackData": "buy_product_*",
      "matchType": "starts_with"
    }
  }
}
```

### Доступные переменные

- `{{callback.data}}` — Полные данные callback
- `{{callback.messageId}}` — ID сообщения с кнопкой
- `{{telegram.userId}}`, `{{telegram.username}}`, `{{telegram.chatId}}`

### Best Practices

- Используйте префиксы для группировки callback (`action_`, `menu_`)
- Храните минимум данных в callback (max 64 байта)
- Для сложных данных используйте ID и храните данные в БД

---

## trigger.webhook

**Описание**: Запускает workflow при получении HTTP-запроса на webhook URL.

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `method` | enum | ❌ | `GET`, `POST`, `PUT`, `DELETE` (по умолчанию `POST`) |
| `validateSecret` | boolean | ❌ | Проверять webhook secret (по умолчанию `true`) |

### Пример использования

```json
{
  "type": "trigger.webhook",
  "config": {
    "trigger.webhook": {
      "method": "POST",
      "validateSecret": true
    }
  }
}
```

### Webhook URL

```
https://your-domain.com/api/webhook/{projectId}/{workflowId}
```

### Доступные переменные

- `{{webhook.body}}` — Тело запроса (JSON)
- `{{webhook.headers}}` — Заголовки запроса
- `{{webhook.query}}` — Query параметры
- `{{webhook.method}}` — HTTP метод

### Best Practices

- Всегда используйте `validateSecret` в production
- Логируйте входящие webhook для отладки
- Используйте retry механизм на стороне отправителя

### Пример интеграции (Tilda)

```javascript
// В Tilda Zero Block
fetch('https://your-domain.com/api/webhook/PROJECT_ID/WORKFLOW_ID', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': 'YOUR_SECRET'
  },
  body: JSON.stringify({
    action: 'purchase',
    payload: {
      email: 'user@example.com',
      amount: 1000
    }
  })
});
```

---

## trigger.email

**Описание**: Запускает workflow при получении email (требует настройки email-провайдера).

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `fromPattern` | string | ❌ | Паттерн для фильтрации отправителя |
| `subjectPattern` | string | ❌ | Паттерн для фильтрации темы |

### Пример использования

```json
{
  "type": "trigger.email",
  "config": {
    "trigger.email": {
      "fromPattern": "*@example.com",
      "subjectPattern": "Order #*"
    }
  }
}
```

### Доступные переменные

- `{{email.from}}` — Email отправителя
- `{{email.subject}}` — Тема письма
- `{{email.body}}` — Тело письма (text)
- `{{email.html}}` — Тело письма (HTML)
- `{{email.attachments}}` — Список вложений

### Best Practices

- Используйте фильтры для избежания спама
- Парсите email body с помощью regex
- Для вложений используйте отдельный storage

---

## Общие рекомендации

1. **Один workflow — один основной триггер**: Хотя можно использовать несколько триггеров, лучше создавать отдельные workflow для разных точек входа.

2. **Тестирование**: Всегда тестируйте триггеры в тестовом окружении перед production.

3. **Логирование**: Включайте подробное логирование для отладки срабатывания триггеров.

4. **Безопасность**: Для webhook триггеров всегда используйте валидацию secret.

5. **Мониторинг**: Отслеживайте частоту срабатывания триггеров для выявления аномалий.

