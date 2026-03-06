# Requirements Document: МойСклад Direct API Integration

## Introduction

Данная спецификация описывает реализацию прямой интеграции с МойСклад через Bonus Transaction API для синхронизации бонусов между онлайн и офлайн покупками. В отличие от предыдущей реализации через LoyaltyAPI (где мы выступали как API provider), новый подход использует стандартный МойСклад JSON API для работы с бонусными операциями.

**Бизнес-контекст:**
Клиенты системы имеют как онлайн (интернет-магазин), так и офлайн (касса МойСклад) точки продаж. Необходимо обеспечить единый баланс бонусов с автоматической двусторонней синхронизацией между системами.

**Архитектура интеграции:**
- Мы используем МойСклад JSON API 1.2 (Bonus Transaction API)
- Двусторонняя синхронизация через API запросы и webhooks
- Идентификация клиентов по номеру телефона
- Автоматическая сверка балансов

**Scope:**
- Реализация МойСклад API клиента для работы с бонусными операциями
- Сервис синхронизации бонусов (онлайн ↔ офлайн)
- Webhook обработчик для событий от МойСклад
- UI для настройки интеграции
- Интеграция с Telegram ботом для проверки баланса
- Логирование всех операций синхронизации

**Отличия от LoyaltyAPI подхода:**
- Бесплатно (не требует размещения в marketplace)
- Проще (4 метода API вместо 9 endpoints)
- Мы - API consumer, а не provider
- Полный контроль над логикой синхронизации

## Glossary

