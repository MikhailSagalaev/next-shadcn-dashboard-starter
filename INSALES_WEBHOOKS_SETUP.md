# InSales Webhooks - Детальная инструкция по настройке

## 🎯 Проблема: Где находятся Webhooks в InSales?

В InSales webhooks настраиваются **НЕ через "Настройки"**, а через раздел **"Расширения"** (приложения).

---

## 📍 Способ 1: Через интерфейс "Расширения"

### Шаг 1: Открыть раздел Расширения
1. В левом меню админ-панели найдите **"Расширения"**
2. Или откройте напрямую: `https://[ваш-магазин].myinsales.ru/admin/applications`

### Шаг 2: Найти раздел Webhooks
В зависимости от версии InSales, webhooks могут быть в:
- **"Webhooks"** (отдельный раздел)
- **"Приложения"** → **"Создать приложение"**
- **"Интеграции"** → **"Webhooks"**

### Шаг 3: Создать webhook
1. Нажмите **"Добавить webhook"** или **"Создать приложение"**
2. Заполните форму:

**Основные настройки:**
- **Название:** Gupil Bonus System
- **Описание:** Система бонусов и лояльности
- **URL:** `https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt`
- **Формат:** JSON
- **Метод:** POST

**События (Topics):**
- ✅ `orders/create` - Создание заказа
- ✅ `clients/create` - Создание клиента
- ⚪ `orders/update` - Обновление заказа (опционально)

### Шаг 4: Активировать
1. Сохраните настройки
2. Убедитесь, что webhook **активен** (переключатель включен)
3. Проверьте статус: должен быть "Активно"

---

## 📍 Способ 2: Через InSales API (рекомендуется)

Если в интерфейсе нет возможности создать webhooks, используйте API.

### Подготовка
Вам понадобятся:
- **API Key** (ID приложения)
- **API Password** (Пароль приложения)
- **Shop Domain** (например: `testshop.myinsales.ru`)

### Создание webhook для заказов

```bash
curl -X POST "https://[ваш-магазин].myinsales.ru/admin/webhooks.json" \
  -H "Content-Type: application/json" \
  -u "[API_KEY]:[API_PASSWORD]" \
  -d '{
    "webhook": {
      "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
      "topic": "orders/create",
      "format_type": "json"
    }
  }'
```

**Пример с реальными данными:**
```bash
curl -X POST "https://testshop.myinsales.ru/admin/webhooks.json" \
  -H "Content-Type: application/json" \
  -u "5d7533619e1a01669d8b2e5a50b1e82a:31ef1322e03069b9387180b67aebc2f7" \
  -d '{
    "webhook": {
      "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
      "topic": "orders/create",
      "format_type": "json"
    }
  }'
```

### Создание webhook для клиентов

```bash
curl -X POST "https://[ваш-магазин].myinsales.ru/admin/webhooks.json" \
  -H "Content-Type: application/json" \
  -u "[API_KEY]:[API_PASSWORD]" \
  -d '{
    "webhook": {
      "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
      "topic": "clients/create",
      "format_type": "json"
    }
  }'
```

### Проверка созданных webhooks

```bash
curl -X GET "https://[ваш-магазин].myinsales.ru/admin/webhooks.json" \
  -H "Content-Type: application/json" \
  -u "[API_KEY]:[API_PASSWORD]"
```

**Ожидаемый ответ:**
```json
{
  "webhooks": [
    {
      "id": 123456,
      "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
      "topic": "orders/create",
      "format_type": "json",
      "created_at": "2026-03-05T12:00:00Z",
      "updated_at": "2026-03-05T12:00:00Z"
    },
    {
      "id": 123457,
      "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
      "topic": "clients/create",
      "format_type": "json",
      "created_at": "2026-03-05T12:00:00Z",
      "updated_at": "2026-03-05T12:00:00Z"
    }
  ]
}
```

### Удаление webhook (если нужно)

```bash
curl -X DELETE "https://[ваш-магазин].myinsales.ru/admin/webhooks/[WEBHOOK_ID].json" \
  -H "Content-Type: application/json" \
  -u "[API_KEY]:[API_PASSWORD]"
```

---

## 📍 Способ 3: Через Postman

### Шаг 1: Импортировать коллекцию
1. Откройте Postman
2. Создайте новый request

### Шаг 2: Настроить авторизацию
- **Type:** Basic Auth
- **Username:** `[API_KEY]`
- **Password:** `[API_PASSWORD]`

