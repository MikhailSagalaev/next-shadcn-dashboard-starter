# Быстрая настройка вебхуков МойСклад

## Автоматическая настройка (рекомендуется)

### 1. Создать вебхуки

```powershell
npx tsx scripts/setup-moysklad-webhooks.ts create cmmf0rf0j00049eh2d926hx3t
```

Это создаст 5 вебхуков:
- ✅ bonustransaction (CREATE) - начисление бонусов
- ✅ bonustransaction (UPDATE) - обновление бонусов
- ✅ counterparty (CREATE) - новый клиент
- ✅ counterparty (UPDATE) - обновление клиента
- ✅ demand (CREATE) - новая продажа

### 2. Проверить созданные вебхуки

```powershell
npx tsx scripts/setup-moysklad-webhooks.ts list cmmf0rf0j00049eh2d926hx3t
```

### 3. Удалить вебхуки (если нужно)

```powershell
npx tsx scripts/setup-moysklad-webhooks.ts delete cmmf0rf0j00049eh2d926hx3t
```

## Ручная настройка через curl

### Создать вебхук для бонусов

```bash
curl -X POST https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gupil.ru/api/webhook/moysklad-direct/cmmf0rf0j00049eh2d926hx3t",
    "action": "CREATE",
    "entityType": "bonustransaction"
  }'
```

### Список всех вебхуков

```bash
curl -X GET https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Удалить вебхук

```bash
curl -X DELETE https://api.moysklad.ru/api/remap/1.2/entity/webhook/{WEBHOOK_ID} \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Тестирование

### 1. Отправить тестовое событие

```bash
curl -X POST https://gupil.ru/api/webhook/moysklad-direct/cmmf0rf0j00049eh2d926hx3t \
  -H "Content-Type: application/json" \
  -d '{
    "auditContext": {
      "meta": {
        "type": "employee",
        "href": "https://api.moysklad.ru/api/remap/1.2/entity/employee/test"
      },
      "uid": "admin@test"
    },
    "events": [
      {
        "meta": {
          "type": "bonustransaction",
          "href": "https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction/test-id"
        },
        "action": "CREATE",
        "accountId": "test-account"
      }
    ]
  }'
```

### 2. Проверить логи

```powershell
pm2 logs bonus-app --lines 50 | Select-String "moysklad-direct-webhook"
```

Должно быть:
```
✅ Webhook received from МойСклад
✅ Processing bonus transaction event
✅ Webhook processed
```

### 3. Проверить в UI

Открыть: https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct

В разделе "Последние синхронизации" должна появиться запись.

## Что делает каждый вебхук

### bonustransaction (CREATE/UPDATE)
- Получает событие о начислении/списании бонусов
- Загружает полные данные транзакции из МойСклад
- Синхронизирует с нашей БД
- Обновляет баланс пользователя

### counterparty (CREATE/UPDATE)
- Получает событие о создании/обновлении клиента
- Создает или обновляет User в нашей системе
- Синхронизирует контактные данные
- Связывает с бонусным счетом

### demand (CREATE)
- Получает событие о новой продаже
- Автоматически начисляет бонусы по правилам проекта
- Создает Transaction в нашей БД
- Обновляет статистику

## Troubleshooting

### Вебхук не создается

**Ошибка:** `401 Unauthorized`
- Проверить API токен в интеграции
- Токен должен иметь права на создание вебхуков

**Ошибка:** `400 Bad Request`
- Проверить формат URL (должен быть HTTPS)
- Проверить что entityType корректный

### Вебхук не срабатывает

1. Проверить что вебхук создан:
```powershell
npx tsx scripts/setup-moysklad-webhooks.ts list cmmf0rf0j00049eh2d926hx3t
```

2. Проверить что `enabled: true`

3. Проверить логи сервера:
```powershell
pm2 logs bonus-app --lines 100
```

4. Проверить что интеграция активна в БД

### События не обрабатываются

1. Проверить тип события в логах
2. Убедиться что наш код поддерживает этот тип
3. Проверить что href корректный и доступен

## Полезные ссылки

- [Документация МойСклад по вебхукам](https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/#suschnosti-vebhuk)
- [Полный гайд](MOYSKLAD_WEBHOOKS_GUIDE.md)
- [Документация интеграции](docs/moysklad-direct-api-integration.md)
