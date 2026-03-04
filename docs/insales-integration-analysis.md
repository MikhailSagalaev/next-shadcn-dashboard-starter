# InSales Integration Analysis

> **Дата анализа:** 2026-03-02  
> **Статус:** Исследование и планирование

## 📊 Обзор платформы InSales

InSales - российская SaaS платформа для создания интернет-магазинов, аналог Shopify для российского рынка.

### Ключевые особенности:
- Конструктор интернет-магазинов
- REST API для интеграций
- Поддержка приложений и расширений
- Активное сообщество разработчиков
- Лимит API: 500 запросов за 5 минут

## 🔍 Доступные варианты интеграции

### 1. ✅ REST API (Рекомендуется)

**Описание:** Полноценный REST API для управления данными магазина

**Возможности:**
- Получение данных о заказах (Orders API)
- Управление клиентами (Clients API)
- Работа с товарами (Products API)
- Webhooks для событий (создание заказа, регистрация клиента)

**Преимущества:**
- ✅ Официальная поддержка
- ✅ Полный контроль над данными
- ✅ Webhooks для real-time уведомлений
- ✅ Готовые SDK (Ruby, PHP, Node.js)
- ✅ Документация на GitHub

**Недостатки:**
- ⚠️ Требует регистрации приложения в InSales
- ⚠️ Необходима OAuth авторизация
- ⚠️ Лимиты API (500 req/5min)

**Ресурсы:**
- GitHub: https://github.com/insales/insales_api
- Ruby Gem: `insales_api`
- Node.js: `insales` npm package

### 2. ✅ JavaScript Widget (Рекомендуется для UI)

**Описание:** Встраиваемый JavaScript виджет на страницы магазина

**Возможности:**
- Отображение баланса бонусов
- Форма применения бонусов при оформлении заказа
- Регистрация в бонусной программе
- Интеграция с корзиной InSales

**Преимущества:**
- ✅ Не требует серверной интеграции
- ✅ Работает на стороне клиента
- ✅ Легко встраивается через редактор тем
- ✅ Доступ к InSales JavaScript API

**Недостатки:**
- ⚠️ Ограниченный функционал
- ⚠️ Зависит от темы магазина
- ⚠️ Требует кастомизации под каждый магазин

### 3. ❌ Приложение в маркетплейсе (НЕ рекомендуется на старте)

**Описание:** Публикация приложения в маркетплейсе InSales

**Преимущества:**
- ✅ Видимость для всех пользователей InSales
- ✅ Встроенная система биллинга
- ✅ Доверие пользователей

**Недостатки:**
- ❌ Длительный процесс модерации
- ❌ Требования к документации
- ❌ Необходимость поддержки
- ❌ Комиссия платформы

## 🎯 Рекомендуемый подход для нашей системы

### Гибридная интеграция: REST API + JavaScript Widget

Комбинация серверной интеграции через REST API и клиентского виджета.

## 📋 План реализации

### Фаза 1: REST API Integration (Backend)

#### 1.1 Webhooks для событий

**События для подписки:**
- `orders/create` - создание заказа → начисление бонусов
- `orders/update` - обновление заказа → обработка статусов
- `clients/create` - регистрация клиента → приветственные бонусы
- `clients/update` - обновление клиента → синхронизация данных

**Endpoint структура:**
```
POST https://gupil.ru/api/insales/webhook/{projectId}
```

**Payload пример (orders/create):**
```json
{
  "event": "orders/create",
  "order": {
    "id": 12345,
    "number": "R-001",
    "client": {
      "id": 67890,
      "email": "customer@example.com",
      "phone": "+79001234567",
      "name": "Иван Иванов"
    },
    "total_price": "5000.00",
    "items_price": "5000.00",
    "payment_status": "paid",
    "fulfillment_status": "fulfilled"
  }
}
```

#### 1.2 API для получения баланса

**Endpoint:**
```
GET https://gupil.ru/api/insales/balance/{projectId}
?email=customer@example.com
&phone=+79001234567
```

**Response:**
```json
{
  "success": true,
  "balance": 500,
  "currency": "RUB",
  "user": {
    "id": "user_id",
    "email": "customer@example.com",
    "level": "Золотой"
  }
}
```

