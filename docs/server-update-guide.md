# 🔄 Руководство по обновлению SaaS Bonus System на сервере

## 📋 Обзор методов обновления

### 1. **🐳 Docker Compose (Рекомендуется)**
Самый простой и безопасный способ обновления.

### 2. **⚡ PM2 (Node.js приложение)**
Для серверов без Docker.

### 3. **☁️ Vercel (Автоматическое)**
Обновление через Git push.

---

## 🐳 Метод 1: Docker Compose обновление

### Шаг 1: Подключение к серверу
```bash
ssh root@your-server-ip
# или
ssh user@your-server-ip
```

### Шаг 2: Переход в директорию проекта
```bash
cd /path/to/your/project
# Например: cd /opt/saas-bonus-system
```

### Шаг 3: Создание бэкапа (рекомендуется)
```bash
# Бэкап базы данных
docker-compose exec postgres pg_dump -U bonus_admin bonus_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Бэкап файлов проекта
tar -czf project_backup_$(date +%Y%m%d_%H%M%S).tar.gz . --exclude=node_modules --exclude=.git
```

### Шаг 4: Получение обновлений
```bash
# Получить последние изменения
git pull origin main

# Или если используете другую ветку
git pull origin develop
```

### Шаг 5: Обновление зависимостей и сборка
```bash
# Остановить сервисы
docker-compose down

# Пересобрать образы с новыми изменениями
docker-compose build --no-cache

# Запустить сервисы
docker-compose up -d

# Дождаться готовности БД
sleep 10

# Выполнить миграции БД
docker-compose exec app npx prisma migrate deploy

# Перезапустить приложение
docker-compose restart app
```

### Шаг 6: Проверка статуса
```bash
# Проверить статус контейнеров
docker-compose ps

# Проверить логи
docker-compose logs -f app

# Проверить доступность
curl -I http://localhost:3000
```

---

## ⚡ Метод 2: PM2 обновление

### Шаг 1: Подключение к серверу
```bash
ssh user@your-server-ip
```

### Шаг 2: Переход в директорию проекта
```bash
cd /opt/next-shadcn-dashboard-starter
```

### Шаг 3: Создание бэкапа
```bash
# Бэкап базы данных PostgreSQL
pg_dump -U bonus_admin bonus_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Бэкап проекта
tar -czf project_backup_$(date +%Y%m%d_%H%M%S).tar.gz . --exclude=node_modules --exclude=.git
```

### Шаг 4: Получение обновлений
```bash
git pull origin main
```

### Шаг 5: Обновление зависимостей
```bash
# Установить новые зависимости
yarn install

# Сгенерировать Prisma Client
yarn prisma:generate

# Выполнить миграции БД
yarn prisma:migrate

# Собрать проект
yarn build
```

### Шаг 6: Перезапуск приложения
```bash
# Перезапустить PM2 процесс
pm2 restart bonus-app

# Или остановить и запустить заново
pm2 stop bonus-app
pm2 start ecosystem.config.cjs

# Сохранить конфигурацию PM2
pm2 save
```

### Шаг 7: Проверка статуса
```bash
# Проверить статус процессов
pm2 status

# Проверить логи
pm2 logs bonus-app

# Проверить доступность
curl -I http://localhost:3000
```

---

## ☁️ Метод 3: Vercel автоматическое обновление

### Шаг 1: Настройка автоматического деплоя
```bash
# В корне проекта
vercel --prod

# Или через GitHub интеграцию
# 1. Подключите репозиторий в Vercel Dashboard
# 2. Настройте автоматический деплой на push в main ветку
```

### Шаг 2: Обновление через Git
```bash
# Локально
git add .
git commit -m "feat: обновление до версии 2.22.0"
git push origin main

# Vercel автоматически:
# 1. Получит изменения
# 2. Установит зависимости
# 3. Выполнит сборку
# 4. Развернет новую версию
```

### Шаг 3: Проверка деплоя
```bash
# Проверить статус деплоя
vercel ls

# Посмотреть логи
vercel logs [deployment-url]
```

