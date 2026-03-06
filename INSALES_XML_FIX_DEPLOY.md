# InSales XML Webhook Fix - Деплой

**Дата:** 2026-03-05  
**Commit:** 478d6c7  
**Проблема:** InSales отправляет webhooks в XML формате, а код ожидал JSON

---

## 🐛 Что было исправлено

### Проблема
InSales отправляет webhooks в формате XML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<webhooks type="array">
  <webhook>
    <topic>orders/create</topic>
    <id>24515593</id>
    ...
  </webhook>
</webhooks>
```

Код пытался парсить как JSON → ошибка 500.

### Решение
Добавлена функция `parseInSalesXML()` которая:
- Парсит XML от InSales
- Извлекает данные заказа (id, number, total_price, client)
- Извлекает данные клиента (id, email, phone, name)
- Поддерживает fallback на JSON

---

## 🚀 Деплой на сервер

### Шаг 1: Подключиться к серверу
```bash
ssh root@89.111.174.71
```

### Шаг 2: Перейти в директорию проекта
```bash
cd /opt/next-shadcn-dashboard-starter
```

### Шаг 3: Получить изменения
```bash
git pull
```

### Шаг 4: Сгенерировать Prisma Client
```bash
npx prisma generate
```

### Шаг 5: Перезапустить приложение
```bash
pm2 restart bonus-app
```

### Шаг 6: Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

---

## ✅ Проверка работы

### 1. Проверить что приложение запущено
```bash
pm2 status
```

Должно быть:
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode        │ ↺       │ status  │ cpu      │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ bonus-app    │ fork        │ 0       │ online  │ 0%       │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### 2. Создать тестовый заказ в InSales
- Откройте админку InSales
- Создайте тестовый заказ
- Webhook должен отправиться автоматически

### 3. Проверить логи webhook
- Откройте: https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales
- Должна появиться запись с событием `orders/create`
- Статус должен быть 200 OK
- Ошибок быть не должно

### 4. Проверить логи приложения
```bash
pm2 logs bonus-app --lines 100 | grep "insales-webhook"
```

Должно быть:
```
InSales webhook received
InSales webhook parsed
InSales webhook processed
```

---

## 📊 Что изменилось

### Файлы
- `src/app/api/insales/webhook/[projectId]/route.ts` - добавлен парсинг XML
- `INSALES_TASK_SHORT.md` - краткая задача для разработчика
- `INSALES_FINAL_SUMMARY.md` - финальное резюме

### Функционал
- ✅ Парсинг XML webhooks от InSales
- ✅ Извлечение данных заказа
- ✅ Извлечение данных клиента
- ✅ Fallback на JSON (на случай изменения формата)
- ✅ Детальное логирование для отладки

---

## 🔍 Отладка

### Если webhook не работает

**1. Проверить логи приложения:**
```bash
pm2 logs bonus-app --err --lines 100
```

**2. Проверить что webhook настроен в InSales:**
- URL: `https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt`
- Событие: `orders/create` и `clients/create`
- Формат: JSON (InSales все равно отправит XML)

**3. Проверить интеграцию активна:**
```bash
# В psql
SELECT "isActive", "projectId" FROM "InSalesIntegration" WHERE "projectId" = 'cmilhq0y600099e7uraiowrmt';
```

Должно быть `isActive = true`.

**4. Проверить что Prisma Client сгенерирован:**
```bash
ls -la node_modules/.prisma/client/
```

Должна быть директория с файлами.

### Если ошибка "Property 'inSalesIntegration' does not exist"

Это значит Prisma Client не сгенерирован. Выполните:
```bash
npx prisma generate
pm2 restart bonus-app
```

---

## 📝 Changelog

### [2026-03-05] - XML Webhook Parsing Fix

**Исправлено:**
- InSales webhooks теперь корректно парсятся (XML формат)
- Добавлена функция `parseInSalesXML()`
- Добавлена поддержка fallback на JSON
- Улучшено логирование для отладки

**Файлы:**
- `src/app/api/insales/webhook/[projectId]/route.ts`

**Commit:** 478d6c7

---

## 🎯 Следующие шаги

После деплоя:
1. ✅ Код развернут на сервере
2. ⏳ Разработчик InSales настраивает webhooks
3. ⏳ Разработчик InSales вставляет код виджета
4. ⏳ Тестирование на реальном магазине

**Передайте разработчику:** `INSALES_TASK_SHORT.md`

---

**Статус:** ✅ Готово к деплою  
**Время деплоя:** ~5 минут  
**Риски:** Низкие (только парсинг данных)
