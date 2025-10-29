# Пример: Программа лояльности

Этот пример демонстрирует полноценную систему лояльности с регистрацией, начислением и списанием бонусов.

---

## Описание системы

**Цель**: Автоматизировать программу лояльности для интернет-магазина через Telegram бота.

**Функции**:
- Регистрация пользователей через контакт
- Проверка баланса бонусов
- Начисление бонусов за покупки (через webhook)
- Списание бонусов при оплате

---

## Архитектура

```
Пользователь → Telegram Bot → Workflow System → Database
                                      ↓
                              Webhook от сайта
```

---

## Workflow 1: Регистрация и привязка

### Схема

```
[/start] → [check_user_linked] → [condition: linked?]
                                    ├─ true → [show_welcome_back]
                                    └─ false → [request_contact]
                                                      ↓
                                              [wait_for_contact]
                                                      ↓
                                              [find_user_by_contact]
                                                      ↓
                                              [condition: found?]
                                                ├─ true → [link_account] → [show_success]
                                                └─ false → [show_not_found]
```

### Конфигурация нод

#### 1. Триггер: Команда /start

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

#### 2. Проверка привязки

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

#### 3. Условие: Привязан ли аккаунт?

```json
{
  "type": "flow.condition",
  "config": {
    "flow.condition": {
      "leftOperand": "{{isLinked}}",
      "operator": "equals",
      "rightOperand": "true"
    }
  }
}
```

#### 4a. Приветствие для существующего пользователя

```json
{
  "type": "message",
  "config": {
    "message": {
      "text": "С возвращением! 👋\n\nВаш баланс: **{{user.balance}}** бонусов",
      "parseMode": "Markdown"
    }
  }
}
```

#### 4b. Запрос контакта для нового пользователя

```json
{
  "type": "message.keyboard.reply",
  "config": {
    "message.keyboard.reply": {
      "text": "Для регистрации в программе лояльности поделитесь номером телефона:",
      "buttons": [
        [
          { "text": "📱 Поделиться контактом", "requestContact": true }
        ],
        [
          { "text": "❌ Отмена" }
        ]
      ],
      "oneTime": true,
      "resize": true
    }
  }
}
```

#### 5. Ожидание контакта

```json
{
  "type": "flow.wait",
  "config": {
    "flow.wait": {
      "waitFor": "contact",
      "timeout": 300,
      "timeoutMessage": "Время ожидания истекло. Попробуйте снова: /start"
    }
  }
}
```

#### 6. Поиск пользователя по телефону

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

#### 7. Условие: Найден ли пользователь?

```json
{
  "type": "flow.condition",
  "config": {
    "flow.condition": {
      "leftOperand": "{{foundUser}}",
      "operator": "not_equals",
      "rightOperand": "null"
    }
  }
}
```

#### 8a. Привязка аккаунта

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

#### 9a. Успешная привязка

```json
{
  "type": "message",
  "config": {
    "message": {
      "text": "✅ Аккаунт успешно привязан!\n\nВаш баланс: **{{foundUser.balance}}** бонусов\n\nИспользуйте /balance для проверки баланса",
      "parseMode": "Markdown"
    }
  }
}
```

#### 9b. Пользователь не найден

```json
{
  "type": "message",
  "config": {
    "message": {
      "text": "❌ К сожалению, ваш номер не найден в системе.\n\nСделайте первую покупку на сайте, чтобы зарегистрироваться в программе лояльности."
    }
  }
}
```

---

## Workflow 2: Проверка баланса

### Схема

```
[/balance] → [check_user_linked] → [condition: linked?]
                                      ├─ true → [get_balance] → [show_balance]
                                      └─ false → [show_not_registered]
```

### Конфигурация нод

#### 1. Триггер: Команда /balance

```json
{
  "type": "trigger.command",
  "config": {
    "trigger.command": {
      "command": "balance"
    }
  }
}
```

#### 2. Проверка привязки

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

#### 3. Условие: Привязан?

```json
{
  "type": "flow.condition",
  "config": {
    "flow.condition": {
      "leftOperand": "{{isLinked}}",
      "operator": "equals",
      "rightOperand": "true"
    }
  }
}
```

#### 4a. Получение баланса

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

#### 5a. Отображение баланса

```json
{
  "type": "message.keyboard.inline",
  "config": {
    "message.keyboard.inline": {
      "text": "💰 **Ваш баланс бонусов**\n\nТекущий баланс: **{{currentBalance}}** бонусов\n\n1 бонус = 1 рубль при оплате",
      "buttons": [
        [
          { "text": "🛍 Перейти в магазин", "url": "https://example.com/shop" }
        ],
        [
          { "text": "📖 Правила программы", "callbackData": "show_rules" }
        ]
      ],
      "parseMode": "Markdown"
    }
  }
}
```

#### 5b. Не зарегистрирован

```json
{
  "type": "message",
  "config": {
    "message": {
      "text": "❌ Вы не зарегистрированы в программе лояльности.\n\nИспользуйте /start для регистрации"
    }
  }
}
```

---

## Workflow 3: Начисление бонусов (Webhook)

### Схема

