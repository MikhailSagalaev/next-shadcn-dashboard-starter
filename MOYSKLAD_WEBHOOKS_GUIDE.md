# Настройка вебхуков МойСклад

## Документация
- [Вебхуки API 1.2](https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/#suschnosti-vebhuk)
- [Работа с вебхуками](https://dev.moysklad.ru/doc/api/vendor/1.0/#rabota-s-webhkami)

## Формат вебхука от МойСклад

МойСклад отправляет POST запрос на ваш URL в формате:

```json
{
  "auditContext": {
    "meta": {
      "type": "employee",
      "href": "https://api.moysklad.ru/api/remap/1.2/entity/employee/{id}"
    },
    "uid": "admin@example"
  },
  "events": [
    {
      "meta": {
        "type": "bonustransaction",
        "href": "https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction/{id}"
      },
      "action": "CREATE",
      "accountId": "..."
    }
  ],
  "meta": {
    "type": "webhook",
    "href": "https://api.moysklad.ru/api/remap/1.2/entity/webhook/{id}"
  }
}
```

### Поля события:
- `action` - тип действия: `CREATE`, `UPDATE`, `DELETE`
- `meta.type` - тип сущности: `bonustransaction`, `counterparty`, `demand`, и т.д.
- `meta.href` - URL для получения полных данных сущности
- `accountId` - ID аккаунта МойСклад

## Создание вебхука через API

### 1. Получить токен доступа
Используйте токен из настроек интеграции в нашей системе.

### 2. Создать вебхук для бонусных операций

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

### 3. Создать вебхук для контрагентов (опционально)

```bash
curl -X POST https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gupil.ru/api/webhook/moysklad-direct/cmmf0rf0j00049eh2d926hx3t",
    "action": "CREATE",
    "entityType": "counterparty"
  }'
```

### 4. Создать вебхук для продаж (опционально)

```bash
curl -X POST https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gupil.ru/api/webhook/moysklad-direct/cmmf0rf0j00049eh2d926hx3t",
    "action": "CREATE",
    "entityType": "demand"
  }'
```

## Типы сущностей (entityType)

Для бонусной системы нужны:
- `bonustransaction` - бонусные операции (начисление/списание)
- `counterparty` - контрагенты (клиенты)
- `demand` - отгрузки/продажи
- `customerorder` - заказы покупателей

## Типы действий (action)

- `CREATE` - создание новой записи
- `UPDATE` - обновление существующей записи
- `DELETE` - удаление записи

## Проверка существующих вебхуков

```bash
curl -X GET https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

Ответ:
```json
{
  "context": {...},
  "meta": {...},
  "rows": [
    {
      "meta": {...},
      "id": "webhook-id",
      "accountId": "...",
      "entityType": "bonustransaction",
      "url": "https://gupil.ru/api/webhook/moysklad-direct/...",
      "method": "POST",
      "enabled": true,
      "action": "CREATE"
    }
  ]
}
```

## Удаление вебхука

```bash
curl -X DELETE https://api.moysklad.ru/api/remap/1.2/entity/webhook/{webhook-id} \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Обработка вебхуков в нашей системе

Наш endpoint: `https://gupil.ru/api/webhook/moysklad-direct/{projectId}`

### Что делает наш обработчик:

1. **Проверяет интеграцию** - существует ли и активна ли
2. **Парсит события** - извлекает массив events
3. **Фильтрует по типу** - обрабатывает только нужные типы сущностей
4. **Загружает полные данные** - делает запрос к МойСклад API по href
5. **Синхронизирует** - обновляет данные в нашей БД
6. **Логирует** - сохраняет результат в `moysklad_direct_sync_logs`

### Поддерживаемые типы событий:

#### bonustransaction (бонусные операции)
- Начисление бонусов клиенту
- Списание бонусов
- Синхронизация баланса

#### counterparty (контрагенты)
- Создание нового клиента
- Обновление данных клиента
- Синхронизация с User в нашей системе

#### demand (продажи)
- Новая продажа
- Автоматическое начисление бонусов
- Обновление истории покупок

## Тестирование вебхука

### Вручную отправить тестовое событие:

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

### Проверить логи:

```powershell
pm2 logs bonus-app | grep moysklad-direct-webhook
```

Должно быть:
```
Webhook received from МойСклад
Processing bonus transaction event
Webhook processed
```

## Важные моменты

### 1. Безопасность
- МойСклад НЕ отправляет подпись в заголовках
- Валидация происходит через уникальный URL с projectId
- URL должен быть HTTPS

### 2. Retry политика
- МойСклад повторяет отправку при ошибке
- Максимум 3 попытки
- Интервал между попытками увеличивается

### 3. Timeout
- МойСклад ждет ответ максимум 10 секунд
- Наш endpoint должен отвечать быстро
- Тяжелые операции делаем асинхронно

### 4. Ответ от нашего endpoint
```json
{
  "message": "Webhook processed",
  "processed": 1,
  "errors": 0,
  "processingTime": 234
}
```

## Troubleshooting

### Вебхук не приходит
1. Проверить что вебхук создан: `GET /api/remap/1.2/entity/webhook`
2. Проверить что `enabled: true`
3. Проверить URL - должен быть точным
4. Проверить что интеграция активна в нашей системе

### Ошибка 404
- Проверить projectId в URL
- Проверить что интеграция существует в БД

### Ошибка 500
- Проверить логи: `pm2 logs bonus-app`
- Проверить что Prisma Client обновлен: `npx prisma generate`

### События не обрабатываются
- Проверить тип события в логах
- Убедиться что наш код поддерживает этот тип
- Проверить что href корректный

## Следующие шаги

1. ✅ Создать вебхук для bonustransaction
2. ✅ Протестировать отправку события
3. ✅ Проверить логи синхронизации
4. ✅ Создать вебхуки для других типов (опционально)
5. ✅ Настроить мониторинг ошибок

## Полезные команды

```powershell
# Список всех вебхуков
curl -X GET https://api.moysklad.ru/api/remap/1.2/entity/webhook \
  -H "Authorization: Bearer TOKEN"

# Удалить все вебхуки (осторожно!)
# Сначала получить список, потом удалить каждый по ID

# Проверить логи нашего сервера
pm2 logs bonus-app --lines 100 | grep webhook

# Проверить последние синхронизации в БД
# Через Prisma Studio или SQL запрос
```
