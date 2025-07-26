# 🎁 SaaS Bonus System

<div align="center">
  <strong>Мультитенантная платформа бонусных программ с Telegram ботами</strong>
  <br />
  <em>Построено на Next.js 15, React 19, PostgreSQL и Grammy</em>
</div>

<br />

<div align="center">
  <a href="#demo">Демо</a> •
  <a href="#features">Возможности</a> •
  <a href="#tech-stack">Технологии</a> •
  <a href="#quick-start">Быстрый старт</a> •
  <a href="#documentation">Документация</a>
</div>

## 📋 Описание

SaaS Bonus System — это мультитенантная платформа для управления бонусными программами клиентов с интеграцией Telegram ботов. Система позволяет создавать проекты, управлять пользователями, начислять и списывать бонусы, а также интегрироваться с существующими сайтами через webhook API.

## ✨ Основные возможности

### 🏢 Мультитенантность
- **Изолированные проекты** — каждый клиент получает отдельный проект с собственными данными
- **Уникальные webhook endpoints** — безопасная интеграция для каждого проекта
- **Отдельные Telegram боты** — персонализированные боты для каждого проекта

### 🤖 Telegram интеграция
- **Grammy framework** — современная библиотека для Telegram ботов
- **Автоматическое развертывание** — боты запускаются автоматически при создании проекта
- **Привязка пользователей** — связка аккаунтов по email/телефону
- **Проверка бонусов** — пользователи могут проверять баланс через бота

### 💰 Система бонусов
- **Автоматическое начисление** — бонусы за покупки через webhook
- **Гибкие настройки** — процент начисления и сроки действия
- **Списание бонусов** — использование бонусов при покупках
- **Аналитика** — детальная статистика по бонусам и транзакциям

### 🔗 Webhook интеграция
- **Простой API** — регистрация пользователей, начисление и списание бонусов
- **Безопасность** — уникальные secrets для каждого проекта
- **Логирование** — полная история всех webhook запросов
- **Поддержка популярных платформ** — Tilda, интернет-магазины, CRM

## 🛠 Технологический стек

