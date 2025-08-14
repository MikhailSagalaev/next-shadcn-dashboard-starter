# 🚀 Руководство по развертыванию SaaS Bonus System

## 📋 Обзор вариантов развертывания

### 1. **🌐 Быстрое тестирование: ngrok (локально + туннель)**

```bash
# 1. Установите ngrok
npm install -g ngrok

# 2. Запустите проект локально
pnpm dev

# 3. В новом терминале создайте туннель
ngrok http 3000
```

**Результат**: Получите URL типа `https://abc123.ngrok.io`

**Плюсы**: 
- ✅ Быстро (5 минут)
- ✅ Бесплатно
- ✅ Подходит для тестирования webhook'ов

**Минусы**: 
- ❌ URL меняется при перезапуске
- ❌ Не подходит для продакшена

---

### 2. **☁️ Рекомендуемо: Vercel (бесплатно)**

```bash
# 1. Установите Vercel CLI
npm install -g vercel

# 2. Войдите в аккаунт
vercel login

# 3. Деплой проекта
vercel --prod
```

**Настройка переменных окружения в Vercel:**
```bash
# Добавьте переменные через веб-интерфейс или CLI:
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
```

**Плюсы**:
- ✅ Автоматический HTTPS
- ✅ CDN и оптимизация
- ✅ Интеграция с GitHub
- ✅ Бесплатный план для стартапов

---

### 3. **🐳 Docker развертывание**

#### A. Локальный запуск с Docker Compose

```bash
# 1. Создайте .env файл:
cp .env.example .env
# Заполните необходимые переменные

# 2. Запустите проект
docker-compose up -d

# 3. Выполните миграции БД
docker-compose exec app npx prisma migrate deploy
```

#### B. На облачном сервере (DigitalOcean, AWS, etc.)

```bash
# 1. Клонируйте репозиторий
git clone your-repo
cd your-project

# 2. Настройте переменные окружения
nano .env

# 3. Запустите
docker-compose up -d

# 4. Настройте Nginx (обратный прокси)
# См. конфигурацию ниже
```

---

## 🔧 Настройка переменных окружения

### Обязательные переменные:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxx"
CLERK_SECRET_KEY="sk_live_xxx"

# App Config
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="32-character-secret"
WEBHOOK_BASE_URL="https://your-domain.com"
CRON_SECRET="your-cron-secret"
```

---

## 🗄️ Настройка базы данных

### Вариант 1: Облачная БД (рекомендуемо)
- **Neon.tech** (бесплатно до 0.5GB)
- **PlanetScale** (бесплатно до 5GB)
- **Supabase** (бесплатно до 500MB)

### Вариант 2: Self-hosted PostgreSQL

```bash
# Docker
docker run --name postgres-bonus \
  -e POSTGRES_USER=bonus_admin \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=bonus_system \
  -p 5432:5432 \
  -d postgres:15

# Выполните миграции
npx prisma migrate deploy
```

---

## 🔄 Процесс деплоя (шаг за шагом)

### 1. **Подготовка**
```bash
# 1. Убедитесь что проект собирается
pnpm build

# 2. Проверьте TypeScript
npx tsc --noEmit

# 3. Проверьте линтер
pnpm lint
```

### 2. **База данных**
```bash
# 1. Создайте продакшен БД
# 2. Обновите DATABASE_URL в .env
# 3. Выполните миграции
npx prisma migrate deploy
# 4. Сгенерируйте клиент Prisma
npx prisma generate
```

### 3. **Vercel деплой**
```bash
# 1. Подключите GitHub репозиторий к Vercel
# 2. Настройте переменные окружения
# 3. Деплой произойдет автоматически
```

### 4. **Проверка деплоя**
```bash
# Тестовые запросы:
curl https://your-domain.com/api/health
curl -X POST https://your-domain.com/api/webhook/test-secret \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

---

## 📡 Настройка webhook'ов

### Tilda Integration:
1. Зайдите в настройки проекта Tilda
2. Добавьте webhook URL: `https://your-domain.com/api/webhook/[your-webhook-secret]`
3. Включите отправку данных о заказах

### Другие интеграции:
- **WooCommerce**: Плагин webhooks
- **Shopify**: Settings → Notifications → Webhooks
- **Custom**: POST запрос на ваш webhook endpoint

---

## 🔒 Безопасность в продакшене

### 1. Переменные окружения
```bash
# Генерируйте сильные секреты:
openssl rand -base64 32  # для NEXTAUTH_SECRET
openssl rand -hex 16     # для CRON_SECRET
```

### 2. Database Security
- Используйте SSL соединения
- Ограничьте доступ по IP
- Регулярные бэкапы

### 3. Rate Limiting
```typescript
// Уже настроен в проекте
// src/lib/rate-limiter.ts
```

---

## 📊 Мониторинг

### Логи приложения:
```bash
# Docker
docker-compose logs -f app

# Vercel
vercel logs your-deployment-url
```

### Telegram боты статус:
```bash
curl https://your-domain.com/api/admin/bots/init
```

---

## 🚨 Troubleshooting

### Проблема: "Database connection failed"
```bash
# Проверьте DATABASE_URL
echo $DATABASE_URL

# Тест соединения
npx prisma db pull
```

### Проблема: "Webhook не приходят"
1. Проверьте webhook URL
2. Убедитесь что сервис запущен
3. Проверьте логи: `docker-compose logs app`

### Проблема: "Telegram боты не отвечают"
```bash
# Проверьте статус ботов
curl https://your-domain.com/api/admin/bots/init

# Перезапустите ботов
curl -X POST https://your-domain.com/api/admin/bots/init
```

---

## 💡 Рекомендации

1. **Для тестирования**: Используйте ngrok
2. **Для MVP/стартапа**: Vercel + Neon.tech (бесплатно)
3. **Для продакшена**: VPS + Docker + PostgreSQL
4. **Для масштабирования**: Kubernetes + облачная БД

---

**🎯 Итог**: Самый быстрый способ протестировать webhook интеграцию - это ngrok (5 минут) или Vercel деплой (15 минут).
