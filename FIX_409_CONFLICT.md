# Исправление HTTP 409 Conflict

## Проблема
При создании интеграции МойСклад Direct возникает ошибка **409 Conflict** - запись уже существует в БД от предыдущих попыток.

## Решение

### Вариант 1: Через psql на сервере (рекомендуется)

```bash
# Подключиться к серверу
ssh user@gupil.ru

# Подключиться к БД
psql -U postgres -d bonus_system

# Выполнить очистку
DELETE FROM moysklad_direct_sync_logs 
WHERE integration_id IN (
  SELECT id FROM moysklad_direct_integrations 
  WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t'
);

DELETE FROM moysklad_direct_integrations 
WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';

# Проверить что удалено
SELECT * FROM moysklad_direct_integrations WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';

# Выйти из psql
\q
```

### Вариант 2: Через SQL файл

```bash
# На сервере
cd /path/to/bonus-app
psql -U postgres -d bonus_system -f CLEANUP_MOYSKLAD_DIRECT.sql
```

### Вариант 3: Через Prisma Studio (локально)

```bash
# Открыть Prisma Studio
npx prisma studio

# Найти таблицу moysklad_direct_integrations
# Найти запись с projectId = 'cmmf0rf0j00049eh2d926hx3t'
# Удалить запись через UI
```

## После очистки

1. Обновить страницу в браузере:
   ```
   https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
   ```

2. Создать интеграцию заново с параметрами:
   - **Account ID**: оставить пустым (опционально)
   - **API Token**: ваш Bearer токен
   - **Bonus Program ID**: ID программы лояльности

## Проверка

После создания интеграции проверить:

```sql
-- Должна быть одна запись
SELECT * FROM moysklad_direct_integrations 
WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';

-- Логи должны быть пустые (пока не было синхронизации)
SELECT * FROM moysklad_direct_sync_logs 
WHERE integration_id IN (
  SELECT id FROM moysklad_direct_integrations 
  WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t'
);
```

## Почему возникла проблема?

При предыдущих попытках создания интеграции запись была создана в БД, но из-за других ошибок (отсутствие таблиц, async params) процесс не завершился корректно. Теперь при попытке создать новую запись возникает конфликт уникального ключа `projectId`.

## Предотвращение в будущем

В коде API route есть проверка на существование:

```typescript
// Проверяем существующую интеграцию
const existing = await db.moySkladDirectIntegration.findUnique({
  where: { projectId: id }
});

if (existing) {
  return NextResponse.json(
    { error: 'Integration already exists for this project' },
    { status: 409 }
  );
}
```

Это правильное поведение - нельзя создать две интеграции для одного проекта. Нужно либо удалить старую, либо обновить существующую через PUT запрос.
