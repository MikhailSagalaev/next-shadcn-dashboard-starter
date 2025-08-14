# 🚀 Быстрый запуск webhook тестирования

## ✅ Текущий статус
- ✅ Next.js сервер запущен на `localhost:5006`
- ✅ Проект полностью готов к работе
- ✅ Ngrok установлен

## 🌐 Создание публичного URL (2 минуты)

### 1️⃣ Откройте новый терминал
```
Ctrl + Shift + P -> "Terminal: Create New Terminal"
```

### 2️⃣ Запустите ngrok
```bash
ngrok http 5006
```

### 3️⃣ Скопируйте HTTPS URL
Ngrok покажет что-то вроде:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5006
```

## 🔗 Настройка webhook'а

### Для Tilda:
```
https://abc123.ngrok.io/api/webhook/[ваш-webhook-secret]
```

### Для других сервисов:
```
https://abc123.ngrok.io/api/webhook/[ваш-webhook-secret]
```

## 🧪 Тестирование

### Автоматический тест:
```bash
pnpm test:webhook
```

### Ручной тест через curl:
```bash
curl -X POST https://abc123.ngrok.io/api/webhook/test-secret \
  -H "Content-Type: application/json" \
  -d '{"action": "purchase", "userEmail": "test@test.com", "purchaseAmount": 1000, "orderId": "TEST_001"}'
```

## 📋 Полезные команды

```bash
# Проверить статус сервера
curl http://localhost:5006

# Перезапустить dev сервер
pnpm dev

# Создать новый туннель
pnpm tunnel

# Проверить сборку для продакшена
pnpm build

# Деплой на Vercel
pnpm deploy:vercel
```

## 🎯 Следующие шаги

1. **Получите webhook secret** из админ-панели проекта
2. **Настройте webhook** в Tilda/WooCommerce/другом сервисе
3. **Отправьте тестовый заказ**
4. **Проверьте логи** в терминале Next.js

---
**💡 Совет**: Оставьте ngrok и Next.js работающими в фоне во время тестирования!
