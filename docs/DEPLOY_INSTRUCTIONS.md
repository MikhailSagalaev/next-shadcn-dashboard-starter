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

```bash
# Способ 1: Через Prisma migrate (рекомендуется)
docker compose -f docker-compose.production.yml -f docker-compose.override.yml exec app yarn db:migrate

# Способ 2: Вручную через скрипт
docker compose -f docker-compose.production.yml -f docker-compose.override.yml exec app yarn tsx scripts/apply-email-verification-migration.ts
```

**Что делает миграция:**
- Добавляет поле `email_verified` (BOOLEAN, по умолчанию false)
- Добавляет поле `email_verification_token` (TEXT)
- Добавляет поле `email_verification_expires` (TIMESTAMP)

### Шаг 4: Обновить переменные окружения

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

### Шаг 5: Пересобрать и перезапустить приложение

```bash
# Остановить текущие контейнеры
docker compose -f docker-compose.production.yml -f docker-compose.override.yml down

# Пересобрать и запустить
docker compose -f docker-compose.production.yml -f docker-compose.override.yml up -d --build

# Проверить логи
docker compose -f docker-compose.production.yml -f docker-compose.override.yml logs -f app | cat
```

### Шаг 6: Проверить что все работает

```bash
# Проверить что миграция применена
docker compose -f docker-compose.production.yml -f docker-compose.override.yml exec app yarn prisma studio

# В Prisma Studio проверьте таблицу admin_accounts:
# Должны быть поля: email_verified, email_verification_token, email_verification_expires
```

---

## 🔍 Быстрая диагностика проблем

### Проблема: "Module not found: Can't resolve 'resend'"

**Решение:**
```bash
yarn install
yarn build
```

### Проблема: "Column 'email_verified' does not exist"

**Решение:**
```bash
# Применить миграцию
docker compose -f docker-compose.production.yml -f docker-compose.override.yml exec app yarn db:migrate
```

### Проблема: Email не отправляются

**Проверьте:**
1. `RESEND_API_KEY` установлен в `.env`
2. Ключ корректный (начинается с `re_`)
3. `RESEND_FROM_EMAIL` установлен
4. Проверьте логи: `docker compose logs app | grep -i resend`

---

## 📝 Полный чеклист деплоя

- [ ] `git pull origin main` - обновлен код
- [ ] `yarn install` - установлены зависимости (resend)
- [ ] Миграция БД применена (email verification поля)
- [ ] `.env` обновлен (RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL)
- [ ] Контейнеры пересобраны и перезапущены
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

3. **Мониторьте логи:**
   ```bash
   docker compose logs -f app | grep -E "email|verification|resend"
   ```

---

**Готово! Проект готов к Alpha Testing! 🎉**