### Backend & Framework
- **[Next.js 15](https://nextjs.org/)** — App Router, Server Actions
- **[TypeScript](https://www.typescriptlang.org)** — Строгая типизация
- **[PostgreSQL](https://www.postgresql.org/)** — Надежная база данных
- **[Prisma ORM](https://www.prisma.io/)** — Type-safe работа с БД

### Authentication & UI
- **[Clerk](https://clerk.com/)** — Современная аутентификация с мультитенантностью
- **[Tailwind CSS v4](https://tailwindcss.com)** — Утилитарные стили
- **[Shadcn/ui](https://ui.shadcn.com)** — Красивые компоненты
- **[HeroUI](https://heroui.com/)** — Дополнительные UI компоненты

### Telegram & Real-time
- **[Grammy](https://grammy.dev/)** — Современный фреймворк для Telegram ботов
- **[Webhooks](https://core.telegram.org/bots/webhooks)** — Обработка сообщений в real-time

### Developer Experience
- **[Zod](https://zod.dev)** — Валидация схем данных
- **[React Hook Form](https://react-hook-form.com/)** — Управление формами
- **[Zustand](https://zustand-demo.pmnd.rs)** — Легковесное состояние
- **[ESLint](https://eslint.org)** + **[Prettier](https://prettier.io)** — Качество кода

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token (получить у [@BotFather](https://t.me/BotFather))

### Установка

1. **Клонирование репозитория**
```bash
git clone https://github.com/your-username/saas-bonus-system.git
cd saas-bonus-system
```

2. **Установка зависимостей**
```bash
pnpm install
```

3. **Настройка окружения**
```bash
cp env.example.txt .env.local
```

Заполните `.env.local` файл:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/saas_bonus_system"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"

# Telegram
TELEGRAM_BOT_TOKEN="YOUR_DEFAULT_BOT_TOKEN"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. **Настройка базы данных**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Запуск в режиме разработки**
```bash
pnpm dev
```

Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000)

## 📱 Основные страницы

| Страница | Описание |
|----------|----------|
| `/dashboard` | Главная панель управления с общей статистикой |
| `/dashboard/projects` | Управление проектами (создание, настройка, деактивация) |
| `/dashboard/projects/[id]/users` | Управление пользователями проекта |
| `/dashboard/projects/[id]/analytics` | Детальная аналитика проекта |
| `/dashboard/projects/[id]/bot` | Настройка и тестирование Telegram бота |
| `/dashboard/bonuses` | Общее управление бонусами всех проектов |

## 🔗 API Endpoints

### Webhook API
```bash
# Регистрация пользователя
POST /api/webhook/[secret]
{
  "action": "register_user",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров"
}

# Начисление бонусов за покупку
POST /api/webhook/[secret]
{
  "action": "purchase",
  "userEmail": "user@example.com",
  "purchaseAmount": 1000,
  "orderId": "ORDER-123"
}

# Списание бонусов
POST /api/webhook/[secret]
{
  "action": "spend_bonuses",
  "userEmail": "user@example.com",
  "bonusAmount": 100,
  "orderId": "ORDER-124"
}
```

### Project Management API
```bash
# Получение списка проектов
GET /api/projects

# Создание проекта
POST /api/projects

# Получение аналитики проекта
GET /api/projects/[id]/analytics
```

## 📚 Документация

- **[API документация](docs/api.md)** — Полное описание всех API endpoints
- **[Webhook интеграция](docs/webhook-integration.md)** — Гайд по подключению к сайтам
- **[Telegram боты](docs/telegram-bots.md)** — Настройка и управление ботами
- **[База данных](docs/database-schema.md)** — Схема БД и отношения
- **[Changelog](docs/changelog.md)** — История изменений

## 🔧 Архитектура проекта

```
SaaS Bonus System
├── Admin Dashboard (Next.js)     # Управление проектами и пользователями
├── Webhook API                    # Интеграция с внешними сайтами  
├── Telegram Bots (Grammy)         # Боты для каждого проекта
├── Database (PostgreSQL)          # Хранение данных и аналитики
└── Analytics Engine               # Сбор и анализ метрик
```

### Структура файлов
```
src/
├── app/                     # Next.js App Router
│   ├── api/                 # API endpoints
│   │   ├── projects/        # Управление проектами
│   │   ├── webhook/         # Webhook endpoints
│   │   └── telegram/        # Telegram webhook handlers
│   └── dashboard/           # Админ панель
├── components/              # Переиспользуемые компоненты
├── features/               # Функциональные модули
│   ├── projects/           # Управление проектами
│   ├── bonuses/           # Система бонусов
│   └── bots/              # Telegram боты
├── lib/                    # Основные утилиты
│   ├── db.ts              # Prisma client
│   ├── telegram/          # Grammy интеграция
│   └── services/          # Бизнес-логика
└── types/                  # TypeScript типы
```

## 🚀 Деплой

### Vercel (рекомендуется)
1. Push код в GitHub
2. Подключите репозиторий к Vercel
3. Настройте переменные окружения
4. Деплой происходит автоматически

### Docker
```bash
# Сборка образа
docker build -t saas-bonus-system .

# Запуск с PostgreSQL
docker-compose up -d
```

## 🔒 Безопасность

- **Мультитенантность** — полная изоляция данных между проектами
- **Webhook secrets** — уникальные секретные ключи для каждого проекта
- **Rate limiting** — защита от злоупотреблений API
- **Input validation** — валидация всех входящих данных
- **SQL injection protection** — использование Prisma ORM

## 🤝 Вклад в проект

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

Проект распространяется под MIT лицензией. См. файл `LICENSE` для деталей.

## 🆘 Поддержка

- **Issues** — [GitHub Issues](https://github.com/your-username/saas-bonus-system/issues)
- **Документация** — [Полная документация](docs/README.md)
- **Email** — support@your-domain.com

---

<div align="center">
  Сделано с ❤️ для развития бонусных программ
</div>
