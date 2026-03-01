# 🔧 Исправление: [400] Bad request: Invalid JSON (Tilda)

## ❌ Проблема

При настройке webhook в Tilda вы получаете ошибку:
```json
{
  "error": "Invalid JSON"
}
```

## ✅ Решение

Проблема была в том, что **Tilda отправляет данные в формате `application/x-www-form-urlencoded`**, а не JSON.

### Что исправлено:

1. **Webhook endpoint** теперь поддерживает оба формата:
   - `application/json` - для кастомных интеграций
   - `application/x-www-form-urlencoded` - для Tilda
   - `multipart/form-data` - для других платформ

2. **Автоматический парсинг** поля `payment` как JSON-строки

3. **Улучшенное логирование** для отладки

## 🚀 Как использовать

### 1. Обновите систему

Изменения уже применены в коде. Просто перезапустите приложение:

```powershell
# Остановите текущий процесс (Ctrl+C)
# Запустите заново
yarn dev
```

### 2. Настройте webhook в Tilda

1. Откройте редактор страницы Tilda
2. Выберите блок с формой оплаты (T706)
3. Перейдите в "Оплата и доставка" → "Webhook для уведомлений"
4. Вставьте URL:
   ```
   https://your-domain.com/api/webhook/YOUR_WEBHOOK_SECRET
   ```

### 3. Проверьте работу

Tilda автоматически отправит тестовый запрос. Вы должны увидеть ✅ зеленую галочку.

## 🧪 Тестирование

### Вариант 1: Через тестовую страницу

Откройте в браузере:
```
http://localhost:3000/test-tilda-webhook.html
```

1. Вставьте ваш webhook URL
2. Нажмите "Отправить Webhook"
3. Проверьте логи

### Вариант 2: Через реальный заказ

1. Сделайте тестовый заказ на вашем сайте Tilda
2. Проверьте логи webhook в админ панели

## 📦 Формат данных

Tilda отправляет данные так:
```
name=Иван Иванов
email=test@example.com
phone=+79991234567
payment={"amount":"5000","orderid":"ORDER-123","products":[...]}
appliedBonuses=0
```

Система автоматически:
1. Парсит form data
2. Извлекает поле `payment` как JSON-строку
3. Парсит `payment` в объект
4. Обрабатывает заказ

## 🔍 Отладка

### Проверка логов

В админ панели:
1. Перейдите в "Webhook Logs"
2. Найдите последние запросы
3. Проверьте:
   - `status`: 200 ✅
   - `success`: true ✅
   - `body`: содержит данные заказа

### Типичные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Invalid webhook secret | Неправильный secret в URL | Проверьте webhook secret в настройках проекта |
| User not found | Пользователь не зарегистрирован | Убедитесь, что виджет установлен и пользователь зарегистрирован |
| USER_NOT_ACTIVE | Пользователь не активирован | Привяжите аккаунт в Telegram или переключите режим на WITHOUT_BOT |

## 📚 Подробная документация

- [Tilda Webhook Setup](./docs/tilda-webhook-setup.md) - полная инструкция
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - решение других проблем
- [Webhook Integration](./docs/webhook-integration.md) - общая документация по webhook
- [API Reference](./docs/api.md) - описание API

## ✅ Готово!

Webhook теперь работает с Tilda. Если проблема не решена, проверьте [Troubleshooting](./docs/TROUBLESHOOTING.md).
