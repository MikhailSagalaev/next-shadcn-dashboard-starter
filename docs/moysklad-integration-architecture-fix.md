# МойСклад Integration - Architecture Fix

## Проблема

Текущая реализация основана на неправильном понимании МойСклад API. 

**Что мы реализовали (НЕПРАВИЛЬНО):**
- Мы вызываем МойСклад JSON API
- Мы получаем webhook от МойСклад
- Мы работаем с bonustransaction entities

**Что на самом деле нужно (ПРАВИЛЬНО):**
- МойСклад вызывает НАШИ endpoints (Loyalty API)
- МЫ предоставляем API для МойСклад
- МойСклад отправляет нам данные о продажах/возвратах
- МЫ рассчитываем скидки и бонусы

## Правильная архитектура

### МойСклад Loyalty API - это REVERSE интеграция

```
┌─────────────────┐                           ┌──────────────────┐
│   МойСклад      │  ──── HTTP Requests ────> │  Bonus System    │
│   (Касса/POS)   │                           │  (Наш сервер)    │
│                 │  <─── HTTP Responses ───  │                  │
└─────────────────┘                           └──────────────────┘
```

### Endpoints которые МЫ должны предоставить:

1. **POST /counterparty** - Создание покупателя
2. **GET /counterparty?search=...** - Поиск покупателя
3. **POST /counterparty/detail** - Получение баланса
4. **POST /counterparty/verify** - Запрос кода подтверждения
5. **POST /retaildemand/recalc** - Расчет скидок для продажи
6. **POST /retaildemand/verify** - Подтверждение списания
7. **POST /retaildemand** - Создание продажи
8. **POST /retailsalesreturn** - Создание возврата
9. **GET /giftcard?name=...** - Поиск подарочного сертификата

### Аутентификация

МойСклад отправляет в каждом запросе header:
```
Lognex-Discount-API-Auth-Token: <наш токен>
```

Мы должны проверять этот токен.

### Процесс интеграции

1. **Разработчик создает решение** в каталоге МойСклад
2. **Пользователь устанавливает решение** в своем аккаунте
3. **Пользователь настраивает** через iframe наш сайт
4. **Мы отправляем в МойСклад:**
   - Base URL нашего API (например: `https://gupil.ru/api/moysklad-loyalty/[projectId]`)
   - Auth Token для аутентификации
5. **МойСклад начинает вызывать наши endpoints**

## Что нужно переделать

### 1. Удалить неправильные компоненты:
- ❌ `MoySkladClient` - мы не вызываем их API
- ❌ Webhook endpoint - МойСклад не отправляет webhooks
- ❌ `parseBonusTransaction` - нет таких entities

### 2. Создать правильные endpoints:

```typescript
// POST /api/moysklad-loyalty/[projectId]/counterparty
// Создание покупателя
export async function POST(request: Request) {
  const body = await request.json();
  const token = request.headers.get('Lognex-Discount-API-Auth-Token');
  
  // Validate token
  // Create user in our system
  // Return 201
}

// GET /api/moysklad-loyalty/[projectId]/counterparty
// Поиск покупателя
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search'); // phone or card number
  const retailStoreId = searchParams.get('retailStoreId');
  
  // Search user by phone
  // Return { rows: [...] }
}

// POST /api/moysklad-loyalty/[projectId]/counterparty/detail
// Получение баланса
export async function POST(request: Request) {
  const body = await request.json();
  const counterpartyId = body.meta.id;
  
  // Get user balance
  // Return { bonusProgram: { agentBonusBalance: 500 } }
}

// POST /api/moysklad-loyalty/[projectId]/retaildemand/recalc
// Расчет скидок для продажи
export async function POST(request: Request) {
  const body = await request.json();
  
  // Calculate discounts based on our bonus rules
  // Apply bonuses if transactionType === 'SPENDING'
  // Calculate earned bonuses if transactionType === 'EARNING'
  
  // Return positions with discounts + bonus info
}

// POST /api/moysklad-loyalty/[projectId]/retaildemand
// Создание продажи (фиксация)
export async function POST(request: Request) {
  const body = await request.json();
  
  // Create transaction in our system
  // Accrue or spend bonuses
  // Return 201
}

// POST /api/moysklad-loyalty/[projectId]/retailsalesreturn
// Создание возврата
export async function POST(request: Request) {
  const body = await request.json();
  
  // Reverse bonus transaction
  // Return 201
}
```

### 3. Обновить database schema:

```prisma
model MoySkladIntegration {
  id                String   @id @default(cuid())
  projectId         String   @unique
  
  // Auth token для МойСклад (они отправляют нам)
  authToken         String   @unique
  
  // Base URL который мы предоставляем МойСклад
  baseUrl           String
  
  // Настройки бонусной программы
  bonusPercentage   Decimal  @default(10)
  maxBonusSpend     Decimal  @default(50) // max % оплаты бонусами
  
  isActive          Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 4. Процесс настройки:

1. Пользователь устанавливает наше решение в МойСклад
2. Открывается iframe с нашей страницей настройки
3. Пользователь вводит credentials или регистрируется
4. Мы генерируем уникальный auth token
5. Мы отправляем в МойСклад через их API:
   - `baseUrl`: `https://gupil.ru/api/moysklad-loyalty/{projectId}`
   - `authToken`: сгенерированный токен
6. МойСклад сохраняет эти данные
7. При продажах МойСклад вызывает наши endpoints

## Преимущества правильной архитектуры

1. **Полный контроль** - мы контролируем логику начисления бонусов
2. **Реал-тайм** - расчет происходит прямо в кассе
3. **Гибкость** - можем применять любые правила
4. **Безопасность** - не нужно хранить их API токены

## Следующие шаги

1. Изучить документацию по созданию решений: https://dev.moysklad.ru/doc/api/remap/1.2/
2. Зарегистрироваться в личном кабинете разработчика
3. Создать дескриптор решения с блоком `<loyaltyApi/>`
4. Реализовать все необходимые endpoints
5. Протестировать интеграцию
6. Опубликовать решение в каталоге

## Важно!

Это совершенно другая архитектура. Текущая реализация не подходит для МойСклад Loyalty API.
Нужно начать с нуля с правильным пониманием того, как работает интеграция.