- **MoySklad_API**: МойСклад JSON API 1.2
- **Bonus_Transaction**: Бонусная операция в МойСклад (начисление/списание)
- **Counterparty**: Контрагент (клиент) в МойСклад
- **Sync_Service**: Сервис синхронизации бонусов между системами
- **Direct_Integration**: Прямая интеграция через Bonus Transaction API
- **Account_ID**: ID организации в МойСклад
- **API_Token**: Bearer токен для доступа к МойСклад API
- **Bonus_Program_ID**: ID программы лояльности в МойСклад
- **Sync_Direction**: Направление синхронизации (BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
- **Sync_Log**: Журнал операций синхронизации
- **Balance_Check**: Проверка и сверка балансов между системами
- **Webhook_Secret**: Секретный ключ для валидации webhook от МойСклад
- **Phone_Number**: Номер телефона в E.164 формате (основной идентификатор)

## Requirements

### Requirement 1: Database Schema

**User Story:** Как система, я хочу хранить настройки интеграции и логи синхронизации в БД, чтобы обеспечить надежность и возможность аудита.

#### Acceptance Criteria

1. THE System SHALL create `MoySkladDirectIntegration` table with fields:
   - id (String, primary key)
   - projectId (String, unique, foreign key to Project)
   - accountId (String) - ID организации в МойСклад
   - apiToken (String) - Bearer token (encrypted)
   - bonusProgramId (String) - ID программы лояльности
   - syncDirection (Enum: BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
   - autoSync (Boolean, default: true)
   - webhookSecret (String, nullable, unique)
   - isActive (Boolean, default: false)
   - lastSyncAt (DateTime, nullable)
   - lastError (String, nullable)
   - createdAt, updatedAt (DateTime)

2. THE System SHALL create `MoySkladDirectSyncLog` table with fields:
   - id (String, primary key)
   - integrationId (String, foreign key)
   - operation (String: "bonus_accrual", "bonus_spending", "balance_sync")
   - direction (String: "incoming", "outgoing")
   - moySkladTransactionId (String, nullable)
   - userId (String, nullable, foreign key to User)
   - amount (Decimal, nullable)
   - requestData (Json, nullable)
   - responseData (Json, nullable)
   - status (String: "success", "error", "pending")
   - errorMessage (String, nullable)
   - createdAt (DateTime)

3. THE System SHALL add `moySkladDirectCounterpartyId` field to User table (String, nullable, unique)

4. THE System SHALL create indexes:
   - MoySkladDirectIntegration: projectId, webhookSecret
   - MoySkladDirectSyncLog: integrationId + createdAt, userId, status, moySkladTransactionId
   - User: moySkladDirectCounterpartyId

5. THE System SHALL encrypt apiToken before storing in database using AES-256-CBC

### Requirement 2: МойСклад API Client

**User Story:** Как Sync_Service, я хочу иметь клиент для работы с МойСклад API, чтобы выполнять операции с бонусами.

#### Acceptance Criteria

1. THE MoySkladClient SHALL implement `accrueBonus()` method:
   - Accept: counterpartyId, amount, comment
   - Create bonus transaction with type EARNING
   - Return: MoySkladBonusTransaction
   - Log all operations

2. THE MoySkladClient SHALL implement `spendBonus()` method:
   - Accept: counterpartyId, amount, comment
   - Create bonus transaction with type SPENDING
   - Return: MoySkladBonusTransaction
   - Log all operations

3. THE MoySkladClient SHALL implement `getBalance()` method:
   - Accept: counterpartyId
   - Return: number (bonus balance)
   - Cache result for 5 minutes

4. THE MoySkladClient SHALL implement `findCounterpartyByPhone()` method:
   - Accept: phone (normalized to E.164)
   - Search counterparty by phone
   - Return: MoySkladCounterparty | null

5. THE MoySkladClient SHALL implement `getCounterparty()` method:
   - Accept: counterpartyId
   - Return: MoySkladCounterparty

6. THE MoySkladClient SHALL implement `getBonusTransaction()` method:
   - Accept: transactionId
   - Return: MoySkladBonusTransaction

7. THE MoySkladClient SHALL implement `testConnection()` method:
   - Test API connectivity
   - Return: boolean

8. THE MoySkladClient SHALL automatically decrypt apiToken before use

9. THE MoySkladClient SHALL throw `MoySkladApiException` on API errors with status code and response

10. THE MoySkladClient SHALL use base URL: `https://api.moysklad.ru/api/remap/1.2`

### Requirement 3: Sync Service - Online to МойСклад

**User Story:** Как система, я хочу синхронизировать начисление бонусов из онлайн покупок в МойСклад, чтобы клиент видел единый баланс.

#### Acceptance Criteria

1. THE SyncService SHALL implement `syncBonusAccrualToMoySklad()` method:
   - Accept: userId, amount, source
   - Find user's moySkladDirectCounterpartyId
   - IF counterpartyId not found AND user has phone, THEN find counterparty by phone
   - IF counterparty found, THEN link user with counterpartyId
   - Call MoySkladClient.accrueBonus()
   - Create sync log entry with status "success"
   - Update integration.lastSyncAt
   - Return: void

2. THE SyncService SHALL check syncDirection before syncing:
   - IF syncDirection is MOYSKLAD_TO_US, THEN skip outgoing sync
   - IF syncDirection is US_TO_MOYSKLAD or BIDIRECTIONAL, THEN proceed

3. THE SyncService SHALL handle errors gracefully:
   - Create sync log entry with status "error"
   - Store error message in integration.lastError
   - Log error details
   - DO NOT throw error (sync is not critical)

4. THE SyncService SHALL implement `syncBonusSpendingToMoySklad()` method:
   - Similar to accrual but uses spendBonus()

5. THE SyncService SHALL be called automatically after:
   - Tilda webhook processes purchase
   - InSales webhook processes purchase
   - Manual bonus accrual through admin panel

### Requirement 4: Sync Service - МойСклад to Online

**User Story:** Как система, я хочу синхронизировать бонусы из офлайн покупок в МойСклад в нашу систему, чтобы клиент видел все операции.

#### Acceptance Criteria

1. THE SyncService SHALL implement `syncFromMoySklad()` method:
   - Accept: integrationId, bonusTransaction
   - Extract counterpartyId from bonusTransaction
   - Find user by moySkladDirectCounterpartyId
   - IF user not found, THEN find by phone from МойСклад
   - IF user still not found, THEN throw error

2. WHEN bonusTransaction.transactionType is EARNING:
   - Create Bonus record in database
   - Set type to PURCHASE
   - Set source to "moysklad_offline"
   - Set expiresAt based on project.bonusExpiryDays
   - Create Transaction record with type EARN
   - Store moySkladTransactionId in metadata

3. WHEN bonusTransaction.transactionType is SPENDING:
   - Call BonusService.spendBonuses()
   - Create Transaction record with type SPEND
   - Store moySkladTransactionId in metadata

4. THE SyncService SHALL check syncDirection:
   - IF syncDirection is US_TO_MOYSKLAD, THEN skip incoming sync
   - IF syncDirection is MOYSKLAD_TO_US or BIDIRECTIONAL, THEN proceed

5. THE SyncService SHALL create sync log entry:
   - operation: "bonus_accrual" or "bonus_spending"
   - direction: "incoming"
   - status: "success" or "error"
   - Store full bonusTransaction in requestData

6. THE SyncService SHALL send Telegram notification:
   - IF user has telegramChatId
   - Message: "Вам начислено {amount} бонусов за покупку в магазине"
   - Include transaction details

### Requirement 5: Balance Check and Sync

**User Story:** Как пользователь, я хочу проверять баланс бонусов через Telegram бота, чтобы видеть актуальную информацию из обеих систем.

#### Acceptance Criteria

1. THE SyncService SHALL implement `checkAndSyncBalance()` method:
   - Accept: userId
   - Get user with integration settings
   - IF integration not active OR user has no counterpartyId, THEN return only our balance

2. THE SyncService SHALL fetch balances in parallel:
   - ourBalance = BonusService.getAvailableBalance(userId)
   - moySkladBalance = MoySkladClient.getBalance(counterpartyId)

3. THE SyncService SHALL compare balances:
   - Calculate diff = abs(ourBalance - moySkladBalance)
   - IF diff < 0.01, THEN synced = true
   - ELSE synced = false

4. THE SyncService SHALL return BalanceCheckResult:
   - ourBalance: number
   - moySkladBalance: number | null
   - synced: boolean
   - error?: string

5. WHEN balances don't match:
   - Log warning with details
   - Create sync log entry with operation "balance_sync"
   - TODO: Implement automatic reconciliation (future)

6. THE SyncService SHALL handle МойСклад API errors:
   - Return ourBalance with moySkladBalance = null
   - Set synced = false
   - Include error message

### Requirement 6: Webhook Handler

**User Story:** Как система, я хочу получать события от МойСклад через webhook, чтобы синхронизировать офлайн операции в реальном времени.

#### Acceptance Criteria

1. THE System SHALL provide webhook endpoint:
   - POST `/api/webhook/moysklad-direct/[projectId]`
   - Accept МойСклад webhook payload
   - Return 200 OK on success

2. THE WebhookHandler SHALL validate webhook secret:
   - Extract signature from headers
   - Validate using HMAC-SHA256
   - IF invalid, THEN return 401 Unauthorized

3. THE WebhookHandler SHALL find integration:
   - Find by projectId
   - Check isActive = true
   - IF not found or inactive, THEN return 404

4. THE WebhookHandler SHALL parse webhook payload:
   - Extract events array
   - Filter events by type "bonustransaction"
   - Process each event

5. FOR each bonustransaction event:
   - Extract transaction ID from meta.href
   - Call MoySkladClient.getBonusTransaction(transactionId)
   - Call SyncService.syncFromMoySklad()

6. THE WebhookHandler SHALL log all webhook requests:
   - Create sync log entry
   - Store full payload
   - Store processing result

7. THE WebhookHandler SHALL handle errors:
   - Log error details
   - Return 500 Internal Server Error
   - DO NOT retry (МойСклад will retry)

### Requirement 7: API Routes for Integration Management

**User Story:** Как Project_Owner, я хочу управлять настройками интеграции через API, чтобы настроить подключение к МойСклад.

#### Acceptance Criteria

1. THE System SHALL provide GET endpoint:
   - `/api/projects/[id]/integrations/moysklad-direct`
   - Return integration settings (without decrypted apiToken)
   - Filter by project owner

2. THE System SHALL provide POST endpoint:
   - `/api/projects/[id]/integrations/moysklad-direct`
   - Accept: accountId, apiToken, bonusProgramId, syncDirection
   - Encrypt apiToken before storing
   - Generate webhookSecret
   - Set isActive = false (requires manual activation)
   - Return: integration with webhookSecret

3. THE System SHALL provide PUT endpoint:
   - `/api/projects/[id]/integrations/moysklad-direct`
   - Accept: partial update data
   - IF apiToken provided, THEN encrypt before storing
   - Return: updated integration

4. THE System SHALL provide DELETE endpoint:
   - `/api/projects/[id]/integrations/moysklad-direct`
   - Soft delete (set isActive = false)
   - Keep sync logs for audit

5. THE System SHALL provide POST endpoint for test connection:
   - `/api/projects/[id]/integrations/moysklad-direct/test`
   - Call MoySkladClient.testConnection()
   - Return: { success: boolean, error?: string }

6. THE System SHALL provide POST endpoint for manual sync:
   - `/api/projects/[id]/integrations/moysklad-direct/sync`
   - Accept: userId (optional)
   - IF userId provided, THEN sync specific user
   - ELSE sync all users with counterpartyId
   - Return: { synced: number, errors: number }

7. THE System SHALL provide GET endpoint for sync logs:
   - `/api/projects/[id]/integrations/moysklad-direct/logs`
   - Accept query params: operation, direction, status, dateFrom, dateTo, limit, offset
   - Return: paginated sync logs

### Requirement 8: UI Components

**User Story:** Как Project_Owner, я хочу настраивать интеграцию через UI, чтобы легко подключить МойСклад к бонусной системе.

#### Acceptance Criteria

1. THE System SHALL provide settings page:
   - `/dashboard/projects/[id]/integrations/moysklad-direct`
   - Show integration status (active/inactive)
   - Show last sync time
   - Show statistics

2. THE IntegrationForm SHALL include fields:
   - accountId (text input, required)
   - apiToken (password input, required)
   - bonusProgramId (text input, required)
   - syncDirection (select: BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
   - autoSync (checkbox, default: true)
   - isActive (toggle switch)

3. THE IntegrationForm SHALL validate inputs:
   - All required fields must be filled
   - accountId must be valid UUID format
   - apiToken must not be empty
   - bonusProgramId must be valid UUID format

4. THE IntegrationForm SHALL have "Test Connection" button:
   - Call test endpoint
   - Show success/error message
   - Disable form while testing

5. THE CredentialsDisplay SHALL show:
   - Webhook URL: `https://gupil.ru/api/webhook/moysklad-direct/[projectId]`
   - Webhook Secret (with copy button)
   - Instructions for configuring webhook in МойСклад

6. THE SyncLogs component SHALL display:
   - Table with recent sync operations
   - Columns: timestamp, operation, direction, amount, status
   - Expandable rows with full details
   - Filters: operation, direction, status, date range
   - Pagination

7. THE SyncStats component SHALL display:
   - Total syncs (success/error)
   - Success rate percentage
   - Last sync time
   - Total bonus accrued/spent
   - Chart: syncs over time

8. THE ManualSync component SHALL have button:
   - "Sync Now" button
   - Show progress indicator
   - Show result: "Synced X users, Y errors"

### Requirement 9: Telegram Bot Integration

**User Story:** Как пользователь, я хочу видеть баланс из МойСклад в Telegram боте, чтобы проверять актуальную информацию.

#### Acceptance Criteria

1. THE TelegramBot SHALL update `/balance` command:
   - Call SyncService.checkAndSyncBalance(userId)
   - Show ourBalance and moySkladBalance
   - IF synced = true, THEN show "✅ Балансы синхронизированы"
   - IF synced = false, THEN show "⚠️ Обнаружено расхождение"

2. THE TelegramBot SHALL format balance message:
   ```
   💰 Ваш баланс бонусов:
   
   Онлайн: {ourBalance} бонусов
   Офлайн (МойСклад): {moySkladBalance} бонусов
   
   {syncStatus}
   ```

3. THE TelegramBot SHALL send notifications for offline purchases:
   - When SyncService.syncFromMoySklad() completes
   - Message