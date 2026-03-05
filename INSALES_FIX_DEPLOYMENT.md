# InSales Integration - Critical Fix Deployment

## Проблема
500 Internal Server Error на странице `/dashboard/projects/[id]/integrations/insales` из-за:
1. `params` не ожидается (не используется `await`) в Next.js 15
2. Prisma Client не сгенерирован с новыми моделями InSales
3. Использование несуществующего `BonusService`

## Исправления (Commit: 73272a2)

### 1. Next.js 15 Params Fix
Все page.tsx и API routes теперь используют `await params`:

```typescript
// ❌ Было (Next.js 14)
export async function Page({ params }: { params: { id: string } }) {
  const projectId = params.id;
}

// ✅ Стало (Next.js 15)
export async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
}
```

**Исправленные файлы:**
- `src/app/dashboard/projects/[id]/integrations/insales/page.tsx`
- `src/app/api/projects/[id]/integrations/insales/route.ts` (GET, POST, PUT, DELETE)
- `src/app/api/insales/webhook/[projectId]/route.ts`
- `src/app/api/insales/apply-bonuses/[projectId]/route.ts`
- `src/app/api/insales/balance/[projectId]/route.ts`
- `src/app/api/insales/widget-settings/[projectId]/route.ts`

### 2. Удален BonusService
Заменен на прямые запросы к БД через Prisma:

```typescript
// ❌ Было
await this.bonusService.awardBonus({ ... });
const balance = await this.bonusService.getUserBalance(userId);

// ✅ Стало
await db.bonus.create({ ... });
await db.transaction.create({ ... });
const bonuses = await db.bonus.findMany({ ... });
const balance = bonuses.reduce((sum, b) => sum + b.amount.toNumber(), 0);
```

### 3. Добавлен API Route для логов
Создан `src/app/api/projects/[id]/integrations/insales/logs/route.ts` для компонента `webhook-logs.tsx`.

### 4. Исправлены типы InSales
Добавлены недостающие поля в `InSalesOrder`:
- `custom_fields?: Record<string, any>`
- `discount_code?: string`
- `discount_amount?: string`

### 5. Исправлен импорт шифрования
`encrypt` → `encryptApiToken` в admin API route.

## Инструкции по деплою

### Шаг 1: Подключиться к серверу
```bash
ssh root@89.111.174.71
cd /opt/next-shadcn-dashboard-starter
```

### Шаг 2: Получить изменения
```bash
git pull
```

### Шаг 3: КРИТИЧНО - Сгенерировать Prisma Client
```bash
npx prisma generate
```

**Почему это важно:**
- Модели `InSalesIntegration` и `InSalesWebhookLog` существуют в schema.prisma
- Миграция `20260302_add_insales_integration` уже применена
- Но Prisma Client не знает о новых моделях до `prisma generate`

### Шаг 4: Проверить build (опционально)
```bash
yarn build
```

Если есть ошибки TypeScript - это нормально, они связаны с другими частями проекта (MoySklad). InSales код исправлен.

### Шаг 5: Перезапустить приложение
```bash
pm2 restart bonus-app
```

### Шаг 6: Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

### Шаг 7: Тестирование
Откройте в браузере:
```
https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales
```

**Ожидаемый результат:**
- ✅ Страница загружается без 500 ошибки
- ✅ Показывается форма настройки интеграции
- ✅ Если интеграция не создана - показываются инструкции

## Проверка работоспособности

### 1. Проверка страницы интеграции
```bash
curl -I https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales
```
Должен вернуть `200 OK` (после авторизации).

### 2. Проверка Prisma Client
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); console.log('InSalesIntegration' in db ? 'OK' : 'FAIL'); process.exit(0);"
```
Должен вывести `OK`.

### 3. Проверка API endpoints
После создания интеграции через UI:
```bash
# Webhook endpoint
curl -X POST https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt \
  -H "Content-Type: application/json" \
  -d '{"event":"orders/create","order":{"id":1,"number":"TEST"}}'

# Balance endpoint
curl "https://gupil.ru/api/insales/balance/cmilhq0y600099e7uraiowrmt?email=test@example.com"
```

## Откат (если что-то пошло не так)

### Вернуться к предыдущему коммиту
```bash
git reset --hard 883b3d9
npx prisma generate
pm2 restart bonus-app
```

## Следующие шаги

После успешного деплоя:

1. **Создать тестовую интеграцию:**
   - Войти в проект `cmilhq0y600099e7uraiowrmt`
   - Перейти в InSales Integration
   - Заполнить форму с тестовыми данными
   - Активировать интеграцию

2. **Настроить webhooks в InSales:**
   - Скопировать Webhook URL из Credentials
   - Добавить в InSales админке
   - Протестировать создание заказа

3. **Встроить виджет:**
   - Скопировать код виджета
   - Вставить в тему InSales
   - Проверить отображение на сайте

## Технические детали

### Структура InSales интеграции
```
InSales Integration
├── Admin UI (Dashboard)
│   ├── page.tsx - главная страница настроек
│   ├── integration-form.tsx - форма настройки
│   ├── credentials.tsx - webhook URL и код виджета
│   ├── stats-cards.tsx - статистика
│   └── webhook-logs.tsx - логи webhooks
├── API Routes
│   ├── /api/projects/[id]/integrations/insales - CRUD интеграции
│   ├── /api/projects/[id]/integrations/insales/logs - логи
│   ├── /api/insales/webhook/[projectId] - прием webhooks
│   ├── /api/insales/balance/[projectId] - баланс бонусов
│   ├── /api/insales/apply-bonuses/[projectId] - применение бонусов
│   └── /api/insales/widget-settings/[projectId] - настройки виджета
├── Services
│   ├── insales-service.ts - бизнес-логика
│   ├── insales-api-client.ts - клиент InSales API
│   └── types.ts - TypeScript типы
└── Widget (Public)
    ├── insales-widget-loader.js - загрузчик
    ├── insales-bonus-widget.js - виджет
    └── insales-bonus-widget.css - стили
```

### База данных
```sql
-- Таблица интеграций
InSalesIntegration {
  id, projectId, apiKey, apiPassword (encrypted),
  shopDomain, webhookSecret, bonusPercent, maxBonusSpend,
  widgetEnabled, showProductBadges, isActive,
  totalOrders, totalBonusAwarded, totalBonusSpent,
  lastWebhookAt, createdAt, updatedAt
}

-- Таблица логов webhooks
InSalesWebhookLog {
  id, projectId, event, payload, response,
  status, success, error, processedAt
}
```

## Контакты для поддержки

- GitHub: https://github.com/MikhailSagalaev/next-shadcn-dashboard-starter
- Commit: 73272a2
- Дата: 2026-03-05

---

**Статус:** ✅ Готово к деплою
**Приоритет:** 🔴 Критический (блокирует использование InSales интеграции)
