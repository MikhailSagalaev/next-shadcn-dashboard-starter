# Интеграция с МойСклад через прямой Bonus Transaction API

> **Статус:** 🚀 В разработке  
> **Версия API:** МойСклад JSON API 1.2  
> **Документация:** https://dev.moysklad.ru/doc/api/remap/1.2/#suschnosti-bonusnaq-operaciq

## 🎯 Преимущества прямого подхода

### Почему прямой API лучше LoyaltyAPI:

1. **Бесплатно** - не нужно платить за размещение в marketplace
2. **Проще** - используем готовый МойСклад JSON API
3. **Гибче** - полный контроль над логикой синхронизации
4. **Быстрее** - меньше кода, быстрее разработка

### Сравнение подходов:

| Критерий | LoyaltyAPI (старый) | Direct API (новый) |
|----------|---------------------|-------------------|
| Стоимость | Платное размещение | Бесплатно |
| Сложность | 9 endpoints | 4 метода API |
| Время разработки | 15-20 дней | 9 дней |
| Зависимости | Marketplace | Только МойСклад API |
| Контроль | Ограниченный | Полный |

## 🔄 Принцип работы

```
┌─────────────────────────────────────────────────┐
│         ОНЛАЙН ПОКУПКА (Наша система)           │
│                                                   │
│  1. Webhook от Tilda/сайта                       │
│  2. Начисляем бонусы в нашей БД                  │
│  3. API запрос → МойСклад bonustransaction      │
│  4. МойСклад синхронизирует баланс              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         ОФЛАЙН ПОКУПКА (МойСклад)               │
│                                                   │
│  1. Кассир пробивает чек                         │
│  2. МойСклад начисляет бонусы                    │
│  3. Webhook → Наша система                       │
│  4. Синхронизируем баланс в нашей БД            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         ПРОВЕРКА БАЛАНСА (Telegram Bot)         │
│                                                   │
│  1. Клиент: /balance                             │
│  2. Запрашиваем баланс из МойСклад API          │
│  3. Сравниваем с нашей БД                        │
│  4. При расхождении - автосинхронизация         │
└─────────────────────────────────────────────────┘
```

## 📐 Архитектура

### Компоненты системы:

```
src/
├── lib/
│   └── moysklad/
│       ├── client.ts                    # МойСклад API клиент
│       ├── sync-service.ts              # Сервис синхронизации
│       ├── webhook-handler.ts           # Обработка webhook
│       ├── types.ts                     # TypeScript типы
│       └── encryption.ts                # Шифрование токенов
├── app/
│   ├── api/
│   │   ├── webhook/
│   │   │   └── moysklad/
│   │   │       └── [projectId]/
│   │   │           └── route.ts         # Webhook endpoint
│   │   └── projects/
│   │       └── [id]/
│   │           └── integrations/
│   │               └── moysklad/
│   │                   └── route.ts     # CRUD интеграции
│   └── dashboard/
│       └── projects/
│           └── [id]/
│               └── integrations/
│                   └── moysklad/
│                       ├── page.tsx     # UI настройки
│                       └── components/
│                           ├── integration-form.tsx
│                           ├── sync-logs.tsx
│                           └── test-connection.tsx
└── prisma/
    └── schema.prisma                    # Модели БД
```

## 🗄️ База данных

### Модель интеграции:

```prisma
model MoySkladIntegration {
  id                String   @id @default(cuid())
  projectId         String   @unique
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Credentials (зашифрованы)
  accountId         String   // ID организации в МойСклад
  apiToken          String   // Bearer token для API
  bonusProgramId    String   // ID программы лояльности
  
  // Настройки синхронизации
  syncDirection     SyncDirection @default(BIDIRECTIONAL)
  autoSync          Boolean  @default(true)
  
  // Webhook
  webhookSecret     String?  // Secret для валидации webhook
  
  // Статус
  isActive          Boolean  @default(true)
  lastSyncAt        DateTime?
  lastError         String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  syncLogs          MoySkladSyncLog[]
  
  @@index([projectId])
}

enum SyncDirection {
  MOYSKLAD_TO_US    // Только из МойСклад в нашу систему
  US_TO_MOYSKLAD    // Только из нашей системы в МойСклад
  BIDIRECTIONAL     // Двусторонняя синхронизация (рекомендуется)
}

model MoySkladSyncLog {
  id            String   @id @default(cuid())
  integrationId String
  integration   MoySkladIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  
  // Операция
  operation     String   // "bonus_accrual", "bonus_spending", "balance_sync"
  direction     String   // "incoming" (от МойСклад), "outgoing" (в МойСклад)
  
  // Связи
  moySkladId    String?  // ID транзакции в МойСклад
  userId        String?  // ID пользователя в нашей системе
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // Данные
  amount        Decimal? @db.Decimal(10, 2)
  requestData   Json?
  responseData  Json?
  
  // Результат
  status        String   // "success", "error", "pending"
  errorMessage  String?
  
  createdAt     DateTime @default(now())
  
  @@index([integrationId, createdAt])
  @@index([userId])
  @@index([status])
}

// Добавить в модель User
model User {
  // ... существующие поля
  
  moySkladCounterpartyId String?  // ID контрагента в МойСклад
  moySkladSyncLogs       MoySkladSyncLog[]
  
  @@index([moySkladCounterpartyId])
}
```