#### 1.3 API для применения бонусов

**Endpoint:**
```
POST https://gupil.ru/api/insales/apply-bonuses/{projectId}
```

**Request:**
```json
{
  "email": "customer@example.com",
  "phone": "+79001234567",
  "bonusAmount": 100,
  "orderId": "R-001",
  "orderTotal": 5000
}
```

**Response:**
```json
{
  "success": true,
  "applied": 100,
  "newBalance": 400,
  "discount": 100
}
```

### Фаза 2: JavaScript Widget (Frontend)

#### 2.1 Виджет баланса бонусов

**Размещение:** Личный кабинет, хедер сайта

```javascript
<!-- InSales Bonus Widget -->
<div id="insales-bonus-widget"></div>
<script>
(function() {
  var projectId = 'YOUR_PROJECT_ID';
  var script = document.createElement('script');
  script.src = 'https://gupil.ru/widget/insales-loader.js';
  script.setAttribute('data-project-id', projectId);
  document.head.appendChild(script);
})();
</script>
```

#### 2.2 Виджет применения бонусов в корзине

**Размещение:** Страница оформления заказа

```javascript
<!-- Bonus Application Widget -->
<div class="bonus-application">
  <label>
    <input type="checkbox" id="use-bonuses" />
    Использовать бонусы (доступно: <span id="bonus-balance">0</span>)
  </label>
  <input 
    type="number" 
    id="bonus-amount" 
    placeholder="Сумма бонусов"
    max="0"
    disabled
  />
</div>

<script>
// Интеграция с InSales Cart API
EventBus.subscribe('cart:update', function(cart) {
  // Обновляем доступные бонусы
  fetchBonusBalance(cart.client.email);
});
</script>
```

#### 2.3 Бейджи на товарах

**Размещение:** Карточки товаров, страница товара

```javascript
<!-- Product Bonus Badge -->
<div class="product-bonus-badge">
  +<span class="bonus-amount">50</span> бонусов
</div>

<script>
// Расчет бонусов на основе цены товара
var productPrice = {{ product.price }};
var bonusPercent = 10; // Получаем из настроек проекта
var bonusAmount = Math.floor(productPrice * bonusPercent / 100);
document.querySelector('.bonus-amount').textContent = bonusAmount;
</script>
```

### Фаза 3: Админ панель

#### 3.1 Страница настроек интеграции

**Путь:** `/dashboard/projects/[id]/integrations/insales`

**Настройки:**
- API Key (из InSales)
- API Password (из InSales)
- Shop Domain (myshop.myinsales.ru)
- Webhook Secret (генерируется автоматически)
- Процент начисления бонусов
- Максимум оплаты бонусами (%)

#### 3.2 Мониторинг webhook логов

**Функционал:**
- История всех webhook вызовов
- Статус обработки (success/error)
- Детали ошибок
- Возможность повторной обработки

## 🔧 Техническая реализация

### Database Schema

```prisma
model InSalesIntegration {
  id            String   @id @default(cuid())
  projectId     String   @unique @map("project_id")
  
  // Credentials
  apiKey        String   @map("api_key")
  apiPassword   String   @map("api_password") // Encrypted
  shopDomain    String   @map("shop_domain")
  webhookSecret String   @map("webhook_secret")
  
  // Settings
  bonusPercent      Int     @default(10) @map("bonus_percent")
  maxBonusSpend     Int     @default(50) @map("max_bonus_spend")
  isActive          Boolean @default(false) @map("is_active")
  
  // Stats
  lastWebhookAt     DateTime? @map("last_webhook_at")
  totalOrders       Int       @default(0) @map("total_orders")
  totalBonusAwarded Decimal   @default(0) @map("total_bonus_awarded") @db.Decimal(10, 2)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@map("insales_integrations")
}

model InSalesWebhookLog {
  id            String   @id @default(cuid())
  projectId     String   @map("project_id")
  
  event         String   // orders/create, clients/create, etc.
  payload       Json
  response      Json?
  status        Int      // HTTP status
  success       Boolean
  error         String?
  
  processedAt   DateTime @default(now()) @map("processed_at")
  
  @@index([projectId, processedAt])
  @@map("insales_webhook_logs")
}
```

