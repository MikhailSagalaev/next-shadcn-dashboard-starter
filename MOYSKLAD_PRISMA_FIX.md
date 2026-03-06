# Исправление ошибки Prisma Client

## Проблема
```
Property 'moySkladDirectIntegration' does not exist on type 'PrismaClient'
Property 'moySkladDirectSyncLog' does not exist on type 'PrismaClient'
```

## Причина
После применения миграции БД не был перегенерирован Prisma Client. TypeScript не видит новые модели.

## Решение

### На сервере выполнить:

```powershell
# 1. Перегенерировать Prisma Client
npx prisma generate

# 2. Перезапустить приложение
pm2 restart bonus-app

# 3. Проверить логи
pm2 logs bonus-app --lines 50
```

### Проверка работы

После перезапуска тест подключения должен работать:
- Открыть: https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
- Нажать "Тест подключения"
- Должно появиться: ✅ "Подключение успешно"

## Что было исправлено в коде

### 1. Test endpoint (async params)
```typescript
// Было
const { id: projectId } = await params;

// Стало
const resolvedParams = await params;
const projectId = resolvedParams.id;
```

### 2. Webhook endpoint (убрана валидация подписи)
МойСклад webhooks НЕ используют подпись в заголовках согласно документации:
https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/webhook

Валидация происходит через уникальный URL с projectId.

### 3. Webhook endpoint (async params)
```typescript
// Было
{ params }: { params: { projectId: string } }

// Стало
{ params }: { params: Promise<{ projectId: string }> }
const resolvedParams = await params;
const projectId = resolvedParams.projectId;
```

## Формат вебхуков МойСклад

Согласно официальной документации, вебхуки отправляются в формате:

```json
{
  "auditContext": {
    "meta": {
      "type": "employee",
      "href": "https://api.moysklad.ru/api/remap/1.2/entity/employee/..."
    },
    "uid": "admin@example"
  },
  "events": [
    {
      "meta": {
        "type": "bonustransaction",
        "href": "https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction/..."
      },
      "action": "CREATE",
      "accountId": "..."
    }
  ],
  "meta": {
    "type": "webhook",
    "href": "https://api.moysklad.ru/api/remap/1.2/entity/webhook/..."
  }
}
```

## Следующие шаги

После исправления можно настроить вебхуки в МойСклад через JSON API:

```bash
POST https://api.moysklad.ru/api/remap/1.2/entity/webhook
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "url": "https://gupil.ru/api/webhook/moysklad-direct/cmmf0rf0j00049eh2d926hx3t",
  "action": "CREATE",
  "entityType": "bonustransaction"
}
```

Или через UI МойСклад (если доступно в вашем тарифе).