## 🔌 МойСклад API Client

### Основные методы:

```typescript
// src/lib/moysklad/client.ts

export class MoySkladClient {
  private baseUrl = 'https://api.moysklad.ru/api/remap/1.2';
  private accountId: string;
  private apiToken: string;
  private bonusProgramId: string;

  constructor(config: MoySkladConfig) {
    this.accountId = config.accountId;
    this.apiToken = decrypt(config.apiToken);
    this.bonusProgramId = config.bonusProgramId;
  }

  /**
   * Начисление бонусов контрагенту
   */
  async accrueBonus(
    counterpartyId: string,
    amount: number,
    comment: string
  ): Promise<BonusTransaction> {
    const response = await fetch(`${this.baseUrl}/entity/bonustransaction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bonusProgram: {
          meta: {
            href: `${this.baseUrl}/entity/bonusprogram/${this.bonusProgramId}`,
            type: 'bonusprogram'
          }
        },
        agent: {
          meta: {
            href: `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
            type: 'counterparty'
          }
        },
        bonusValue: amount,
        transactionType: 'EARNING',
        transactionStatus: 'COMPLETED',
        moment: new Date().toISOString(),
        description: comment
      })
    });

    if (!response.ok) {
      throw new MoySkladApiError(
        `Failed to accrue bonus: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Списание бонусов у контрагента
   */
  async spendBonus(
    counterpartyId: string,
    amount: number,
    comment: string
  ): Promise<BonusTransaction> {
    const response = await fetch(`${this.baseUrl}/entity/bonustransaction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bonusProgram: {
          meta: {
            href: `${this.baseUrl}/entity/bonusprogram/${this.bonusProgramId}`,
            type: 'bonusprogram'
          }
        },
        agent: {
          meta: {
            href: `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
            type: 'counterparty'
          }
        },
        bonusValue: amount,
        transactionType: 'SPENDING',
        transactionStatus: 'COMPLETED',
        moment: new Date().toISOString(),
        description: comment
      })
    });

    if (!response.ok) {
      throw new MoySkladApiError(
        `Failed to spend bonus: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Получение баланса бонусов контрагента
   */
  async getBalance(counterpartyId: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/entity/counterparty/${counterpartyId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new MoySkladApiError(
        `Failed to get balance: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.bonusPoints || 0;
  }

  /**
   * Поиск контрагента по номеру телефона
   */
  async findCounterpartyByPhone(phone: string): Promise<Counterparty | null> {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    const response = await fetch(
      `${this.baseUrl}/entity/counterparty?filter=phone=${encodeURIComponent(normalizedPhone)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new MoySkladApiError(
        `Failed to find counterparty: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.rows[0] || null;
  }

  /**
   * Тест подключения
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/entity/organization`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

## 🔄 Sync Service

### Сервис синхронизации:

```typescript
// src/lib/moysklad/sync-service.ts

export class MoySkladSyncService {
  /**
   * Синхронизация начисления бонусов в МойСклад
   * Вызывается после онлайн покупки
   */
  async syncBonusAccrualToMoySklad(
    userId: string,
    amount: number,
    source: string
  ): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const integration = await db.moySkladIntegration.findUnique({
      where: { projectId: user.projectId }
    });

    if (!integration?.isActive) {
      logger.info('МойСклад integration not active, skipping sync');
      return;
    }

    // Проверяем направление синхронизации
    if (integration.syncDirection === 'MOYSKLAD_TO_US') {
      logger.info('Sync direction is MOYSKLAD_TO_US, skipping outgoing sync');
      return;
    }

    const client = new MoySkladClient({
      accountId: integration.accountId,
      apiToken: integration.apiToken,
      bonusProgramId: integration.bonusProgramId
    });

    try {
      // Находим или создаем контрагента
      let counterpartyId = user.moySkladCounterpartyId;
      
      if (!counterpartyId && user.phone) {
        const counterparty = await client.findCounterpartyByPhone(user.phone);
        if (counterparty) {
          counterpartyId = counterparty.id;
          // Сохраняем связь
          await db.user.update({
            where: { id: userId },
            data: { moySkladCounterpartyId: counterpartyId }
          });
        }
      }

      if (!counterpartyId) {
        throw new Error('Counterparty not found in МойСклад');
      }

      // Начисляем бонусы в МойСклад
      const transaction = await client.accrueBonus(
        counterpartyId,
        amount,
        `Онлайн покупка (${source})`
      );

      // Логируем успешную синхронизацию
      await db.moySkladSyncLog.create({
        data: {
          integrationId: integration.id,
          userId,
          operation: 'bonus_accrual',
          direction: 'outgoing',
          amount,
          moySkladId: transaction.id,
          requestData: { counterpartyId, amount, source },
          responseData: transaction,
          status: 'success'
        }
      });

      // Обновляем время последней синхронизации
      await db.moySkladIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: null }
      });

      logger.info('Bonus accrual synced to МойСклад', {
        userId,
        amount,
        transactionId: transaction.id
      });

    } catch (error) {
      // Логируем ошибку
      await db.moySkladSyncLog.create({
        data: {
          integrationId: integration.id,
          userId,
          operation: 'bonus_accrual',
          direction: 'outgoing',
          amount,
          requestData: { amount, source },
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      // Сохраняем ошибку в интеграции
      await db.moySkladIntegration.update({
        where: { id: integration.id },
        data: { lastError: error instanceof Error ? error.message : 'Unknown error' }
      });

      logger.error('Failed to sync bonus accrual to МойСклад', {
        error,
        userId,
        amount
      });

      // Не бросаем ошибку дальше - синхронизация не критична
    }
  }

  /**
   * Синхронизация списания бонусов в МойСклад
   */
  async syncBonusSpendingToMoySklad(
    userId: string,
    amount: number,
    source: string
  ): Promise<void> {
    // Аналогично accrual, но используем client.spendBonus()
  }

  /**
   * Синхронизация из МойСклад в нашу систему
   * Вызывается из webhook
   */
  async syncFromMoySklad(
    integrationId: string,
    bonusTransaction: MoySkladBonusTransaction
  ): Promise<void> {
    const integration = await db.moySkladIntegration.findUnique({
      where: { id: integrationId },
      include: { project: true }
    });

    if (!integration?.isActive) {
      throw new Error('Integration not active');
    }

    // Проверяем направление синхронизации
    if (integration.syncDirection === 'US_TO_MOYSKLAD') {
      logger.info('Sync direction is US_TO_MOYSKLAD, skipping incoming sync');
      return;
    }

    try {
      // Находим пользователя по counterpartyId
      const counterpartyId = bonusTransaction.agent.meta.href.split('/').pop();
      
      let user = await db.user.findFirst({
        where: {
          projectId: integration.projectId,
          moySkladCounterpartyId: counterpartyId
        }
      });

      // Если пользователь не найден, пытаемся найти по телефону
      if (!user) {
        const client = new MoySkladClient({
          accountId: integration.accountId,
          apiToken: integration.apiToken,
          bonusProgramId: integration.bonusProgramId
        });

        const counterparty = await client.getCounterparty(counterpartyId);
        
        if (counterparty.phone) {
          user = await db.user.findFirst({
            where: {
              projectId: integration.projectId,
              phone: normalizePhoneNumber(counterparty.phone)
            }
          });

          if (user) {
            // Связываем пользователя с контрагентом
            await db.user.update({
              where: { id: user.id },
              data: { moySkladCounterpartyId: counterpartyId }
            });
          }
        }
      }

      if (!user) {
        throw new Error('User not found for counterparty');
      }

      // Применяем транзакцию
      if (bonusTransaction.transactionType === 'EARNING') {
        // Начисление бонусов
        await db.bonus.create({
          data: {
            userId: user.id,
            projectId: integration.projectId,
            amount: bonusTransaction.bonusValue,
            source: 'moysklad_offline',
            expiresAt: calculateBonusExpiry(integration.project),
            metadata: {
              moySkladTransactionId: bonusTransaction.id,
              moment: bonusTransaction.moment
            }
          }
        });

        // Создаем транзакцию
        await db.transaction.create({
          data: {
            userId: user.id,
            projectId: integration.projectId,
            type: 'EARN',
            amount: bonusTransaction.bonusValue,
            description: bonusTransaction.description || 'Офлайн покупка',
            metadata: {
              source: 'moysklad',
              transactionId: bonusTransaction.id
            }
          }
        });

      } else if (bonusTransaction.transactionType === 'SPENDING') {
        // Списание бонусов
        await bonusService.spendBonuses(
          user.id,
          bonusTransaction.bonusValue,
          'moysklad_offline'
        );
      }

      // Логируем успешную синхронизацию
      await db.moySkladSyncLog.create({
        data: {
          integrationId: integration.id,
          userId: user.id,
          operation: bonusTransaction.transactionType === 'EARNING' 
            ? 'bonus_accrual' 
            : 'bonus_spending',
          direction: 'incoming',
          amount: bonusTransaction.bonusValue,
          moySkladId: bonusTransaction.id,
          requestData: bonusTransaction,
          status: 'success'
        }
      });

      // Отправляем уведомление в Telegram
      if (user.telegramChatId) {
        await sendTelegramNotification(user, bonusTransaction);
      }

      logger.info('Synced bonus transaction from МойСклад', {
        userId: user.id,
        transactionId: bonusTransaction.id,
        type: bonusTransaction.transactionType
      });

    } catch (error) {
      // Логируем ошибку
      await db.moySkladSyncLog.create({
        data: {
          integrationId: integration.id,
          operation: 'sync_from_moysklad',
          direction: 'incoming',
          moySkladId: bonusTransaction.id,
          requestData: bonusTransaction,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      logger.error('Failed to sync from МойСклад', {
        error,
        transactionId: bonusTransaction.id
      });

      throw error;
    }
  }

  /**
   * Проверка и синхронизация баланса
   * Используется в команде /balance бота
   */
  async checkAndSyncBalance(userId: string): Promise<BalanceCheckResult> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const integration = await db.moySkladIntegration.findUnique({
      where: { projectId: user.projectId }
    });

    if (!integration?.isActive || !user.moySkladCounterpartyId) {
      // МойСклад не подключен, возвращаем только наш баланс
      const ourBalance = await bonusService.getAvailableBalance(userId);
      return {
        ourBalance,
        moySkladBalance: null,
        synced: true
      };
    }

    const client = new MoySkladClient({
      accountId: integration.accountId,
      apiToken: integration.apiToken,
      bonusProgramId: integration.bonusProgramId
    });

    try {
      // Получаем балансы
      const ourBalance = await bonusService.getAvailableBalance(userId);
      const moySkladBalance = await client.getBalance(user.moySkladCounterpartyId);

      // Проверяем расхождение
      const diff = Math.abs(ourBalance - moySkladBalance);
      const synced = diff < 0.01; // Допускаем погрешность в 1 копейку

      if (!synced) {
        logger.warn('Balance mismatch detected', {
          userId,
          ourBalance,
          moySkladBalance,
          diff
        });

        // TODO: Реализовать автоматическую сверку
        // Пока просто логируем
      }

      return {
        ourBalance,
        moySkladBalance,
        synced
      };

    } catch (error) {
      logger.error('Failed to check balance in МойСклад', { error, userId });
      
      // Возвращаем только наш баланс
      const ourBalance = await bonusService.getAvailableBalance(userId);
      return {
        ourBalance,
        moySkladBalance: null,
        synced: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

## 📝 Следующие шаги

### Этап 1: База данных (1 день)
- [ ] Создать миграцию для `MoySkladIntegration`
- [ ] Создать миграцию для `MoySkladSyncLog`
- [ ] Добавить поле `moySkladCounterpartyId` в `User`

### Этап 2: API Client (2 дня)
- [ ] Реализовать `MoySkladClient`
- [ ] Добавить обработку ошибок
- [ ] Написать тесты

### Этап 3: Sync Service (2 дня)
- [ ] Реализовать `MoySkladSyncService`
- [ ] Интегрировать с существующим `BonusService`
- [ ] Добавить логирование

### Этап 4: Webhook (2 дня)
- [ ] Создать webhook endpoint
- [ ] Реализовать валидацию
- [ ] Обработка событий

### Этап 5: UI (2 дня)
- [ ] Страница настройки интеграции
- [ ] Форма подключения
- [ ] История синхронизации
- [ ] Тест подключения

### Этап 6: Telegram Bot (1 день)
- [ ] Обновить команду `/balance`
- [ ] Показывать баланс из МойСклад
- [ ] Уведомления об офлайн покупках

## 🔗 Полезные ссылки

- [МойСклад JSON API](https://dev.moysklad.ru/doc/api/remap/1.2/)
- [Бонусные операции](https://dev.moysklad.ru/doc/api/remap/1.2/#suschnosti-bonusnaq-operaciq)
- [Webhook](https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/#suschnosti-vebhuki)
- [Аутентификация](https://dev.moysklad.ru/doc/api/remap/1.2/#mojsklad-json-api-obschie-swedeniq-autentifikaciq)
