# МойСклад Direct - Финальное исправление вебхуков

## ✅ Что исправлено

### 1. Добавлена колонка в БД
**Файл:** `prisma/migrations/20260306_add_moysklad_direct_counterparty_id/migration.sql`

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "moysklad_direct_counterparty_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_moysklad_direct_counterparty_id_key" ON "users"("moysklad_direct_counterparty_id");
```

### 2. Исправлено дублирование вебхуков
**Файл:** `src/app/api/projects/[id]/integrations/moysklad-direct/webhooks/route.ts`

**Изменения:**
- Перед созданием вебхуков проверяем существующие
- Пропускаем уже созданные вебхуки
- Возвращаем информацию о пропущенных вебхуках

```typescript
// Get existing webhooks first
const existingResponse = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
  headers: { Authorization: `Bearer ${apiToken}` }
});

const existingData = await existingResponse.json();
const existingWebhooks = existingData.rows.filter(
  (webhook: any) => webhook.url === webhookUrl
);

// Create a map for quick lookup
const existingMap = new Map(
  existingWebhooks.map((w: any) => [`${w.entityType}_${w.action}`, w])
);

// Check if webhook already exists before creating
for (const config of WEBHOOK_CONFIGS) {
  const key = `${config.entityType}_${config.action}`;
  
  if (existingMap.has(key)) {
    skipped.push({ ...config, skipped: true });
    continue;
  }
  
  // Create webhook...
}
```

### 3. Автозагрузка вебхуков в UI
**Файл:** `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/webhook-manager.tsx`

**Изменения:**
- Добавлен `useEffect` для автоматической загрузки при монтировании
- Вебхуки загружаются сразу при открытии страницы

```typescript
// Auto-load webhooks on mount
useEffect(() => {
  fetchWebhooks();
}, [projectId]);
```

## 🚀 Инструкции для деплоя на сервер

### Шаг 1: Подключиться к серверу
```bash
ssh root@gupil.ru
cd /var/www/bonus-app
```

### Шаг 2: Получить изменения
```bash
git pull origin main
```

### Шаг 3: Применить миграцию БД
```bash
psql -U postgres -d bonus_system -f prisma/migrations/20260306_add_moysklad_direct_counterparty_id/migration.sql
```

### Шаг 4: Перезапустить приложение
```bash
pm2 restart bonus-app
```

### Шаг 5: Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

## ✅ Результат

После применения исправлений:

1. ✅ **Колонка в БД создана** - `users.moysklad_direct_counterparty_id` существует
2. ✅ **Вебхуки не дублируются** - проверка существующих перед созданием
3. ✅ **Вебхуки загружаются автоматически** - при открытии страницы интеграции
4. ✅ **Синхронизация работает** - нет ошибок Prisma

## 🎯 Как проверить

1. Открыть страницу интеграции МойСклад Direct
2. Вебхуки должны загрузиться автоматически (5 штук)
3. При нажатии "Создать вебхуки" - уже существующие будут пропущены
4. Синхронизация должна работать без ошибок

## 📊 Статус

- **Миграция БД:** ✅ Готова к применению
- **Проверка дубликатов:** ✅ Реализована
- **Автозагрузка UI:** ✅ Реализована
- **Готово к деплою:** ✅ Да
