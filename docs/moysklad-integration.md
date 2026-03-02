# Интеграция с МойСклад API

> **Статус:** 📋 Планирование  
> **Версия API:** 1.0  
> **Документация:** https://dev.moysklad.ru/doc/api/loyalty/1.0/

## 🎯 Бизнес-задача

**Проблема:** Клиент имеет:
- **Офлайн точку** → бонусы начисляются в МойСклад
- **Интернет-магазин** → бонусы начисляются в нашей системе

**Решение:** Единый баланс бонусов с автоматической синхронизацией между системами

## 🔄 Принцип работы

```
Офлайн покупка          Онлайн покупка
      ↓                        ↓
  МойСклад  ←─────────→  Наша система
      ↓                        ↓
  +100 бонусов            +50 бонусов
      ↓                        ↓
  Синхронизация →      ← Синхронизация
      ↓                        ↓
  Единый баланс: 150 бонусов
```

## 🎯 Цели интеграции

1. **Единый баланс** - клиент видит одинаковые бонусы везде
2. **Двусторонняя синхронизация** - изменения в любой системе отражаются в другой
3. **Идентификация клиента** - по телефону/email
4. **Реалтайм обновления** - через webhook

## 📐 Архитектура синхронизации

### Схема работы

```
┌──────────────────────────────────────────────────────────┐
│                    КЛИЕНТ                                 │
│  Баланс: 150 бонусов (синхронизирован)                   │
└──────────────────────────────────────────────────────────┘
                    ↓                ↓
        ┌───────────────┐    ┌──────────────┐
        │  ОФЛАЙН       │    │   ОНЛАЙН     │
        │  (МойСклад)   │    │ (Наша система)│
        └───────┬───────┘    └──────┬───────┘
                │                   │
                │  Webhook          │  Webhook
                ↓                   ↓
        ┌───────────────────────────────────┐
        │   Sync Service (Наша система)     │
        │   - Получает события              │
        │   - Синхронизирует балансы        │
        │   - Разрешает конфликты           │
        └───────────────────────────────────┘
```

### Ключевые принципы

1. **МойСклад = Source of Truth для офлайн**
2. **Наша система = Source of Truth для онлайн**
3. **Синхронизация через webhook в обе стороны**
4. **Идентификация клиента по телефону** (основной ключ)

### Модель данных

```prisma
model MoySkladIntegration {
  id                String   @id @default(cuid())
  projectId         String
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Credentials
  accountId         String   // ID организации в МойСклад
  apiToken          String   // Bearer token для API
  
  // Настройки синхронизации
  syncDirection     SyncDirection @default(BIDIRECTIONAL)
  syncBonuses       Boolean  @default(true)
  syncTransactions  Boolean  @default(true)
  
  // Маппинг полей
  phoneFieldName    String   @default("phone")
  emailFieldName    String   @default("email")
  
  // Webhook settings
  webhookUrl        String?  // URL для получения событий от МойСклад
  webhookSecret     String?  // Secret для валидации webhook
  
  isActive          Boolean  @default(true)
  lastSyncAt        DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([projectId])
}

enum SyncDirection {
  MOYSKLAD_TO_US    // Только из МойСклад в нашу систему
  US_TO_MOYSKLAD    // Только из нашей системы в МойСклад
  BIDIRECTIONAL     // Двусторонняя синхронизация
}

model MoySkladSyncLog {
  id            String   @id @default(cuid())
  integrationId String
  
  operation     String   // "bonus_accrual", "bonus_spending", "balance_sync"
  direction     String   // "incoming", "outgoing"
  
  moySkladId    String?  // ID сущности в МойСклад
  userId        String?  // ID пользователя в нашей системе
  
  requestData   Json?
  responseData  Json?
  
  status        String   // "success", "error", "pending"
  errorMessage  String?
  
  createdAt     DateTime @default(now())
  
  @@index([integrationId, createdAt])
  @@index([userId])
}
```

## 🔄 Сценарии синхронизации

### Сценарий 1: Офлайн покупка (МойСклад → Наша система)

