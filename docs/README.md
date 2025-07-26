# 🎯 SaaS Bonus System - Документация

## 📋 Обзор проекта

**SaaS Bonus System** - это мультитенантная платформа для управления бонусными программами с интеграцией Telegram ботов. Система позволяет создавать проекты для разных клиентов, каждый со своими настройками бонусной программы и Telegram ботом.

## 🏗️ Архитектура

```mermaid
graph TB
    A[Клиент A - Интернет-магазин] --> B[Webhook API]
    AA[Клиент B - Интернет-магазин] --> B
    B --> C[SaaS Bonus System]
    C --> D[PostgreSQL Database]
    C --> E[Telegram Bot A]
    C --> F[Telegram Bot B]
    C --> G[Admin Dashboard]
    E --> H[Пользователи клиента A]
    F --> I[Пользователи клиента B]
```

## 📚 Документация

### 📖 Основная документация:
- [📊 Database Schema](./database-schema.md) - схема базы данных
- [🔗 API Reference](./api.md) - документация API endpoints
- [📞 Webhook Integration](./webhook-integration.md) - гайд по интеграции
- [🤖 Telegram Bots](./telegram-bots.md) - настройка и работа с ботами

### 📋 Управление проектом:
- [📝 Changelog](./changelog.md) - история изменений
- [📌 Task Tracker](./tasktracker.md) - трекер задач

## 🚀 Быстрый старт

### 1. Настройка окружения

```powershell
# Клонируйте репозиторий
git clone <your-repo>
cd saas-bonus-system

# Установите зависимости
pnpm install

# Настройте базу данных
# Создайте файл .env с DATABASE_URL
npx prisma migrate dev --name init
npx prisma generate
```

### 2. Переменные окружения

Создайте файл `.env` со следующими переменными:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bonus_saas"

# JWT Secret
JWT_SECRET="your-super-secret-key"

# Application URLs
NEXT_PUBLIC_APP_URL="http://localhost:3001"
NEXT_PUBLIC_API_URL="http://localhost:3001/api"

# Clerk Auth (optional)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

### 3. Запуск приложения

```powershell
# Development режим
pnpm dev

# Приложение будет доступно на http://localhost:3001
```

## 🎯 Основные возможности

### 🏢 Мультитенантность
- Каждый клиент получает свой проект с уникальными настройками
- Изоляция данных между проектами
- Индивидуальные webhook endpoints

### 💰 Бонусная система
- Гибкие правила начисления (процент с покупки, фиксированная сумма)
- Настраиваемый срок истечения бонусов
- История всех операций
- Автоматическое списание по принципу FIFO

### 🤖 Telegram интеграция
- Отдельный бот для каждого проекта
- Привязка аккаунтов по телефону или email
- Проверка баланса и истории операций
- Настраиваемые сообщения

### 🔗 Webhook API
- Универсальный endpoint для интеграции
- Поддержка регистрации пользователей
- Начисление бонусов за покупки
- Списание бонусов при оплате

## 🛠️ Технологический стек

| Компонент | Технология |
|-----------|------------|
| Framework | Next.js 15 + React 19 |
| Database | PostgreSQL + Prisma |
| UI | Shadcn/ui + Tailwind CSS v4 |
| Auth | Clerk |
| Telegram | Grammy |
| Language | TypeScript |
| Styling | HeroUI + Tailwind |

## 📦 Структура проекта

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   └── webhook/       # Webhook handlers
│   ├── dashboard/         # Admin dashboard
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── layout/           # Layout components
├── features/             # Feature-based modules
│   ├── projects/         # Project management
│   ├── users/            # User management
│   └── bonuses/          # Bonus system
├── lib/                  # Core utilities
│   ├── services/         # Business logic
│   ├── telegram/         # Telegram bot logic
│   └── db.ts            # Database connection
├── types/               # TypeScript types
└── hooks/               # Custom React hooks

docs/                    # Documentation
prisma/                  # Database schema
```

## 🔄 Основные процессы

### 1. Регистрация пользователя
```
Сайт клиента → Webhook API → Создание User → Уведомление
```

### 2. Начисление бонусов
```
Покупка → Webhook API → Расчет бонусов → Создание Bonus → Transaction
```

### 3. Списание бонусов
```
Оплата бонусами → Webhook API → Проверка баланса → Списание → Transaction
```

### 4. Telegram взаимодействие
```
/start → Привязка аккаунта → /balance → /history
```

## 🧪 Тестирование

```powershell
# Проверка типов TypeScript
npx tsc --noEmit

# Валидация Prisma схемы
npx prisma validate

# Сборка проекта
pnpm build

# Линтинг
pnpm lint
```

## 📞 Поддержка

При возникновении вопросов или проблем:
1. Проверьте [Task Tracker](./tasktracker.md) на известные проблемы
2. Ознакомьтесь с [Changelog](./changelog.md) для последних изменений
3. Создайте issue в системе управления проектом

---

**Версия документации**: 1.0  
**Последнее обновление**: 2024-12-31  
**Статус проекта**: 🚧 В разработке 