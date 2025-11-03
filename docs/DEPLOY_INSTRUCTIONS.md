# 🚀 Инструкция по деплою на сервер

## 📋 Что нужно сделать на сервере после пуша изменений

### Шаг 1: Обновить код с GitHub

```bash
cd /opt/next-shadcn-dashboard-starter
git pull origin main
```

### Шаг 2: Установить новые зависимости

```bash
yarn install
```

**⚠️ ВАЖНО:** После этого устанавливаются все новые пакеты, включая `resend`.

### Шаг 3: Применить миграцию БД для email verification

**Через psql напрямую:**
```bash
# Если PostgreSQL на порту 5440
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -f prisma/migrations/add_email_verification_manual.sql

# Если PostgreSQL на стандартном порту 5432
psql -h localhost -U bonus_admin -d bonus_system -f prisma/migrations/add_email_verification_manual.sql
```

**Или через TypeScript скрипт:**
```bash
yarn tsx scripts/apply-email-verification-migration.ts
```

**⚠️ Проверьте ваш DATABASE_URL в .env чтобы определить правильный порт**

**Что делает миграция:**
- Добавляет поле `email_verified` (BOOLEAN, по умолчанию false)
- Добавляет поле `email_verification_token` (TEXT)
- Добавляет поле `email_verification_expires` (TIMESTAMP)

### Шаг 4: Обновить Prisma Client

```bash
npx prisma generate
```

### Шаг 5: Обновить переменные окружения

Отредактируйте `.env` на сервере и добавьте:

```bash
# Email провайдер - Resend
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@resend.dev

# Приложение
NEXT_PUBLIC_APP_URL=https://gupil.ru
```

**Где получить RESEND_API_KEY:** См. [docs/RESEND_SETUP.md](./RESEND_SETUP.md)

**Примечание:** Для начала используйте `noreply@resend.dev` (не требует DNS верификации). Позже, когда будет настроен `gupil.ru`, смените на `noreply@gupil.ru`.

### Шаг 6: Пересобрать приложение

```bash
yarn build
```

### Шаг 7: Перезапустить приложение

```bash
pm2 reload all --update-env
pm2 save
```

### Шаг 8: Проверить что все работает

```bash
# Проверить статус PM2
pm2 status

# Проверить логи
pm2 logs bonus-app --lines 50

# Проверить что миграция применена (используйте порт из DATABASE_URL)
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -c "\d admin_accounts" | grep email_verified
```

Должно показать поля: `email_verified`, `email_verification_token`, `email_verification_expires`

---

## 🔍 Быстрая диагностика проблем

### Проблема: "Module not found: Can't resolve 'resend'"

**Решение:**
```bash
yarn install
yarn build
pm2 reload all --update-env
```

### Проблема: "Column 'email_verified' does not exist"

**Решение:**
```bash
# Применить миграцию (используйте порт из DATABASE_URL)
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -f prisma/migrations/add_email_verification_manual.sql

# Обновить Prisma Client
npx prisma generate

# Перезапустить
pm2 reload all --update-env
```

### Проблема: Email не отправляются

**Проверьте:**
1. `RESEND_API_KEY` установлен в `.env` (загрузка через `pm2 reload all --update-env`)
2. Ключ корректный (начинается с `re_`)
3. `RESEND_FROM_EMAIL` установлен
4. Проверьте логи: `pm2 logs bonus-app | grep -i resend`

**После изменения .env файла:**
```bash
pm2 reload all --update-env
pm2 save
```

---

## 📝 Полный чеклист деплоя

- [ ] `git pull origin main` - обновлен код
- [ ] `yarn install` - установлены зависимости (resend)
- [ ] Миграция БД применена (email verification поля)
- [ ] `npx prisma generate` - обновлен Prisma Client
- [ ] `.env` обновлен (RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL)
- [ ] `yarn build` - пересобрано приложение
- [ ] `pm2 reload all --update-env` - перезапущен сервер с новыми переменными
- [ ] Логи проверены на ошибки
- [ ] Регистрация тестируется с email verification
- [ ] Повторная отправка письма работает
- [ ] Логин требует подтверждения email

---

## 🎯 После успешного деплоя

1. **Протестируйте регистрацию:**
   - Создайте тестового админа
   - Проверьте получение письма
   - Подтвердите email
   - Войдите в систему

2. **Настройте DNS для `gupil.ru`** (если планируется):
   - См. инструкцию в [docs/RESEND_SETUP.md](./RESEND_SETUP.md)
   - Добавьте DNS записи в REG.RU
   - Дождитесь верификации
   - Смените `RESEND_FROM_EMAIL=noreply@gupil.ru`
   - Выполните `pm2 reload all --update-env`

3. **Мониторьте логи:**
   ```bash
   pm2 logs bonus-app --lines 100 | grep -E "email|verification|resend"
   ```

---

## 📌 Краткая версия (для быстрого деплоя)

```bash
cd /opt/next-shadcn-dashboard-starter && \
git pull origin main && \
yarn install && \
psql -h 127.0.0.1 -p 5440 -U bonus_admin -d bonus_system -f prisma/migrations/add_email_verification_manual.sql && \
npx prisma generate && \
yarn build && \
pm2 reload all --update-env && \
pm2 save
```

**Готово! Проект готов к Alpha Testing! 🎉**
