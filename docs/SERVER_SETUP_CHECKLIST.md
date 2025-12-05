# 🚀 Чек-лист для деплоя на сервер

## 📋 Шаги установки

### 1️⃣ Обновление кода
```bash
git pull origin main
```

### 2️⃣ Установка зависимостей
```bash
yarn install
```

### 3️⃣ Применение миграций БД

**Вариант A: Через pgAdmin**
Откройте файл `MIGRATION_INSTRUCTIONS.md` и выполните SQL скрипт.

**Вариант B: Через psql**
```bash
# Замените креды на свои
psql -h localhost -U bonus_admin -d bonus_system -c "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS metadata JSONB;"
```

**Вариант C: Если PostgreSQL на другом хосте**
```bash
# Используйте ваши реальные креды
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d bonus_system -f prisma/migrations/20251002_add_metadata_to_admin_account/migration.sql
```

После миграции:
```bash
npx prisma generate
npx prisma validate
```

### 4️⃣ Настройка .env файла

Создайте/обновите `.env.production` на сервере:

```env
# ==================================================
# 🔒 PRODUCTION ENVIRONMENT
# ==================================================

# ===== Базовые настройки =====
NODE_ENV=production
PORT=3000

# ===== Public URL (замените на ваш домен) =====
NEXT_PUBLIC_APP_URL=https://ваш-домен.ru
WEBHOOK_BASE_URL=https://ваш-домен.ru

# ===== База данных PostgreSQL =====
DATABASE_URL=postgresql://admin:ваш_пароль@127.0.0.1:5440/bonus_system?schema=public

# ===== Redis (для кэша и rate limiting) =====
REDIS_URL=redis://:ваш_redis_пароль@127.0.0.1:6379

# ===== JWT Секреты (ОБЯЗАТЕЛЬНО сгенерируйте новые!) =====
JWT_SECRET=ваш_очень_длинный_случайный_секрет_минимум_32_символа
NEXTAUTH_SECRET=другой_очень_длинный_случайный_секрет_32_символа
CRON_SECRET=секрет_для_cron_задач_32_символа

# ===== Логирование =====
LOG_LEVEL=info
ENABLE_CONSOLE_LOGS=false

# ===== Grafana + Loki (мониторинг, опционально) =====
# GRAFANA_URL=http://localhost:3000
# GRAFANA_API_KEY=your_grafana_api_key_here
# LOKI_URL=http://localhost:3100

# ===== Telegram Bot API (если нужен кастомный сервер) =====
# TELEGRAM_API_URL=https://api.telegram.org

# ===== Email провайдер (для восстановления пароля) =====
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# EMAIL_FROM=noreply@ваш-домен.ru

# ===== Rate Limiting =====
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5️⃣ Генерация секретов

```bash
# Генерируем три секрета
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('NEXTAUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

### 6️⃣ Docker контейнеры (если используете)

```bash
# Проверка что PostgreSQL и Redis запущены
docker ps | grep -E "postgres|redis"

# Если не запущены:
docker compose up -d
```

### 7️⃣ Сборка проекта

```bash
yarn build
```

### 8️⃣ Запуск/перезапуск через PM2

**Первый запуск:**
```bash
yarn pm2:start
```

**Перезапуск (если уже запущен):**
```bash
pm2 restart bonus-app --update-env
```

**Просмотр логов:**
```bash
pm2 logs bonus-app
```

**Сохранение для автозапуска:**
```bash
pm2 save
pm2 startup
```

### 9️⃣ Проверка работоспособности

**TypeScript:**
```bash
npx tsc --noEmit
```

**API Health Check:**
```bash
curl https://ваш-домен.ru/api/health
```

**Проверка auth endpoints:**
```bash
# Forgot password
curl -X POST https://ваш-домен.ru/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 🔟 Telegram боты (если используются)

```bash
# Проверка статуса ботов
node scripts/check-bot-status.ts
```

---

## 🆘 Troubleshooting

### Проблема: "Cannot connect to database"
```bash
# Проверьте PostgreSQL
docker logs postgres-container
netstat -tlnp | grep 5440
```

### Проблема: "Redis connection failed"
```bash
# Проверьте Redis
docker logs redis-container
redis-cli -a ваш_пароль ping
```

### Проблема: "Build failed"
```bash
# Очистите кэш и пересоберите
rm -rf .next node_modules
yarn install
yarn build
```

### Проблема: PM2 не стартует
```bash
# Посмотрите подробные логи
pm2 logs bonus-app --lines 100

# Перезапустите с флагом
pm2 delete bonus-app
yarn pm2:start
```

---

## ✅ Критические проверки перед продакшеном

- [ ] `.env.production` создан и заполнен
- [ ] Все секреты уникальные и безопасные (минимум 32 символа)
- [ ] `DATABASE_URL` указывает на правильную БД
- [ ] `REDIS_URL` доступен и работает
- [ ] `NEXT_PUBLIC_APP_URL` указывает на реальный домен
- [ ] PostgreSQL миграции применены (`npx prisma generate`)
- [ ] `NODE_ENV=production`
- [ ] `yarn build` прошла успешно
- [ ] PM2 запущен и логи не показывают ошибок
- [ ] API endpoints отвечают (health check)
- [ ] SSL сертификаты настроены (если используете nginx)

---

## 📞 Поддержка

Если что-то пошло не так:
1. Проверьте логи: `pm2 logs bonus-app`
2. Проверьте Docker: `docker ps` и `docker logs`
3. Проверьте сеть: `netstat -tlnp`
4. Откройте issue в репозитории

**Готово! 🎉**

