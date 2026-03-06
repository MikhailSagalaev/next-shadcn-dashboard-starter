# Инструкция для применения миграции на сервере

## Шаг 1: Подключиться к серверу
```bash
ssh user@gupil.ru
```

## Шаг 2: Перейти в директорию проекта
```bash
cd /path/to/bonus-app
```

## Шаг 3: Получить последние изменения
```bash
git pull origin main
```

## Шаг 4: Применить миграцию БД
```bash
npx prisma migrate deploy
```

## Шаг 5: Сгенерировать Prisma Client
```bash
npx prisma generate
```

## Шаг 6: Перезапустить приложение
```bash
pm2 restart bonus-app
```

## Шаг 7: Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

## Что делает миграция?

Создает 2 новые таблицы:

1. **moysklad_direct_integrations** - хранит настройки интеграции
   - id, projectId, accountId (nullable), apiToken (encrypted)
   - bonusProgramId, isActive, createdAt, updatedAt

2. **moysklad_direct_sync_logs** - логи синхронизации
   - id, integrationId, syncType, status, details
   - itemsProcessed, itemsFailed, startedAt, completedAt

## Проверка успешности

После применения миграции проверьте:

```bash
# Проверить что таблицы созданы
psql -U postgres -d bonus_system -c "\dt moysklad_direct*"
```

Должны появиться:
- moysklad_direct_integrations
- moysklad_direct_sync_logs

## Если что-то пошло не так

1. Проверить логи миграции:
```bash
cat prisma/migrations/20260306_add_moysklad_direct_integration/migration.sql
```

2. Применить миграцию вручную:
```bash
psql -U postgres -d bonus_system -f prisma/migrations/20260306_add_moysklad_direct_integration/migration.sql
```

3. Проверить статус миграций:
```bash
npx prisma migrate status
```

## После успешной миграции

Откройте в браузере:
```
https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
```

И создайте интеграцию с параметрами:
- **Account ID**: можно оставить пустым (опционально)
- **API Token**: ваш Bearer токен из МойСклад
- **Bonus Program ID**: ID программы лояльности

---

**Важно**: Account ID теперь опционален и используется только для UI/логов. Для работы API нужен только Bearer Token.
