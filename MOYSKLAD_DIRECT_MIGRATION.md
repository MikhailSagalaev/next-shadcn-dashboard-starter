# 🔧 МойСклад Direct - Миграция БД

## ❌ Проблема

```
The table `public.moysklad_direct_integrations` does not exist in the current database.
```

## ✅ Решение

Нужно создать и применить миграцию Prisma для создания таблицы.

## 🚀 Команды для выполнения на сервере

### 1. Подключитесь к серверу

```bash
ssh root@gupil.ru
cd /var/www/gupil
```

### 2. Создайте миграцию

```bash
npx prisma migrate dev --name add_moysklad_direct_integration
```

**Если команда выше не работает (production), используйте:**

```bash
npx prisma migrate deploy
```

### 3. Если миграция еще не создана локально

Создайте миграцию локально и запушьте:

```bash
# На локальной машине
npx prisma migrate dev --name add_moysklad_direct_integration
git add prisma/migrations
git commit -m "feat: добавлена миграция для МойСклад Direct"
git push

# Затем на сервере
git pull
npx prisma migrate deploy
```

### 4. Перезапустите приложение

```bash
pm2 restart bonus-app
pm2 logs bonus-app --lines 50
```

## 📋 Альтернативный способ (если миграции нет)

Если миграция не была создана, можно применить schema напрямую:

```bash
# ВНИМАНИЕ: Это может привести к потере данных!
npx prisma db push
```

## ✅ Проверка

После применения миграции попробуйте создать интеграцию снова.

---

**Дата:** 2026-03-06  
**Статус:** Требуется миграция БД