### Шаг 3: Создать webhook
**Request:**
- **Method:** POST
- **URL:** `https://[ваш-магазин].myinsales.ru/admin/webhooks.json`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "webhook": {
    "address": "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt",
    "topic": "orders/create",
    "format_type": "json"
  }
}
```

### Шаг 4: Отправить запрос
Нажмите **Send**. Должен вернуться статус `201 Created`.

---

## 🧪 Тестирование webhooks

### Тест 1: Проверка через curl

```bash
# Отправить тестовый webhook
curl -X POST "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "orders/create",
    "order": {
      "id": 999999,
      "number": "TEST-001",
      "client": {
        "email": "test@example.com",
        "phone": "+79991234567",
        "name": "Тест",
        "surname": "Тестов"
      },
      "total_price": "5000.00",
      "payment_status": "paid",
      "created_at": "2026-03-05T12:00:00Z"
    }
  }'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "userId": "...",
  "orderId": "TEST-001",
  "bonusAwarded": 500
}
```

### Тест 2: Проверка в Gupil Dashboard

1. Откройте: `https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales`
2. Прокрутите до раздела **"Логи Webhooks"**
3. Должна появиться запись с событием `orders/create`
4. Статус: "Успешно" (зеленый бейдж)
5. HTTP код: 200

### Тест 3: Создать реальный заказ

1. Откройте магазин в режиме инкогнито
2. Добавьте товар в корзину
3. Оформите заказ
4. Оплатите (или измените статус на "Оплачен" в админке)
5. Проверьте логи в Gupil - должен появиться webhook

---

## 🐛 Troubleshooting

### Проблема 1: "Webhooks не найдены в интерфейсе"

**Решение:**
- Используйте API (Способ 2)
- Или обратитесь в поддержку InSales для активации функции webhooks

### Проблема 2: "401 Unauthorized при создании через API"

**Причины:**
- Неверный API Key или Password
- Неправильный формат авторизации

**Решение:**
```bash
# Проверьте credentials
curl -X GET "https://[ваш-магазин].myinsales.ru/admin/account.json" \
  -u "[API_KEY]:[API_PASSWORD]"
```

Если возвращает данные аккаунта - credentials верные.

### Проблема 3: "Webhook создан, но не срабатывает"

**Проверка:**
1. Убедитесь, что webhook активен
2. Проверьте URL - должен быть точно `https://gupil.ru/api/insales/webhook/[projectId]`
3. Проверьте формат - должен быть `json`
4. Создайте тестовый заказ и проверьте логи InSales

**Логи InSales:**
1. Откройте webhook в админке
2. Должна быть вкладка "История" или "Логи"
3. Проверьте статус ответа - должен быть 200

### Проблема 4: "403 Forbidden"

**Причина:** Недостаточно прав у API ключа

**Решение:**
1. Пересоздайте API ключ
2. Убедитесь, что выбраны права:
   - ✅ Чтение заказов
   - ✅ Чтение клиентов
   - ✅ Webhooks (если есть такая опция)

---

## 📊 Доступные события (Topics)

InSales поддерживает следующие события для webhooks:

### Заказы
- `orders/create` - Создание заказа ✅ (используем)
- `orders/update` - Обновление заказа ⚪ (опционально)
- `orders/delete` - Удаление заказа

### Клиенты
- `clients/create` - Создание клиента ✅ (используем)
- `clients/update` - Обновление клиента
- `clients/delete` - Удаление клиента

### Товары
- `products/create` - Создание товара
- `products/update` - Обновление товара
- `products/delete` - Удаление товара

### Другие
- `collections/create` - Создание коллекции
- `collections/update` - Обновление коллекции
- `collections/delete` - Удаление коллекции

---

## 📝 Формат webhook payload

### orders/create

```json
{
  "event": "orders/create",
  "order": {
    "id": 123456,
    "number": "R-001",
    "client": {
      "id": 789,
      "email": "customer@example.com",
      "phone": "+79991234567",
      "name": "Иван",
      "surname": "Иванов"
    },
    "items": [
      {
        "id": 1,
        "product_id": 100,
        "variant_id": 200,
        "quantity": 2,
        "price": "1000.00",
        "total_price": "2000.00",
        "title": "Товар 1"
      }
    ],
    "total_price": "5000.00",
    "items_price": "4500.00",
    "delivery_price": "500.00",
    "payment_status": "paid",
    "fulfillment_status": "new",
    "created_at": "2026-03-05T12:00:00Z",
    "updated_at": "2026-03-05T12:00:00Z"
  }
}
```

### clients/create

```json
{
  "event": "clients/create",
  "client": {
    "id": 789,
    "email": "customer@example.com",
    "phone": "+79991234567",
    "name": "Иван",
    "surname": "Иванов",
    "middlename": "Петрович",
    "created_at": "2026-03-05T12:00:00Z",
    "updated_at": "2026-03-05T12:00:00Z"
  }
}
```

---

## ✅ Чеклист настройки

- [ ] API Key и Password получены
- [ ] Webhook создан (через UI или API)
- [ ] URL webhook: `https://gupil.ru/api/insales/webhook/[projectId]`
- [ ] События подписаны: `orders/create`, `clients/create`
- [ ] Формат: JSON
- [ ] Webhook активен
- [ ] Тестовый запрос отправлен и получен ответ 200
- [ ] Логи в Gupil показывают успешную обработку
- [ ] Реальный заказ создан и бонусы начислены

---

**Дата создания:** 2026-03-05  
**Версия:** 1.0  
**Статус:** ✅ Готово к использованию