---

## 🔧 Дополнительные шаги после обновления

### 1. Проверка миграций БД
```bash
# Docker
docker-compose exec app npx prisma migrate status

# PM2
npx prisma migrate status
```

### 2. Очистка кэша (если нужно)
```bash
# Docker
docker-compose exec app npx prisma generate

# PM2
npx prisma generate
```

### 3. Проверка переменных окружения
```bash
# Убедиться что все переменные на месте
cat .env.local
# или
cat .env
```

### 4. Тестирование функциональности
- Проверить авторизацию
- Проверить создание проектов
- Проверить webhook endpoints
- Проверить Telegram ботов

---

## 🚨 Устранение проблем

### Проблема: Ошибки миграций БД
```bash
# Откат последней миграции
npx prisma migrate reset

# Или ручное исправление
npx prisma db push
```

### Проблема: Контейнеры не запускаются
```bash
# Проверить логи
docker-compose logs

# Пересобрать с нуля
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Проблема: PM2 процесс падает
```bash
# Проверить логи
pm2 logs bonus-app

# Перезапустить
pm2 restart bonus-app

# Проверить конфигурацию
pm2 show bonus-app
```

### Проблема: Ошибки сборки
```bash
# Очистить кэш
yarn cache clean

# Переустановить зависимости
rm -rf node_modules
yarn install
yarn build
```

---

## 📊 Мониторинг после обновления

### 1. Проверка логов
```bash
# Docker
docker-compose logs -f app

# PM2
pm2 logs bonus-app --lines 100

# Vercel
vercel logs [deployment-url]
```

### 2. Проверка производительности
```bash
# Проверить использование ресурсов
docker stats

# PM2 мониторинг
pm2 monit
```

### 3. Проверка доступности
```bash
# Проверить HTTP статус
curl -I https://your-domain.com

# Проверить API endpoints
curl -X GET https://your-domain.com/api/health
```

---

## 🔄 Автоматизация обновлений

### Скрипт автоматического обновления
```bash
#!/bin/bash
# update.sh

set -e

echo "🔄 Начинаем обновление SaaS Bonus System..."

# Бэкап
echo "📦 Создаем бэкап..."
pg_dump -U bonus_admin bonus_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Обновление
echo "⬇️ Получаем обновления..."
git pull origin main

# Установка зависимостей
echo "📦 Устанавливаем зависимости..."
yarn install

# Миграции
echo "🗄️ Выполняем миграции БД..."
yarn prisma:migrate

# Сборка
echo "🔨 Собираем проект..."
yarn build

# Перезапуск
echo "🔄 Перезапускаем приложение..."
pm2 restart bonus-app

echo "✅ Обновление завершено!"
```

### Настройка cron для автоматических обновлений
```bash
# Добавить в crontab
crontab -e

# Обновление каждый день в 3:00
0 3 * * * /path/to/update.sh >> /var/log/saas-update.log 2>&1
```

---

## 📝 Чек-лист обновления

- [ ] Создан бэкап базы данных
- [ ] Создан бэкап файлов проекта
- [ ] Получены последние изменения из Git
- [ ] Установлены новые зависимости
- [ ] Выполнены миграции БД
- [ ] Проект успешно собран
- [ ] Приложение перезапущено
- [ ] Проверена доступность сервиса
- [ ] Проверены основные функции
- [ ] Проверены логи на ошибки

---

## 🆘 Экстренный откат

### Если что-то пошло не так:

```bash
# 1. Остановить приложение
pm2 stop bonus-app
# или
docker-compose down

# 2. Восстановить из бэкапа
git checkout HEAD~1
# или
git reset --hard [previous-commit-hash]

# 3. Восстановить БД из бэкапа
psql -U bonus_admin bonus_system < backup_YYYYMMDD_HHMMSS.sql

# 4. Перезапустить
pm2 start ecosystem.config.cjs
# или
docker-compose up -d
```

---

*Обновлено: 2025-01-28*
*Версия: 2.22.0*

