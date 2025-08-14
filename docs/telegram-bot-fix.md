# 🤖 Решение проблемы конфликта Telegram ботов

## 🚨 Описание проблемы

**Проблема**: Telegram бот работает либо в режиме команд (отвечает пользователям), либо в режиме рассылок, но не одновременно.

**Причина**: Конфликт между polling и webhook режимами. Согласно [документации Grammy](https://grammy.dev/guide/api), один токен бота не может одновременно работать в обоих режимах.

## 💡 Решение: Unified Webhook Architecture

### Что было изменено:

1. **Удален polling режим** - все боты теперь работают только через webhook
2. **Единая архитектура** - development и production используют webhook
3. **Устранен конфликт** - один токен = один режим = стабильная работа

### Ключевые изменения в `bot-manager.ts`:

```typescript
// БЫЛО: Конфликт между polling и webhook
if (isDev) {
  await bot.start(); // polling - блокирует рассылки
} else {
  await bot.api.setWebhook(); // webhook - блокирует команды
}

// СТАЛО: Единый webhook режим
// И development, и production используют webhook
const webhook = webhookCallback(bot, 'std/http');
await bot.api.setWebhook(webhookUrl);
```

## 🔧 Как это работает

### Development (localhost):
```
Telegram → Webhook → http://localhost:5006/api/telegram/webhook/[projectId] → Bot Handler
```

### Production:
```
Telegram → Webhook → https://yourdomain.com/api/telegram/webhook/[projectId] → Bot Handler
```

## ✅ Преимущества решения

1. **🎯 Одновременная работа**: Бот отвечает на команды И отправляет рассылки
2. **🔄 Отсутствие конфликтов**: Один режим для всех операций  
3. **📈 Надежность**: Нет ошибок 409 Conflict
4. **⚡ Производительность**: Webhook быстрее polling
5. **🔧 Простота**: Единая архитектура для всех сред

## 🛠️ Требования для работы

### Development:
- ✅ Локальный сервер на порту 5006
- ✅ Webhook endpoint `/api/telegram/webhook/[projectId]`

### Production:
- ✅ HTTPS домен (обязательно для webhook)
- ✅ Публично доступный webhook endpoint

## 📝 Проверка работоспособности

1. **Команды бота**: Отправьте `/start` боту - должен ответить
2. **Рассылки**: Создайте рассылку в админке - должна отправиться
3. **Логи**: Проверьте логи - не должно быть ошибок 409

## 🔍 Диагностика

### Проверка webhook:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Ожидаемый ответ:
```json
{
  "ok": true,
  "result": {
    "url": "https://yourdomain.com/api/telegram/webhook/PROJECT_ID",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## 📚 Ссылки на документацию

- [Grammy Bot API](https://grammy.dev/guide/api)
- [Grammy Webhooks vs Polling](https://grammy.dev/guide/long-polling-vs-webhooks)
- [Grammy Reliability Guide](https://grammy.dev/advanced/reliability)

## 🎉 Результат

После применения этого решения ваш Telegram бот будет:
- ✅ Отвечать на команды пользователей
- ✅ Отправлять массовые рассылки  
- ✅ Работать стабильно без конфликтов
- ✅ Поддерживать все функции одновременно