### API Endpoints

```typescript
// Webhook receiver
POST /api/insales/webhook/[projectId]

// Balance check
GET /api/insales/balance/[projectId]
  ?email=...&phone=...

// Apply bonuses
POST /api/insales/apply-bonuses/[projectId]
  body: { email, phone, bonusAmount, orderId, orderTotal }

// Widget settings
GET /api/insales/widget-settings/[projectId]

// Admin: Create/Update integration
POST /api/projects/[id]/integrations/insales
PUT /api/projects/[id]/integrations/insales

// Admin: Webhook logs
GET /api/projects/[id]/integrations/insales/logs
```

### Services

```typescript
// src/lib/insales/insales-service.ts
export class InSalesService {
  async handleOrderCreate(projectId: string, order: InSalesOrder): Promise<void>
  async handleClientCreate(projectId: string, client: InSalesClient): Promise<void>
  async getBonusBalance(projectId: string, identifier: string): Promise<number>
  async applyBonuses(projectId: string, data: ApplyBonusesData): Promise<ApplyBonusesResult>
}

// src/lib/insales/insales-api-client.ts
export class InSalesApiClient {
  constructor(apiKey: string, apiPassword: string, shopDomain: string)
  
  async getOrder(orderId: number): Promise<InSalesOrder>
  async getClient(clientId: number): Promise<InSalesClient>
  async updateOrder(orderId: number, data: Partial<InSalesOrder>): Promise<void>
}
```

## 📊 Сравнение с существующими интеграциями

| Критерий | Tilda | МойСклад | InSales |
|----------|-------|----------|---------|
| **Тип** | Webhook | Loyalty API Provider | REST API + Webhooks |
| **Сложность** | Низкая | Высокая | Средняя |
| **Контроль** | Ограниченный | Полный | Полный |
| **Real-time** | Да | Да | Да |
| **Виджет** | Да | Нет | Да |
| **OAuth** | Нет | Нет | Да |
| **Лимиты API** | Нет | 1000 req/min | 500 req/5min |

## ⚡ Преимущества нашего подхода

1. **Гибкость:** Комбинация серверной и клиентской интеграции
2. **Универсальность:** Работает с любой темой InSales
3. **Масштабируемость:** Легко добавить новые функции
4. **Надежность:** Webhook + API fallback
5. **UX:** Нативная интеграция в интерфейс магазина

## 🚀 Roadmap

### MVP (2-3 недели)
- ✅ Webhook обработка (orders/create, clients/create)
- ✅ API для баланса и применения бонусов
- ✅ Базовый JavaScript виджет
- ✅ Админ панель для настройки

### V1.0 (4-6 недель)
- ✅ Полная интеграция с InSales Cart API
- ✅ Бейджи на товарах
- ✅ Личный кабинет клиента
- ✅ Детальная аналитика

### V2.0 (будущее)
- ✅ Приложение в маркетплейсе InSales
- ✅ Автоматическая установка
- ✅ Расширенные настройки виджета
- ✅ A/B тестирование

## 📚 Ресурсы для разработки

### Официальные
- GitHub: https://github.com/insales/insales_api
- Ruby Gem: https://rubygems.org/gems/insales_api
- Node.js Package: https://www.npmjs.com/package/insales

### Сообщество
- Gist с примерами: https://gist.github.com/vorvulev/e7c5259d7325cb4cfc61a7e9feeb1196
- Форумы разработчиков InSales

## ✅ Вывод

**Рекомендуемый подход:** Гибридная интеграция (REST API + JavaScript Widget)

**Причины:**
1. Максимальная гибкость и контроль
2. Работает с любым магазином InSales
3. Не требует публикации в маркетплейсе на старте
4. Легко масштабируется
5. Соответствует нашей архитектуре (как Tilda + МойСклад)

**Следующие шаги:**
1. Создать спецификацию интеграции
2. Реализовать webhook endpoints
3. Разработать JavaScript виджет
4. Создать UI для настройки
5. Протестировать на тестовом магазине InSales