```
[webhook: purchase] → [parse_data] → [find_user] → [condition: found?]
                                                      ├─ true → [calculate_bonuses]
                                                      │            ↓
                                                      │         [add_bonuses]
                                                      │            ↓
                                                      │         [send_notification]
                                                      └─ false → [log_error]
```

### Webhook URL

```
POST https://your-domain.com/api/webhook/{projectId}/{workflowId}
Headers:
  Content-Type: application/json
  X-Webhook-Secret: YOUR_SECRET

Body:
{
  "action": "purchase",
  "payload": {
    "email": "user@example.com",
    "amount": 5000,
    "orderId": "ORD-12345"
  }
}
```

### Конфигурация нод

#### 1. Триггер: Webhook

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

#### 2. Сохранение данных в переменные

```json
{
  "type": "action.set_variable",
  "config": {
    "action.set_variable": {
      "name": "purchaseAmount",
      "value": "{{webhook.body.payload.amount}}",
      "scope": "session"
    }
  }
}
```

#### 3. Поиск пользователя по email

```json
{
  "type": "action.find_user_by_contact",
  "config": {
    "action.find_user_by_contact": {
      "contactType": "email",
      "contactValue": "{{webhook.body.payload.email}}",
      "saveToVariable": "foundUser"
    }
  }
}
```

#### 4. Условие: Найден?

```json
{
  "type": "flow.condition",
  "config": {
    "flow.condition": {
      "leftOperand": "{{foundUser}}",
      "operator": "not_equals",
      "rightOperand": "null"
    }
  }
}
```

#### 5. Расчёт бонусов (5% от суммы)

```json
{
  "type": "action.set_variable",
  "config": {
    "action.set_variable": {
      "name": "bonusAmount",
      "value": "{{purchaseAmount * 0.05}}",
      "scope": "session"
    }
  }
}
```

#### 6. Начисление бонусов (через API)

```json
{
  "type": "action.api_request",
  "config": {
    "action.api_request": {
      "url": "https://your-domain.com/api/bonuses/add",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer {{api.token}}"
      },
      "body": "{\"userId\": \"{{foundUser.id}}\", \"amount\": {{bonusAmount}}, \"source\": \"purchase\", \"orderId\": \"{{webhook.body.payload.orderId}}\"}"
    }
  }
}
```

#### 7. Уведомление пользователю

```json
{
  "type": "action.send_notification",
  "config": {
    "action.send_notification": {
      "channel": "telegram",
      "recipient": "{{foundUser.telegramId}}",
      "message": "🎉 Вам начислено {{bonusAmount}} бонусов за покупку на сумму {{purchaseAmount}} ₽!\n\nВаш новый баланс: {{foundUser.balance + bonusAmount}} бонусов"
    }
  }
}
```

---

## Интеграция с сайтом (Tilda)

### JavaScript код для отправки webhook

```javascript
// Добавить в Zero Block после успешной оплаты
function sendPurchaseWebhook(email, amount, orderId) {
  fetch('https://your-domain.com/api/webhook/PROJECT_ID/WORKFLOW_ID', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': 'YOUR_SECRET_KEY'
    },
    body: JSON.stringify({
      action: 'purchase',
      payload: {
        email: email,
        amount: amount,
        orderId: orderId
      }
    })
  })
  .then(response => response.json())
  .then(data => console.log('Webhook sent:', data))
  .catch(error => console.error('Webhook error:', error));
}

// Вызов после оплаты
sendPurchaseWebhook('user@example.com', 5000, 'ORD-12345');
```

---

## Тестирование

### 1. Тест регистрации

```bash
# В Telegram боте
/start
# Нажать "Поделиться контактом"
# Проверить сообщение о привязке
```

### 2. Тест проверки баланса

```bash
/balance
# Должен показать текущий баланс
```

### 3. Тест webhook

```bash
curl -X POST https://your-domain.com/api/webhook/PROJECT_ID/WORKFLOW_ID \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{
    "action": "purchase",
    "payload": {
      "email": "test@example.com",
      "amount": 1000,
      "orderId": "TEST-001"
    }
  }'
```

---

## Метрики и мониторинг

### Ключевые метрики

1. **Конверсия регистрации**: % пользователей, завершивших регистрацию
2. **Активность**: Количество проверок баланса в день
3. **Начисления**: Сумма начисленных бонусов за период
4. **Ошибки webhook**: Количество неудачных webhook запросов

### Мониторинг

- Отслеживайте логи выполнения workflow в дашборде
- Настройте алерты на критические ошибки
- Анализируйте время выполнения каждого шага

---

## Расширения

### Дополнительные функции

1. **История операций**: Добавить команду `/history` для просмотра транзакций
2. **Реферальная программа**: Бонусы за приглашение друзей
3. **Уровни лояльности**: Bronze, Silver, Gold с разными процентами начисления
4. **Акции**: Временные повышенные начисления
5. **Списание бонусов**: Интеграция с корзиной для оплаты бонусами

---

## Заключение

Эта система демонстрирует полный цикл программы лояльности:
- ✅ Регистрация через Telegram
- ✅ Привязка к существующему аккаунту
- ✅ Автоматическое начисление бонусов
- ✅ Проверка баланса
- ✅ Уведомления пользователей

Система легко масштабируется и может быть адаптирована под любой бизнес.

