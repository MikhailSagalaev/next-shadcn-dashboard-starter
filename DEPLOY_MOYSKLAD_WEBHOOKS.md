# 🚀 Деплой исправлений МойСклад вебхуков

## Что исправлено

1. ✅ **Добавлена колонка в БД** - `users.moysklad_direct_counterparty_id`
2. ✅ **Проверка дубликатов** - вебхуки не создаются повторно
3. ✅ **Автозагрузка UI** - вебхуки загружаются при открытии страницы

## 📋 Инструкции для сервера

### 1. Подключиться к серверу
```bash
ssh root@gupil.ru
cd /var/www/bonus-app
```

### 2. Получить изменения
```bash
git pull origin main
```

### 3. Применить миграцию БД
```bash
psql -U postgres -d bonus_system -f prisma/migrations/20260306_add_moysklad_direct_counterparty_id/migration.sql
```

Должно вывести:
```
ALTER TABLE
CREATE INDEX
```

### 4. Перезапустить приложение
```bash
pm2 restart bonus-app
```

### 5. Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

Не должно быть ошибок:
- ❌ `The column users.moysklad_direct_counterparty_id does not exist`
- ❌ `Failed to create webhook`

## ✅ Проверка работы

1. Открой https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
2. Вебхуки должны загрузиться автоматически (5 штук)
3. Нажми "Создать вебхуки" - должно показать "Skipped: 5" (уже существуют)
4. Нажми "Синхронизировать" - должно работать без ошибок

## 🎯 Результат

После деплоя:
- ✅ Синхронизация работает
- ✅ Вебхуки не дублируются
- ✅ UI показывает вебхуки автоматически
- ✅ Нет ошибок в логах