**Что происходит:**
1. Клиент покупает в офлайн точке
2. Кассир пробивает чек в МойСклад
3. МойСклад начисляет бонусы клиенту
4. МойСклад отправляет webhook в нашу систему
5. Наша система:
   - Находит клиента по телефону
   - Синхронизирует баланс (добавляет те же бонусы)
   - Отправляет уведомление в Telegram

**Пример:**
```
Офлайн: Покупка 5000₽ → +250 бонусов в МойСклад
   ↓
Webhook → Наша система
   ↓
Наша система: +250 бонусов клиенту
   ↓
Telegram: "Вам начислено 250 бонусов за покупку в магазине"
```

### Сценарий 2: Онлайн покупка (Наша система → МойСклад)

**Что происходит:**
1. Клиент покупает в интернет-магазине
2. Webhook от Tilda/сайта → наша система
3. Наша система начисляет бонусы
4. Наша система отправляет транзакцию в МойСклад API
5. МойСклад синхронизирует баланс

**Пример:**
```
Онлайн: Покупка 3000₽ → +150 бонусов в нашей системе
   ↓
API запрос → МойСклад
   ↓
МойСклад: +150 бонусов клиенту
   ↓
Telegram: "Вам начислено 150 бонусов за онлайн покупку"
```

### Сценарий 3: Списание бонусов онлайн

**Что происходит:**
1. Клиент использует бонусы при онлайн оплате
2. Наша система списывает бонусы
3. Отправляем транзакцию списания в МойСклад
4. МойСклад синхронизирует баланс

**Пример:**
```
Онлайн: Оплата 2000₽, списано 500 бонусов
   ↓
Наша система: -500 бонусов
   ↓
API запрос → МойСклад: -500 бонусов
   ↓
Балансы синхронизированы
```

### Сценарий 4: Списание бонусов офлайн

**Что происходит:**
1. Клиент использует бонусы в офлайн точке
2. МойСклад списывает бонусы
3. Webhook → наша система
4. Наша система синхронизирует баланс

**Пример:**
```
Офлайн: Оплата 1000₽, списано 300 бонусов
   ↓
МойСклад: -300 бонусов
   ↓
Webhook → Наша система: -300 бонусов
   ↓
Балансы синхронизированы
```

### Сценарий 5: Проверка баланса

**Telegram Bot:**
```
Клиент: /balance
   ↓
Наша система: баланс = 450
МойСклад API: баланс = 450
   ↓
Ответ: "Ваш баланс: 450 бонусов ✅"
```

**При расхождении:**
```
Клиент: /balance
   ↓
Наша система: баланс = 450
МойСклад API: баланс = 500
   ↓
Ответ: "⚠️ Обнаружено расхождение:
- Онлайн: 450 бонусов
- Офлайн: 500 бонусов
Синхронизация запущена..."
   ↓
Автоматическая сверка и исправление
```

## 🔌 API интеграция

### Аутентификация

```typescript
// src/lib/moysklad/client.ts
import axios, { AxiosInstance } from 'axios';

export class MoySkladClient {
  private client: AxiosInstance;
  
  constructor(accountId: string, apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.moysklad.ru/api/remap/1.0',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Методы для работы с API
}
```

### Основные методы API

#### 1. Получение контрагента по телефону

```typescript
async findCounterpartyByPhone(phone: string) {
  const response = await this.client.get('/entity/counterparty', {
    params: {
      filter: `phone=${phone}`
    }
  });
  
  return response.data.rows[0] || null;
}
```

#### 2. Начисление бонусов

```typescript
async accrueBonus(counterpartyId: string, amount: number, comment: string) {
  const response = await this.client.post('/entity/bonustransaction', {
    bonusProgram: {
      meta: {
        href: 'https://api.moysklad.ru/api/remap/1.0/entity/bonusprogram/[id]',
        type: 'bonusprogram'
      }
    },
    agent: {
      meta: {
        href: `https://api.moysklad.ru/api/remap/1.0/entity/counterparty/${counterpartyId}`,
        type: 'counterparty'
      }
    },
    bonusValue: amount,
    transactionType: 'EARNING',
    transactionStatus: 'COMPLETED',
    moment: new Date().toISOString(),
    description: comment
  });
  
  return response.data;
}
```

#### 3. Списание бонусов

```typescript
async spendBonus(counterpartyId: string, amount: number, comment: string) {
  const response = await this.client.post('/entity/bonustransaction', {
    bonusProgram: {
      meta: {
        href: 'https://api.moysklad.ru/api/remap/1.0/entity/bonusprogram/[id]',
        type: 'bonusprogram'
      }
    },
    agent: {
      meta: {
        href: `https://api.moysklad.ru/api/remap/1.0/entity/counterparty/${counterpartyId}`,
        type: 'counterparty'
      }
    },
    bonusValue: amount,
    transactionType: 'SPENDING',
    transactionStatus: 'COMPLETED',
    moment: new Date().toISOString(),
    description: comment
  });
  
  return response.data;
}
```

#### 4. Получение баланса

```typescript
async getBalance(counterpartyId: string) {
  const response = await this.client.get(`/entity/counterparty/${counterpartyId}`);
  
  return {
    balance: response.data.bonusPoints || 0,
    counterparty: response.data
  };
}
```

## 🎯 Webhook обработка

### Входящий webhook от МойСклад

```typescript
// src/app/api/webhook/moysklad/[projectId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MoySkladClient } from '@/lib/moysklad/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    
    // 1. Получаем настройки интеграции
    const integration = await db.moySkladIntegration.findUnique({
      where: { projectId },
      include: { project: true }
    });
    
    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { error: 'Integration not found or inactive' },
        { status: 404 }
      );
    }
    
    // 2. Валидация webhook secret
    const signature = request.headers.get('X-MoySklad-Signature');
    if (!validateSignature(signature, integration.webhookSecret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // 3. Парсим данные
    const payload = await request.json();
    const { action, events } = payload;
    
    // 4. Обрабатываем события
    for (const event of events) {
      await processEvent(integration, event);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    logger.error('MoySklad webhook error', { error }, 'moysklad-webhook');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processEvent(integration: any, event: any) {
  const { action, meta } = event;
  
  switch (action) {
    case 'CREATE':
    case 'UPDATE':
      if (meta.type === 'demand') {
        // Обработка продажи
        await handleSale(integration, meta.href);
      }
      break;
      
    case 'DELETE':
      // Обработка удаления
      break;
  }
}

async function handleSale(integration: any, saleHref: string) {
  const client = new MoySkladClient(
    integration.accountId,
    integration.apiToken
  );
  
  // 1. Получаем данные о продаже
  const sale = await client.getSale(saleHref);
  
  // 2. Находим контрагента
  const counterparty = await client.getCounterparty(sale.agent.meta.href);
  
  // 3. Находим/создаем пользователя в нашей системе
  const user = await findOrCreateUser(
    integration.projectId,
    counterparty.phone,
    counterparty.email,
    counterparty.name
  );
  
  // 4. Применяем workflow правила
  const bonusAmount = calculateBonus(
    integration.project,
    sale.sum,
    sale.positions
  );
  
  // 5. Начисляем бонусы
  if (bonusAmount > 0) {
    await db.bonus.create({
      data: {
        userId: user.id,
        projectId: integration.projectId,
        amount: bonusAmount,
        source: 'moysklad_sale',
        expiresAt: calculateExpiry(integration.project),
        metadata: {
          moySkladSaleId: sale.id,
          saleSum: sale.sum
        }
      }
    });
    
    // 6. Логируем синхронизацию
    await db.moySkladSyncLog.create({
      data: {
        integrationId: integration.id,
        operation: 'bonus_accrual',
        direction: 'incoming',
        moySkladId: sale.id,
        userId: user.id,
        requestData: sale,
        status: 'success'
      }
    });
    
    // 7. Отправляем уведомление в Telegram
    await sendTelegramNotification(user, bonusAmount);
  }
}
```

## 🔐 Безопасность

### 1. Валидация webhook

```typescript
import crypto from 'crypto';

function validateSignature(signature: string | null, secret: string | null): boolean {
  if (!signature || !secret) return false;
  
  // МойСклад использует HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}
```

### 2. Хранение токенов

```typescript
// Шифрование API токенов в БД
import { encrypt, decrypt } from '@/lib/encryption';

async function saveIntegration(data: any) {
  return db.moySkladIntegration.create({
    data: {
      ...data,
      apiToken: encrypt(data.apiToken)
    }
  });
}

async function getClient(integrationId: string) {
  const integration = await db.moySkladIntegration.findUnique({
    where: { id: integrationId }
  });
  
  return new MoySkladClient(
    integration.accountId,
    decrypt(integration.apiToken)
  );
}
```

## 📊 UI для настройки интеграции

### Страница настроек

```typescript
// src/app/dashboard/projects/[id]/integrations/moysklad/page.tsx

export default async function MoySkladIntegrationPage({ params }: Props) {
  const integration = await getMoySkladIntegration(params.id);
  
  return (
    <div className='space-y-6'>
      <Heading
        title='Интеграция с МойСклад'
        description='Синхронизация бонусов с программой лояльности МойСклад'
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Настройки подключения</CardTitle>
        </CardHeader>
        <CardContent>
          <MoySkladIntegrationForm integration={integration} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>История синхронизации</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncLogTable integrationId={integration?.id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Форма настройки

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  accountId: z.string().min(1, 'Обязательное поле'),
  apiToken: z.string().min(1, 'Обязательное поле'),
  syncDirection: z.enum(['MOYSKLAD_TO_US', 'US_TO_MOYSKLAD', 'BIDIRECTIONAL']),
  syncBonuses: z.boolean(),
  syncTransactions: z.boolean(),
  phoneFieldName: z.string().default('phone'),
  emailFieldName: z.string().default('email')
});

export function MoySkladIntegrationForm({ integration }: Props) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: integration || {
      syncDirection: 'BIDIRECTIONAL',
      syncBonuses: true,
      syncTransactions: true,
      phoneFieldName: 'phone',
      emailFieldName: 'email'
    }
  });
  
  const onSubmit = async (data: z.infer<typeof schema>) => {
    // Сохранение настроек
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='accountId'
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID организации</FormLabel>
              <FormControl>
                <Input {...field} placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' />
              </FormControl>
              <FormDescription>
                Найдите в настройках МойСклад
              </FormDescription>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='apiToken'
          render={({ field }) => (
            <FormItem>
              <FormLabel>API токен</FormLabel>
              <FormControl>
                <Input {...field} type='password' />
              </FormControl>
              <FormDescription>
                Bearer токен для доступа к API
              </FormDescription>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='syncDirection'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Направление синхронизации</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='BIDIRECTIONAL'>
                    Двусторонняя
                  </SelectItem>
                  <SelectItem value='MOYSKLAD_TO_US'>
                    Только из МойСклад
                  </SelectItem>
                  <SelectItem value='US_TO_MOYSKLAD'>
                    Только в МойСклад
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        
        <div className='flex gap-4'>
          <FormField
            control={form.control}
            name='syncBonuses'
            render={({ field }) => (
              <FormItem className='flex items-center gap-2'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className='!mt-0'>Синхронизировать бонусы</FormLabel>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name='syncTransactions'
            render={({ field }) => (
              <FormItem className='flex items-center gap-2'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className='!mt-0'>Синхронизировать транзакции</FormLabel>
              </FormItem>
            )}
          />
        </div>
        
        <Button type='submit'>Сохранить настройки</Button>
      </form>
    </Form>
  );
}
```

## 🧪 Тестирование

### 1. Тест подключения

```typescript
// src/lib/moysklad/__tests__/client.test.ts

describe('MoySkladClient', () => {
  it('should authenticate successfully', async () => {
    const client = new MoySkladClient(
      process.env.MOYSKLAD_ACCOUNT_ID!,
      process.env.MOYSKLAD_API_TOKEN!
    );
    
    const result = await client.testConnection();
    expect(result).toBe(true);
  });
  
  it('should find counterparty by phone', async () => {
    const client = new MoySkladClient(
      process.env.MOYSKLAD_ACCOUNT_ID!,
      process.env.MOYSKLAD_API_TOKEN!
    );
    
    const counterparty = await client.findCounterpartyByPhone('+79991234567');
    expect(counterparty).toBeDefined();
  });
});
```

### 2. Тест webhook

```bash
# Отправка тестового webhook
curl -X POST http://localhost:3000/api/webhook/moysklad/[projectId] \
  -H "Content-Type: application/json" \
  -H "X-MoySklad-Signature: [signature]" \
  -d '{
    "action": "CREATE",
    "events": [{
      "meta": {
        "type": "demand",
        "href": "https://api.moysklad.ru/api/remap/1.0/entity/demand/[id]"
      }
    }]
  }'
```

## 🎯 Стратегия синхронизации

### Подход: Event-Driven Sync

**Принцип:** Каждое изменение бонусов генерирует событие, которое синхронизируется в другую систему.

### Идентификация клиента

**Основной ключ:** Номер телефона (обязательный)
**Дополнительный:** Email (опциональный)

```typescript
// Поиск клиента
async function findCustomer(phone: string, email?: string) {
  // 1. Ищем в нашей БД
  const ourUser = await db.user.findFirst({
    where: { 
      OR: [
        { phone },
        { email: email || undefined }
      ]
    }
  });
  
  // 2. Ищем в МойСклад
  const msClient = new MoySkladClient(...);
  const msCounterparty = await msClient.findCounterpartyByPhone(phone);
  
  // 3. Связываем аккаунты
  if (ourUser && msCounterparty) {
    await linkAccounts(ourUser.id, msCounterparty.id);
  }
  
  return { ourUser, msCounterparty };
}
```

### Разрешение конфликтов

**Правило:** Последняя транзакция побеждает (Last Write Wins)

```typescript
async function resolveConflict(userId: string) {
  // 1. Получаем балансы
  const ourBalance = await getOurBalance(userId);
  const msBalance = await getMoySkladBalance(userId);
  
  // 2. Получаем последние транзакции
  const ourLastTx = await getLastTransaction(userId, 'our_system');
  const msLastTx = await getLastTransaction(userId, 'moysklad');
  
  // 3. Определяем актуальный баланс
  if (ourLastTx.createdAt > msLastTx.createdAt) {
    // Наша система новее - синхронизируем в МойСклад
    await syncToMoySklad(userId, ourBalance);
  } else {
    // МойСклад новее - синхронизируем к нам
    await syncFromMoySklad(userId, msBalance);
  }
}
```

## 📋 План внедрения

### Этап 1: Подготовка (2-3 дня)

**Задачи:**
- [ ] Создать модели БД
  - `MoySkladIntegration` - настройки подключения
  - `MoySkladSyncLog` - лог синхронизации
  - `UserMoySkladLink` - связь User ↔ Counterparty
- [ ] Добавить поля в User:
  - `moySkladCounterpartyId` - ID в МойСклад
  - `lastSyncAt` - время последней синхронизации
- [ ] Получить от клиента:
  - Account ID МойСклад
  - API Token
  - ID программы лояльности

**Миграция:**
```sql
-- Добавить поля в User
ALTER TABLE "User" ADD COLUMN "moySkladCounterpartyId" TEXT;
ALTER TABLE "User" ADD COLUMN "lastSyncAt" TIMESTAMP;

-- Создать таблицу интеграции
CREATE TABLE "MoySkladIntegration" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "accountId" TEXT NOT NULL,
  "apiToken" TEXT NOT NULL,
  "bonusProgramId" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Создать таблицу логов
CREATE TABLE "MoySkladSyncLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" DECIMAL(10,2),
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

### Этап 2: Базовая синхронизация (3-4 дня)

**2.1. МойСклад → Наша система (офлайн покупки)**

- [ ] Создать MoySkladClient для работы с API
- [ ] Реализовать webhook endpoint: `POST /api/webhook/moysklad/[projectId]`
- [ ] Обработка событий:
  - Начисление бонусов (bonustransaction CREATE, type=EARNING)
  - Списание бонусов (bonustransaction CREATE, type=SPENDING)
- [ ] Поиск/создание User по телефону
- [ ] Синхронизация баланса
- [ ] Логирование операций

**2.2. Наша система → МойСклад (онлайн покупки)**

- [ ] При начислении бонусов онлайн:
  - Отправить транзакцию в МойСклад API
  - Логировать результат
- [ ] При списании бонусов онлайн:
  - Отправить транзакцию в МойСклад API
  - Логировать результат

**Код:**
```typescript
// src/lib/moysklad/sync-service.ts

export class MoySkladSyncService {
  // Синхронизация начисления
  async syncBonusAccrual(userId: string, amount: number, source: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    const integration = await getMoySkladIntegration(user.projectId);
    
    if (!integration?.isActive) return;
    
    const client = new MoySkladClient(integration.accountId, integration.apiToken);
    
    try {
      // Отправляем в МойСклад
      await client.accrueBonus(
        user.moySkladCounterpartyId,
        amount,
        `Онлайн покупка (${source})`
      );
      
      // Логируем
      await db.moySkladSyncLog.create({
        data: {
          userId,
          operation: 'bonus_accrual',
          direction: 'outgoing',
          amount,
          status: 'success'
        }
      });
    } catch (error) {
      // Логируем ошибку
      await db.moySkladSyncLog.create({
        data: {
          userId,
          operation: 'bonus_accrual',
          direction: 'outgoing',
          amount,
          status: 'error',
          errorMessage: error.message
        }
      });
    }
  }
  
  // Синхронизация списания
  async syncBonusSpending(userId: string, amount: number) {
    // Аналогично
  }
}
```

### Этап 3: UI и настройка (2-3 дня)

- [ ] Страница настройки интеграции:
  - `/dashboard/projects/[id]/integrations/moysklad`
- [ ] Форма подключения:
  - Account ID
  - API Token
  - Bonus Program ID
  - Тест подключения
- [ ] История синхронизации:
  - Таблица с логами
  - Фильтры по статусу
  - Детали ошибок
- [ ] Ручная синхронизация:
  - Кнопка "Синхронизировать все"
  - Синхронизация конкретного пользователя

### Этап 4: Проверка баланса (1-2 дня)

- [ ] Добавить в Telegram bot команду `/balance`:
  - Показывать баланс из нашей системы
  - Запрашивать баланс из МойСклад
  - Сравнивать и показывать расхождения
- [ ] Автоматическая сверка при расхождении:
  - Определить актуальный баланс
  - Синхронизировать
  - Уведомить пользователя

### Этап 5: Тестирование (2-3 дня)

**Тестовые сценарии:**

1. **Офлайн покупка:**
   - Создать продажу в МойСклад
   - Проверить начисление в нашей системе
   - Проверить уведомление в Telegram

2. **Онлайн покупка:**
   - Webhook от Tilda
   - Проверить начисление в обеих системах
   - Проверить уведомление

3. **Списание офлайн:**
   - Списать бонусы в МойСклад
   - Проверить синхронизацию

4. **Списание онлайн:**
   - Списать бонусы в нашей системе
   - Проверить синхронизацию в МойСклад

5. **Проверка баланса:**
   - Команда `/balance` в боте
   - Проверить корректность данных

6. **Разрешение конфликтов:**
   - Создать расхождение балансов
   - Проверить автоматическую сверку

### Этап 6: Запуск (1 день)

- [ ] Настроить webhook в МойСклад
- [ ] Подключить интеграцию для проекта
- [ ] Провести первичную синхронизацию существующих клиентов
- [ ] Мониторинг первых транзакций
- [ ] Документация для клиента

## ⏱️ Общая оценка времени

**Разработка:** 10-15 дней  
**Тестирование:** 2-3 дня  
**Запуск:** 1 день  

**Итого:** ~2-3 недели

## 🔗 Полезные ссылки

- [МойСклад API Документация](https://dev.moysklad.ru/doc/api/loyalty/1.0/)
- [Программа лояльности](https://dev.moysklad.ru/doc/api/loyalty/1.0/#scenarij-raboty)
- [Webhook настройка](https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/#suschnosti-vebhuki)
- [Аутентификация](https://dev.moysklad.ru/doc/api/remap/1.2/#mojsklad-json-api-obschie-swedeniq-autentifikaciq)

## 💡 Рекомендации

1. **Начните с односторонней синхронизации** (МойСклад → Наша система)
2. **Используйте идемпотентность** для безопасной обработки дубликатов
3. **Логируйте все операции** для отладки
4. **Добавьте retry механизм** для API запросов
5. **Тестируйте на staging** перед production
6. **Документируйте маппинг полей** для каждого клиента
