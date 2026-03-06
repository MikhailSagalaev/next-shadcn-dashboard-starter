# Design Document: МойСклад Direct API Integration

## Overview

This design document describes the implementation of a direct integration with МойСклад using their Bonus Transaction API (JSON API 1.2) for bidirectional bonus synchronization between online and offline sales channels.

### Business Context

Clients operate both online (e-commerce) and offline (МойСклад POS) sales channels. This integration provides unified bonus balance management with automatic bidirectional synchronization:

- **Online → МойСклад**: When customers make online purchases, bonuses are automatically synced to МойСклад
- **МойСклад → Online**: When customers make offline purchases, bonuses are automatically synced to our system
- **Balance Verification**: Real-time balance checks ensure consistency across both systems

### Architecture Approach

Unlike the previous LoyaltyAPI implementation (where we acted as an API provider), this direct integration:

- Uses МойСклад JSON API 1.2 as an API consumer
- Implements 4 core API methods (vs 9 endpoints in LoyaltyAPI)
- Provides full control over synchronization logic
- Is free (no marketplace listing required)
- Simplifies deployment and maintenance

### Key Components

1. **MoySkladClient**: API client for МойСклад Bonus Transaction API
2. **SyncService**: Bidirectional synchronization orchestrator
3. **WebhookHandler**: Real-time event processor for offline purchases
4. **Database Layer**: Integration settings and sync audit logs
5. **UI Components**: Admin dashboard for configuration
6. **Telegram Integration**: Balance checks with МойСклад data

### Integration Flow

```
Online Purchase Flow:
User makes purchase → Tilda/InSales webhook → BonusService.awardBonus() 
→ SyncService.syncBonusAccrualToMoySklad() → MoySkladClient.accrueBonus()

Offline Purchase Flow:
User makes purchase in POS → МойСклад creates bonus transaction 
→ МойСклад webhook → WebhookHandler → SyncService.syncFromMoySklad() 
→ BonusService.awardBonus()

Balance Check Flow:
User requests balance in Telegram → SyncService.checkAndSyncBalance() 
→ Parallel fetch from both systems → Compare and return
```

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SaaS Bonus System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Tilda/     │      │   Telegram   │      │    Admin     │  │
│  │   InSales    │──────│     Bot      │──────│  Dashboard   │  │
│  │   Webhooks   │      │              │      │              │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                     │           │
│         │                     │                     │           │
│  ┌──────▼──────────────────────▼─────────────────────▼───────┐ │
│  │              Application Layer                             │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │ │
│  │  │ BonusService│  │  SyncService │  │ IntegrationAPI   │ │ │
│  │  └─────────────┘  └──────┬───────┘  └──────────────────┘ │ │
│  │                           │                                │ │
│  │                    ┌──────▼───────┐                        │ │
│  │                    │MoySkladClient│                        │ │
│  │                    └──────┬───────┘                        │ │
│  └───────────────────────────┼────────────────────────────────┘ │
│                               │                                  │
│  ┌────────────────────────────▼───────────────────────────────┐ │
│  │                    Database Layer                           │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ MoySkladDirectIntegration │ MoySkladDirectSyncLog    │  │ │
│  │  │ User (with counterpartyId) │ Bonus │ Transaction     │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                │ HTTPS API Calls
                                │
┌───────────────────────────────▼───────────────────────────────────┐
│                      МойСклад System                               │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐    │
│  │   POS        │      │   Bonus      │      │   Webhook    │    │
│  │   Terminal   │──────│  Transaction │──────│   Events     │────┼──┐
│  │              │      │     API      │      │              │    │  │
│  └──────────────┘      └──────────────┘      └──────────────┘    │  │
│                                                                     │  │
└─────────────────────────────────────────────────────────────────────┘  │
                                                                          │
                                                                          │
                    Webhook POST                                          │
                    (bonus transaction events)                            │
                                                                          │
┌─────────────────────────────────────────────────────────────────────────┘
│
│  POST /api/webhook/moysklad-direct/[projectId]
│
└──────────────────────────────────────────────────────────────────────┐
                                                                        │
                                                                        │
                                                              ┌─────────▼────────┐
                                                              │ WebhookHandler   │
                                                              │ - Validate HMAC  │
                                                              │ - Process events │
                                                              │ - Sync to system │
                                                              └──────────────────┘
```

### Component Responsibilities

#### MoySkladClient
- Encapsulates all МойСклад API communication
- Handles authentication (Bearer token)
- Implements retry logic for transient failures
- Provides methods: accrueBonus(), spendBonus(), getBalance(), findCounterpartyByPhone()
- Manages API token decryption
- Throws typed exceptions for error handling

#### SyncService
- Orchestrates bidirectional synchronization
- Implements sync direction logic (BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
- Links users with МойСклад counterparties by phone number
- Creates audit logs for all sync operations
- Handles balance verification and reconciliation
- Sends Telegram notifications for offline purchases

#### WebhookHandler
- Receives and validates МойСклад webhook events
- Verifies HMAC-SHA256 signature
- Filters and processes bonus transaction events
- Delegates to SyncService for actual synchronization
- Logs all webhook requests for debugging

#### Database Layer
- **MoySkladDirectIntegration**: Stores encrypted credentials and settings
- **MoySkladDirectSyncLog**: Audit trail of all sync operations
- **User.moySkladDirectCounterpartyId**: Links users to МойСклад counterparties

#### UI Components
- Integration settings form with validation
- Webhook credentials display with copy functionality
- Sync logs viewer with filtering and pagination
- Statistics dashboard with charts
- Manual sync trigger with progress feedback

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. API Token Encryption (AES-256-GCM)                       │
│     ┌──────────────────────────────────────────────────┐    │
│     │ Plain Token → PBKDF2 Key Derivation → Encrypt   │    │
│     │ Storage: salt:iv:authTag:encryptedData          │    │
│     └──────────────────────────────────────────────────┘    │
│                                                               │
│  2. Webhook Signature Validation (HMAC-SHA256)               │
│     ┌──────────────────────────────────────────────────┐    │
│     │ МойСклад → Sign payload with secret → Send      │    │
│     │ Our System → Verify signature → Process         │    │
│     └──────────────────────────────────────────────────┘    │
│                                                               │
│  3. Project Isolation (Multi-tenancy)                        │
│     ┌──────────────────────────────────────────────────┐    │
│     │ All queries filtered by projectId/ownerId        │    │
│     │ Webhook URLs include projectId                   │    │
│     └──────────────────────────────────────────────────┘    │
│                                                               │
│  4. HTTPS Only                                               │
│     ┌──────────────────────────────────────────────────┐    │
│     │ All API communication over TLS 1.2+              │    │
│     └──────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### MoySkladClient

**Purpose**: Type-safe client for МойСклад Bonus Transaction API

**Location**: `src/lib/moysklad-direct/client.ts`

**Interface**:
```typescript
interface MoySkladClientConfig {
  accountId: string;
  apiToken: string;
  bonusProgramId: string;
  baseUrl?: string; // Default: https://api.moysklad.ru/api/remap/1.2
  timeout?: number; // Default: 30000ms
}

class MoySkladClient {
  constructor(config: MoySkladClientConfig);
  
  // Bonus operations
  async accrueBonus(params: AccrueBonusParams): Promise<MoySkladBonusTransaction>;
  async spendBonus(params: SpendBonusParams): Promise<MoySkladBonusTransaction>;
  async getBalance(counterpartyId: string): Promise<number>;
  
  // Counterparty operations
  async findCounterpartyByPhone(phone: string): Promise<MoySkladCounterparty | null>;
  async getCounterparty(counterpartyId: string): Promise<MoySkladCounterparty>;
  
  // Transaction operations
  async getBonusTransaction(transactionId: string): Promise<MoySkladBonusTransaction>;
  
  // Utility
  async testConnection(): Promise<boolean>;
}

interface AccrueBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
  timestamp?: Date;
}

interface SpendBonusParams {
  counterpartyId: string;
  amount: number;
  comment: string;
  timestamp?: Date;
}

interface MoySkladBonusTransaction {
  id: string;
  meta: MoySkladMeta;
  agent: { meta: MoySkladMeta };
  bonusValue: number;
  transactionType: 'EARNING' | 'SPENDING';
  transactionStatus: 'COMPLETED' | 'WAIT_PROCESSING';
  moment: Date;
  comment?: string;
  bonusProgram?: { meta: MoySkladMeta };
}

interface MoySkladCounterparty {
  id: string;
  meta: MoySkladMeta;
  name: string;
  phone?: string;
  email?: string;
  bonusPoints?: number;
}

class MoySkladApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public response?: any
  );
}
```

**Implementation Details**:
- Uses `fetch` API for HTTP requests
- Automatically decrypts API token using `decryptApiToken()`
- Implements exponential backoff for retries (3 attempts)
- Caches balance queries for 5 minutes using in-memory cache
- Normalizes phone numbers to E.164 format before search
- Logs all API calls using `logger` service
- Throws `MoySkladApiError` with status code and response body

**Error Handling**:
- 401 Unauthorized → Invalid API token
- 403 Forbidden → Insufficient permissions
- 404 Not Found → Counterparty or transaction not found
- 429 Too Many Requests → Rate limit exceeded (retry with backoff)
- 500 Internal Server Error → МойСклад system error (retry)

### SyncService

**Purpose**: Orchestrates bidirectional bonus synchronization

**Location**: `src/lib/moysklad-direct/sync-service.ts`

**Interface**:
```typescript
class SyncService {
  // Online → МойСклад sync
  async syncBonusAccrualToMoySklad(params: SyncAccrualParams): Promise<void>;
  async syncBonusSpendingToMoySklad(params: SyncSpendingParams): Promise<void>;
  
  // МойСклад → Online sync
  async syncFromMoySklad(params: SyncFromMoySkladParams): Promise<void>;
  
  // Balance verification
  async checkAndSyncBalance(userId: string): Promise<BalanceCheckResult>;
  
  // User linking
  async linkUserToCounterparty(userId: string, counterpartyId: string): Promise<void>;
  async findAndLinkCounterparty(userId: string): Promise<boolean>;
}

interface SyncAccrualParams {
  userId: string;
  amount: number;
  source: string; // "tilda_purchase", "insales_purchase", "manual"
  description?: string;
}

interface SyncSpendingParams {
  userId: string;
  amount: number;
  source: string;
  description?: string;
}

interface SyncFromMoySkladParams {
  integrationId: string;
  bonusTransaction: MoySkladBonusTransaction;
}

interface BalanceCheckResult {
  ourBalance: number;
  moySkladBalance: number | null;
  synced: boolean;
  difference?: number;
  error?: string;
}
```

**Implementation Details**:

**syncBonusAccrualToMoySklad()**:
1. Load integration settings for user's project
2. Check if integration is active and syncDirection allows outgoing sync
3. Get user's moySkladDirectCounterpartyId
4. If not found, call findAndLinkCounterparty()
5. If still not found, log warning and return (user not in МойСклад)
6. Call MoySkladClient.accrueBonus()
7. Create sync log with status "success"
8. Update integration.lastSyncAt
9. On error: log error, create sync log with status "error", do not throw

**syncFromMoySklad()**:
1. Check syncDirection allows incoming sync
2. Extract counterpartyId from bonusTransaction
3. Find user by moySkladDirectCounterpartyId
4. If not found, fetch counterparty from МойСклад and find by phone
5. If user still not found, throw error (cannot sync without user)
6. If transactionType is EARNING:
   - Create Bonus record (type: PURCHASE, source: "moysklad_offline")
   - Set expiresAt based on project.bonusExpiryDays
   - Create Transaction record (type: EARN)
   - Store moySkladTransactionId in metadata
7. If transactionType is SPENDING:
   - Call BonusService.spendBonuses()
   - Create Transaction record (type: SPEND)
   - Store moySkladTransactionId in metadata
8. Create sync log with full transaction data
9. Send Telegram notification if user has telegramChatId
10. On error: create sync log with error, throw exception

**checkAndSyncBalance()**:
1. Load user with integration settings
2. If integration not active or user has no counterpartyId, return only ourBalance
3. Fetch balances in parallel:
   - ourBalance = BonusService.getAvailableBalance(userId)
   - moySkladBalance = MoySkladClient.getBalance(counterpartyId)
4. Calculate difference = abs(ourBalance - moySkladBalance)
5. If difference < 0.01, synced = true
6. Create sync log with operation "balance_sync"
7. Return BalanceCheckResult
8. On МойСклад API error: return ourBalance with moySkladBalance = null

**findAndLinkCounterparty()**:
1. Get user's phone number
2. If no phone, return false
3. Normalize phone to E.164 format
4. Call MoySkladClient.findCounterpartyByPhone()
5. If found, call linkUserToCounterparty()
6. Return true if linked, false otherwise

### WebhookHandler

**Purpose**: Process МойСклад webhook events in real-time

**Location**: `src/app/api/webhook/moysklad-direct/[projectId]/route.ts`

**Interface**:
```typescript
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
): Promise<Response>;
```

**Implementation Details**:
1. Extract projectId from URL params
2. Find MoySkladDirectIntegration by projectId
3. If not found or not active, return 404
4. Extract signature from request headers (X-MoySklad-Signature)
5. Read request body as text
6. Validate HMAC-SHA256 signature using webhookSecret
7. If invalid signature, return 401 Unauthorized
8. Parse JSON payload
9. Extract events array
10. Filter events by type "bonustransaction"
11. For each event:
    - Extract transaction ID from meta.href
    - Call MoySkladClient.getBonusTransaction(transactionId)
    - Call SyncService.syncFromMoySklad()
12. Create sync log for webhook request
13. Return 200 OK
14. On error: log error, create sync log with error, return 500

**Webhook Payload Format**:
```json
{
  "action": "CREATE",
  "events": [
    {
      "meta": {
        "href": "https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction/[id]",
        "type": "bonustransaction"
      },
      "action": "CREATE",
      "accountId": "[account-id]"
    }
  ]
}
```

**Signature Validation**:
```typescript
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Encryption Service

**Purpose**: Secure storage of API tokens

**Location**: `src/lib/moysklad-direct/encryption.ts`

**Interface**:
```typescript
function encryptApiToken(apiToken: string): string;
function decryptApiToken(encryptedToken: string): string;
function testEncryption(): boolean;
```

**Implementation Details**:
- Algorithm: AES-256-GCM
- Key derivation: PBKDF2 with 100,000 iterations
- Random salt (64 bytes) and IV (16 bytes) per encryption
- Authentication tag for integrity verification
- Master key from environment variable: MOYSKLAD_ENCRYPTION_KEY
- Format: `salt:iv:authTag:encryptedData` (all base64 encoded)

**Security Considerations**:
- Master key must be identical across all servers
- Master key must never change after initial deployment
- Use strong random key (32+ characters)
- Store master key in secure environment variables
- Never log or expose encrypted tokens

## Data Models

### Database Schema

#### MoySkladDirectIntegration

```prisma
model MoySkladDirectIntegration {
  id                String              @id @default(cuid())
  projectId         String              @unique @map("project_id")
  project           Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Credentials (encrypted)
  accountId         String              @map("account_id")
  apiToken          String              @map("api_token") // Encrypted with AES-256-GCM
  bonusProgramId    String              @map("bonus_program_id")
  
  // Sync settings
  syncDirection     SyncDirection       @default(BIDIRECTIONAL) @map("sync_direction")
  autoSync          Boolean             @default(true) @map("auto_sync")
  
  // Webhook
  webhookSecret     String?             @unique @map("webhook_secret")
  
  // Status
  isActive          Boolean             @default(false) @map("is_active")
  lastSyncAt        DateTime?           @map("last_sync_at")
  lastError         String?             @map("last_error") @db.Text
  
  // Timestamps
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")
  
  // Relations
  syncLogs          MoySkladDirectSyncLog[]
  
  @@index([projectId])
  @@index([webhookSecret])
  @@map("moysklad_direct_integrations")
}

enum SyncDirection {
  BIDIRECTIONAL     // Both directions
  MOYSKLAD_TO_US    // Only МойСклад → Our system
  US_TO_MOYSKLAD    // Only Our system → МойСклад
}
```

**Field Descriptions**:
- `accountId`: МойСклад organization ID (UUID format)
- `apiToken`: Bearer token for API access (encrypted at rest)
- `bonusProgramId`: ID of the loyalty program in МойСклад (UUID format)
- `syncDirection`: Controls which sync operations are allowed
- `autoSync`: If false, sync only happens manually
- `webhookSecret`: Secret for validating webhook signatures (auto-generated)
- `isActive`: Master switch for the integration
- `lastSyncAt`: Timestamp of last successful sync operation
- `lastError`: Last error message for debugging

#### MoySkladDirectSyncLog

```prisma
model MoySkladDirectSyncLog {
  id            String                      @id @default(cuid())
  integrationId String                      @map("integration_id")
  integration   MoySkladDirectIntegration   @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  
  // Operation details
  operation     String                      @map("operation") // "bonus_accrual", "bonus_spending", "balance_sync"
  direction     String                      @map("direction") // "incoming", "outgoing"
  
  // References
  moySkladTransactionId String?           @map("moysklad_transaction_id")
  userId        String?                     @map("user_id")
  user          User?                       @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // Data
  amount        Decimal?                    @db.Decimal(10, 2)
  requestData   Json?                       @map("request_data")
  responseData  Json?                       @map("response_data")
  
  // Result
  status        String                      @map("status") // "success", "error", "pending"
  errorMessage  String?                     @map("error_message") @db.Text
  
  // Timestamp
  createdAt     DateTime                    @default(now()) @map("created_at")
  
  @@index([integrationId, createdAt])
  @@index([userId])
  @@index([status])
  @@index([moySkladTransactionId])
  @@map("moysklad_direct_sync_logs")
}
```

**Field Descriptions**:
- `operation`: Type of sync operation performed
- `direction`: "incoming" (МойСклад → us) or "outgoing" (us → МойСклад)
- `moySkladTransactionId`: ID of the bonus transaction in МойСклад
- `userId`: User in our system (may be null if counterparty not found)
- `amount`: Bonus amount involved in the operation
- `requestData`: Full request payload (for debugging)
- `responseData`: Full response from МойСклад API
- `status`: Operation result
- `errorMessage`: Error details if status is "error"

#### User Extension

```prisma
model User {
  // ... existing fields ...
  
  // МойСклад Direct API integration
  moySkladDirectCounterpartyId String?       @unique @map("moysklad_direct_counterparty_id")
  moySkladDirectSyncLogs       MoySkladDirectSyncLog[]
  
  // ... rest of model ...
}
```

**Field Description**:
- `moySkladDirectCounterpartyId`: Links user to МойСклад counterparty (UUID format)

### Data Flow Diagrams

#### Online Purchase → МойСклад Sync

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Tilda/  │────▶│ BonusService │────▶│ SyncService  │────▶│ MoySklad     │
│ InSales  │     │ .awardBonus()│     │ .syncAccrual │     │ Client       │
│ Webhook  │     └──────────────┘     │ ToMoySklad() │     │ .accrueBonus │
└──────────┘                          └──────┬───────┘     └──────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ Create         │
                                     │ SyncLog        │
                                     │ (outgoing)     │
                                     └────────────────┘
```

#### Offline Purchase → Our System Sync

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ МойСклад │────▶│ Webhook      │────▶│ SyncService  │────▶│ BonusService │
│ POS      │     │ Handler      │     │ .syncFrom    │     │ .awardBonus()│
│          │     │              │     │ MoySklad()   │     │              │
└──────────┘     └──────────────┘     └──────┬───────┘     └──────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ Create         │
                                     │ SyncLog        │
                                     │ (incoming)     │
                                     └────────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ Send Telegram  │
                                     │ Notification   │
                                     └────────────────┘
```

#### Balance Check Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│ Telegram │────▶│ SyncService  │────▶│ Parallel Fetch:              │
│ Bot      │     │ .checkAnd    │     │ - BonusService.getBalance()  │
│ /balance │     │ SyncBalance()│     │ - MoySkladClient.getBalance()│
└──────────┘     └──────┬───────┘     └──────────────┬───────────────┘
                        │                             │
                        │◀────────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │ Compare       │
                │ Balances      │
                │ Return Result │
                └───────────────┘
```


## Error Handling

### Error Categories

#### 1. МойСклад API Errors

**Authentication Errors (401)**:
- Cause: Invalid or expired API token
- Handling: Log error, update integration.lastError, set isActive = false
- User Action: Re-enter API token in admin dashboard
- No retry

**Authorization Errors (403)**:
- Cause: Insufficient permissions for bonus program
- Handling: Log error, update integration.lastError
- User Action: Check API token permissions in МойСклад
- No retry

**Not Found Errors (404)**:
- Cause: Counterparty or transaction doesn't exist
- Handling: Log warning, skip sync operation
- User Action: Verify counterparty exists in МойСклад
- No retry

**Rate Limit Errors (429)**:
- Cause: Too many API requests
- Handling: Exponential backoff retry (3 attempts)
- Delays: 1s, 2s, 4s
- If all retries fail: log error, update integration.lastError

**Server Errors (500, 502, 503)**:
- Cause: МойСклад system issues
- Handling: Exponential backoff retry (3 attempts)
- Delays: 2s, 4s, 8s
- If all retries fail: log error, create sync log with error status

#### 2. User Linking Errors

**User Not Found**:
- Cause: Counterparty phone doesn't match any user
- Handling: Log warning, create sync log with error
- User Action: Ensure phone numbers match between systems
- Recovery: Manual user creation or phone update

**Multiple Users Found**:
- Cause: Duplicate phone numbers in database
- Handling: Log error, use first match, flag for review
- User Action: Resolve duplicate users
- Prevention: Enforce unique phone constraint

**Phone Number Mismatch**:
- Cause: Different phone formats (E.164 vs local)
- Handling: Normalize to E.164 before comparison
- Fallback: Try multiple formats
- Log warning if normalization fails

#### 3. Sync Direction Errors

**Direction Mismatch**:
- Cause: Sync attempted in disabled direction
- Handling: Skip sync silently, log debug message
- No error status (expected behavior)

**Auto-Sync Disabled**:
- Cause: autoSync = false
- Handling: Skip automatic sync, allow manual sync
- No error status (expected behavior)

#### 4. Data Validation Errors

**Invalid Amount**:
- Cause: Negative or zero bonus amount
- Handling: Throw validation error, don't sync
- User Action: Fix data source

**Missing Required Fields**:
- Cause: Incomplete webhook payload or API response
- Handling: Log error, create sync log with error
- Return 400 Bad Request for webhooks

**Encryption Errors**:
- Cause: Invalid encrypted token format or wrong key
- Handling: Throw error, prevent integration activation
- User Action: Re-enter API token

### Error Recovery Strategies

#### Automatic Recovery

**Transient Network Errors**:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      if (!isRetryable(error)) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

function isRetryable(error: any): boolean {
  if (error instanceof MoySkladApiError) {
    return [429, 500, 502, 503].includes(error.statusCode);
  }
  return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
}
```

**Balance Reconciliation** (Future Enhancement):
```typescript
async function reconcileBalance(userId: string): Promise<void> {
  const result = await checkAndSyncBalance(userId);
  
  if (!result.synced && result.difference > 0.01) {
    // Log discrepancy for manual review
    logger.warn('Balance mismatch detected', {
      userId,
      ourBalance: result.ourBalance,
      moySkladBalance: result.moySkladBalance,
      difference: result.difference
    });
    
    // TODO: Implement automatic reconciliation logic
    // Options:
    // 1. Trust МойСклад as source of truth
    // 2. Trust our system as source of truth
    // 3. Manual review queue
  }
}
```

#### Manual Recovery

**Admin Dashboard Actions**:
- Test Connection: Verify API credentials
- Manual Sync: Trigger sync for specific user or all users
- View Sync Logs: Investigate failed operations
- Reset Integration: Clear lastError, reactivate integration

**Sync Log Investigation**:
- Filter by status = "error"
- View full requestData and responseData
- Identify patterns in failures
- Export logs for support

### Logging Strategy

#### Log Levels

**DEBUG**:
- Sync direction checks
- Cache hits/misses
- Phone number normalization

**INFO**:
- Successful sync operations
- Balance checks
- User linking

**WARN**:
- User not found (counterparty exists)
- Balance mismatches
- Skipped sync operations

**ERROR**:
- API errors
- Validation failures
- Webhook signature validation failures
- Encryption/decryption errors

#### Log Structure

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: {
    projectId?: string;
    userId?: string;
    integrationId?: string;
    operation?: string;
    direction?: string;
    moySkladTransactionId?: string;
    error?: {
      name: string;
      message: string;
      stack?: string;
      statusCode?: number;
    };
  };
  source: 'moysklad-direct-sync';
  timestamp: Date;
}
```

#### Log Retention

- Sync logs: 90 days (configurable)
- System logs: 30 days
- Error logs: 180 days
- Webhook logs: 30 days

### Monitoring and Alerts

#### Key Metrics

**Success Rate**:
- Target: > 99%
- Alert: < 95% over 1 hour
- Action: Check МойСклад API status, review error logs

**Sync Latency**:
- Target: < 5 seconds
- Alert: > 30 seconds average over 15 minutes
- Action: Check API response times, database performance

**Balance Mismatch Rate**:
- Target: < 1%
- Alert: > 5% over 1 day
- Action: Investigate sync logic, check for missed webhooks

**Webhook Delivery**:
- Target: 100% received
- Alert: No webhooks received for 1 hour (for active projects)
- Action: Check webhook configuration in МойСклад

#### Health Checks

```typescript
interface IntegrationHealth {
  isActive: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  successRate24h: number;
  avgSyncLatency: number;
  balanceMismatchCount: number;
  webhookCount24h: number;
}

async function checkIntegrationHealth(
  integrationId: string
): Promise<IntegrationHealth> {
  // Implementation
}
```

## Testing Strategy

### Unit Testing

**MoySkladClient Tests**:
- Mock fetch API responses
- Test successful API calls
- Test error handling (401, 403, 404, 429, 500)
- Test retry logic
- Test phone number normalization
- Test balance caching
- Test token decryption

**SyncService Tests**:
- Mock MoySkladClient and BonusService
- Test sync direction logic
- Test user linking by phone
- Test balance comparison
- Test error handling
- Test Telegram notifications
- Test sync log creation

**Encryption Tests**:
- Test encryption/decryption round trip
- Test with different key lengths
- Test invalid encrypted token handling
- Test missing encryption key

**WebhookHandler Tests**:
- Mock webhook payloads
- Test signature validation
- Test event filtering
- Test error responses
- Test integration not found
- Test inactive integration

### Integration Testing

**End-to-End Sync Tests**:
1. Create test project with integration
2. Create test user with phone
3. Trigger online purchase
4. Verify bonus synced to МойСклад
5. Verify sync log created
6. Check balance matches

**Webhook Integration Tests**:
1. Configure test webhook in МойСклад sandbox
2. Create offline purchase in МойСклад
3. Verify webhook received
4. Verify bonus synced to our system
5. Verify Telegram notification sent

**Balance Reconciliation Tests**:
1. Create discrepancy between systems
2. Call checkAndSyncBalance()
3. Verify mismatch detected
4. Verify sync log created

### Property-Based Testing

Property-based tests will be defined after completing the prework analysis in the Correctness Properties section.

### Manual Testing Checklist

**Initial Setup**:
- [ ] Create МойСклад test account
- [ ] Create bonus program in МойСклад
- [ ] Generate API token with bonus permissions
- [ ] Configure integration in admin dashboard
- [ ] Test connection succeeds
- [ ] Webhook URL configured in МойСклад

**Online → МойСклад Sync**:
- [ ] Create user with phone matching МойСклад counterparty
- [ ] Trigger Tilda webhook with purchase
- [ ] Verify bonus appears in МойСклад
- [ ] Check sync log shows success
- [ ] Verify balance matches

**МойСклад → Online Sync**:
- [ ] Create purchase in МойСклад POS
- [ ] Verify webhook received
- [ ] Verify bonus appears in our system
- [ ] Check sync log shows success
- [ ] Verify Telegram notification sent

**Balance Check**:
- [ ] Request balance via Telegram bot
- [ ] Verify both balances shown
- [ ] Verify sync status correct
- [ ] Test with user not in МойСклад

**Error Scenarios**:
- [ ] Invalid API token → 401 error handled
- [ ] User not found → warning logged
- [ ] Invalid webhook signature → 401 response
- [ ] МойСклад API down → retry logic works
- [ ] Sync direction disabled → sync skipped

**UI Testing**:
- [ ] Integration form validation works
- [ ] Test connection button works
- [ ] Webhook credentials displayed correctly
- [ ] Sync logs load and filter correctly
- [ ] Statistics display correctly
- [ ] Manual sync button works


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Token Encryption Round-Trip

*For any* valid API token string, encrypting and then decrypting it should produce the original token value.

**Validates: Requirements 1.5, 2.8**

**Rationale**: This is a critical security property ensuring that API tokens are stored securely but can be retrieved correctly when needed. The encryption must be reversible and lossless.

**Test Implementation**:
- Generate random API token strings (various lengths, characters)
- Encrypt using `encryptApiToken()`
- Decrypt using `decryptApiToken()`
- Assert: decrypted === original

### Property 2: Phone Number Normalization Idempotence

*For any* valid phone number in any format, normalizing it to E.164 format and normalizing again should produce the same result.

**Validates: Requirements 2.4**

**Rationale**: Phone numbers are the primary identifier for linking users to МойСклад counterparties. Normalization must be consistent and idempotent to ensure reliable matching.

**Test Implementation**:
- Generate random phone numbers in various formats (+7, 8, 7, with/without spaces/dashes)
- Normalize to E.164
- Normalize again
- Assert: normalize(normalize(phone)) === normalize(phone)

### Property 3: API Error Handling Consistency

*For any* МойСклад API error response (4xx, 5xx status codes), the MoySkladClient should throw a MoySkladApiError with the correct status code and error message.

**Validates: Requirements 2.9**

**Rationale**: Consistent error handling allows upstream code to make informed decisions about retries and user feedback.

**Test Implementation**:
- Generate random error responses (401, 403, 404, 429, 500, 502, 503)
- Mock API to return error
- Call any MoySkladClient method
- Assert: throws MoySkladApiError with correct statusCode

### Property 4: Sync Direction Filtering

*For any* sync operation and sync direction setting, operations should only execute when the direction allows them.

**Validates: Requirements 3.2, 4.4**

**Rationale**: Sync direction controls data flow between systems. Incorrect filtering could cause data inconsistencies or infinite sync loops.

**Test Implementation**:
- Generate random sync directions (BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
- Attempt outgoing sync (us → МойСклад)
- Attempt incoming sync (МойСклад → us)
- Assert: 
  - BIDIRECTIONAL allows both
  - MOYSKLAD_TO_US allows only incoming
  - US_TO_MOYSKLAD allows only outgoing

### Property 5: Sync Audit Trail Completeness

*For any* sync operation (accrual, spending, balance check), a sync log entry should be created with the operation details.

**Validates: Requirements 3.1, 3.4, 4.5, 6.6**

**Rationale**: Complete audit trails are essential for debugging, compliance, and understanding system behavior.

**Test Implementation**:
- Generate random sync operations
- Execute sync
- Query sync logs
- Assert: log exists with correct operation, direction, status, and timestamp

### Property 6: Error Handling Non-Throwing

*For any* error during outgoing sync operations, the error should be logged and stored but not thrown (sync is non-critical).

**Validates: Requirements 3.3, 6.7**

**Rationale**: Sync failures should not break the main purchase flow. Errors are logged for later investigation but don't prevent the user's transaction from completing.

**Test Implementation**:
- Generate random sync errors (API down, invalid data, etc.)
- Mock error conditions
- Call syncBonusAccrualToMoySklad()
- Assert: no exception thrown, sync log created with status "error"

### Property 7: Incoming Sync Data Transformation

*For any* МойСклад bonus transaction (EARNING or SPENDING), syncing it to our system should create the corresponding Bonus/Transaction records with correct types and amounts.

**Validates: Requirements 4.1, 4.2, 4.3**

**Rationale**: Data must be correctly transformed between МойСклад's format and our system's format to maintain consistency.

**Test Implementation**:
- Generate random МойСклад bonus transactions (EARNING and SPENDING types)
- Call syncFromMoySklad()
- Query database
- Assert:
  - EARNING → Bonus record with type PURCHASE, Transaction with type EARN
  - SPENDING → Transaction with type SPEND
  - Amounts match
  - moySkladTransactionId stored in metadata

### Property 8: Telegram Notification Conditional Sending

*For any* incoming sync operation, a Telegram notification should be sent if and only if the user has a telegramChatId.

**Validates: Requirements 4.6, 9.3**

**Rationale**: Notifications should only be sent to users who have connected their Telegram account.

**Test Implementation**:
- Generate random users (with and without telegramChatId)
- Perform incoming sync
- Check notification queue
- Assert: notification sent ⟺ user has telegramChatId

### Property 9: Balance Comparison Threshold

*For any* two balance values, they should be considered synced if and only if their absolute difference is less than 0.01.

**Validates: Requirements 5.3, 5.5**

**Rationale**: Floating-point arithmetic can introduce tiny differences. A small threshold prevents false positives while catching real discrepancies.

**Test Implementation**:
- Generate random balance pairs
- Call checkAndSyncBalance()
- Assert:
  - |balance1 - balance2| < 0.01 → synced = true
  - |balance1 - balance2| >= 0.01 → synced = false, warning logged

### Property 10: Balance Check Error Resilience

*For any* МойСклад API error during balance check, the method should return the local balance with moySkladBalance = null and synced = false, without throwing an exception.

**Validates: Requirements 5.6**

**Rationale**: Balance checks should be resilient to МойСклад API failures. Users should still see their local balance even if МойСклад is unavailable.

**Test Implementation**:
- Generate random API errors
- Mock МойСклад API to fail
- Call checkAndSyncBalance()
- Assert: returns { ourBalance: X, moySkladBalance: null, synced: false, error: "..." }

### Property 11: Webhook Signature Validation

*For any* webhook payload, it should be processed if and only if the HMAC-SHA256 signature is valid.

**Validates: Requirements 6.2**

**Rationale**: Webhook signature validation prevents unauthorized parties from injecting fake events into our system.

**Test Implementation**:
- Generate random webhook payloads
- Generate valid and invalid signatures
- Call webhook handler
- Assert:
  - Valid signature → 200 OK, events processed
  - Invalid signature → 401 Unauthorized, events not processed

### Property 12: Webhook Integration Validation

*For any* webhook request, it should be processed if and only if the integration exists and is active.

**Validates: Requirements 6.3**

**Rationale**: Webhooks should only be processed for active integrations to prevent processing events for disabled or deleted integrations.

**Test Implementation**:
- Generate random projectIds (existing, non-existing, inactive)
- Call webhook handler
- Assert:
  - Existing + active → 200 OK
  - Non-existing → 404 Not Found
  - Existing + inactive → 404 Not Found

### Property 13: Webhook Event Filtering

*For any* webhook payload with multiple events, only events of type "bonustransaction" should be processed.

**Validates: Requirements 6.4, 6.5**

**Rationale**: МойСклад webhooks can contain multiple event types. We only care about bonus transactions.

**Test Implementation**:
- Generate random webhook payloads with mixed event types
- Call webhook handler
- Count processed events
- Assert: only bonustransaction events processed

### Property 14: Integration CRUD Persistence

*For any* valid integration data, creating/updating/deleting through the API should correctly persist the changes to the database.

**Validates: Requirements 7.2, 7.3, 7.4**

**Rationale**: Standard CRUD operations must work correctly for integration management.

**Test Implementation**:
- Generate random integration data
- POST to create → verify in database
- PUT to update → verify changes in database
- DELETE → verify isActive = false (soft delete)
- Assert: database state matches API operations

### Property 15: Sync Logs Query Filtering

*For any* combination of query parameters (operation, direction, status, date range), the sync logs endpoint should return only logs matching all specified filters.

**Validates: Requirements 7.7**

**Rationale**: Filtering is essential for investigating specific sync issues or patterns.

**Test Implementation**:
- Create random sync logs with various attributes
- Generate random filter combinations
- Query sync logs API
- Assert: all returned logs match all specified filters

### Property 16: Form Input Validation

*For any* integration form submission with invalid data (empty required fields, invalid UUID format), the form should reject the submission and display appropriate error messages.

**Validates: Requirements 8.3**

**Rationale**: Client-side validation prevents invalid data from reaching the server and provides immediate user feedback.

**Test Implementation**:
- Generate random form inputs (valid and invalid)
- Submit form
- Assert:
  - Valid data → submission succeeds
  - Invalid data → submission blocked, errors displayed
  - Empty required fields → specific error messages
  - Invalid UUID format → format error message

### Property 17: Telegram Balance Command Response

*For any* user requesting balance via Telegram, the response should include both local and МойСклад balances (if available) and sync status.

**Validates: Requirements 9.1, 9.2**

**Rationale**: Users need visibility into both systems to understand their total bonus balance.

**Test Implementation**:
- Generate random users (with/without МойСклад integration)
- Send /balance command
- Parse response message
- Assert:
  - Message contains local balance
  - If integration active: message contains МойСклад balance
  - Message contains sync status (✅ or ⚠️)
  - Message format matches template


## API Routes

### Integration Management Routes

#### GET /api/projects/[id]/integrations/moysklad-direct

**Purpose**: Retrieve integration settings for a project

**Authentication**: Required (project owner)

**Response**:
```typescript
{
  id: string;
  projectId: string;
  accountId: string;
  bonusProgramId: string;
  syncDirection: 'BIDIRECTIONAL' | 'MOYSKLAD_TO_US' | 'US_TO_MOYSKLAD';
  autoSync: boolean;
  webhookSecret: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  // Note: apiToken is NOT returned for security
}
```

**Error Responses**:
- 401: Unauthorized
- 403: Forbidden (not project owner)
- 404: Integration not found

#### POST /api/projects/[id]/integrations/moysklad-direct

**Purpose**: Create new integration

**Authentication**: Required (project owner)

**Request Body**:
```typescript
{
  accountId: string;        // Required, UUID format
  apiToken: string;         // Required, will be encrypted
  bonusProgramId: string;   // Required, UUID format
  syncDirection?: 'BIDIRECTIONAL' | 'MOYSKLAD_TO_US' | 'US_TO_MOYSKLAD';
  autoSync?: boolean;
}
```

**Validation**:
- accountId: required, UUID format
- apiToken: required, non-empty
- bonusProgramId: required, UUID format
- syncDirection: optional, valid enum value
- autoSync: optional, boolean

**Response**: Same as GET, includes generated webhookSecret

**Error Responses**:
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden
- 409: Integration already exists for this project

#### PUT /api/projects/[id]/integrations/moysklad-direct

**Purpose**: Update existing integration

**Authentication**: Required (project owner)

**Request Body**: Partial update, all fields optional
```typescript
{
  accountId?: string;
  apiToken?: string;        // Will be encrypted if provided
  bonusProgramId?: string;
  syncDirection?: 'BIDIRECTIONAL' | 'MOYSKLAD_TO_US' | 'US_TO_MOYSKLAD';
  autoSync?: boolean;
  isActive?: boolean;
}
```

**Response**: Updated integration object

**Error Responses**:
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden
- 404: Integration not found

#### DELETE /api/projects/[id]/integrations/moysklad-direct

**Purpose**: Soft delete integration (set isActive = false)

**Authentication**: Required (project owner)

**Response**: 204 No Content

**Error Responses**:
- 401: Unauthorized
- 403: Forbidden
- 404: Integration not found

**Note**: Sync logs are preserved for audit purposes

#### POST /api/projects/[id]/integrations/moysklad-direct/test

**Purpose**: Test МойСклад API connection

**Authentication**: Required (project owner)

**Response**:
```typescript
{
  success: boolean;
  error?: string;
  details?: {
    accountId: string;
    bonusProgramId: string;
    apiVersion: string;
  };
}
```

**Error Responses**:
- 401: Unauthorized
- 403: Forbidden
- 404: Integration not found

#### POST /api/projects/[id]/integrations/moysklad-direct/sync

**Purpose**: Manually trigger synchronization

**Authentication**: Required (project owner)

**Request Body**:
```typescript
{
  userId?: string;  // Optional: sync specific user, otherwise sync all
}
```

**Response**:
```typescript
{
  synced: number;
  errors: number;
  details: Array<{
    userId: string;
    status: 'success' | 'error';
    error?: string;
  }>;
}
```

**Error Responses**:
- 401: Unauthorized
- 403: Forbidden
- 404: Integration not found

#### GET /api/projects/[id]/integrations/moysklad-direct/logs

**Purpose**: Retrieve sync logs with filtering and pagination

**Authentication**: Required (project owner)

**Query Parameters**:
- operation?: string (bonus_accrual, bonus_spending, balance_sync)
- direction?: string (incoming, outgoing)
- status?: string (success, error, pending)
- dateFrom?: string (ISO 8601)
- dateTo?: string (ISO 8601)
- limit?: number (default: 50, max: 100)
- offset?: number (default: 0)

**Response**:
```typescript
{
  logs: Array<{
    id: string;
    operation: string;
    direction: string;
    moySkladTransactionId: string | null;
    userId: string | null;
    amount: number | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    // Expandable details:
    requestData?: any;
    responseData?: any;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

**Error Responses**:
- 400: Invalid query parameters
- 401: Unauthorized
- 403: Forbidden
- 404: Integration not found

### Webhook Route

#### POST /api/webhook/moysklad-direct/[projectId]

**Purpose**: Receive webhook events from МойСклад

**Authentication**: HMAC-SHA256 signature validation

**Headers**:
- X-MoySklad-Signature: HMAC-SHA256 signature of request body

**Request Body**:
```typescript
{
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  events: Array<{
    meta: {
      href: string;
      type: string;
    };
    action: string;
    accountId: string;
  }>;
}
```

**Response**: 200 OK (empty body)

**Error Responses**:
- 401: Invalid signature
- 404: Integration not found or inactive
- 500: Internal server error

**Processing**:
1. Validate signature
2. Find integration by projectId
3. Filter bonustransaction events
4. For each event:
   - Fetch full transaction from МойСклад API
   - Call SyncService.syncFromMoySklad()
5. Log webhook request
6. Return 200 OK

**Note**: МойСклад will retry failed webhooks with exponential backoff

## UI Components

### Integration Settings Page

**Location**: `/dashboard/projects/[id]/integrations/moysklad-direct`

**Components**:

#### IntegrationStatusCard
- Shows integration status (active/inactive)
- Last sync timestamp
- Last error (if any)
- Quick actions: Test Connection, Manual Sync

#### IntegrationForm
- Form fields:
  - Account ID (text input, required)
  - API Token (password input, required)
  - Bonus Program ID (text input, required)
  - Sync Direction (select dropdown)
  - Auto Sync (checkbox)
  - Is Active (toggle switch)
- Validation:
  - Real-time validation on blur
  - Submit button disabled until valid
  - Error messages below fields
- Actions:
  - Test Connection (button)
  - Save (button)
  - Cancel (button)

#### WebhookCredentials
- Webhook URL (read-only, with copy button)
- Webhook Secret (read-only, with copy button, masked by default)
- Setup instructions:
  1. Copy webhook URL
  2. Go to МойСклад settings
  3. Add webhook for bonus transactions
  4. Paste URL and secret
  5. Test webhook

#### SyncLogsTable
- Columns:
  - Timestamp
  - Operation (badge with color)
  - Direction (icon: ← or →)
  - User (link to user profile)
  - Amount
  - Status (badge: success/error/pending)
  - Actions (expand details)
- Filters:
  - Operation dropdown
  - Direction dropdown
  - Status dropdown
  - Date range picker
  - Search by user
- Pagination:
  - Page size selector (25, 50, 100)
  - Page navigation
- Expandable rows:
  - Full request data (JSON viewer)
  - Full response data (JSON viewer)
  - Error message (if any)

#### SyncStatsCards
- Total Syncs (success + error)
- Success Rate (percentage with trend)
- Last Sync Time (relative time)
- Total Bonus Synced (sum of amounts)

#### SyncStatsChart
- Line chart: syncs over time (last 30 days)
- Separate lines for success and error
- Hover tooltips with details
- Responsive design

#### ManualSyncDialog
- Trigger: "Manual Sync" button
- Options:
  - Sync all users (radio)
  - Sync specific user (radio + user selector)
- Progress indicator during sync
- Results display:
  - Users synced successfully
  - Users with errors
  - Error details (expandable list)

### Component Styling

**Design System**: Follows dashboard-design-system.md

**Key Styles**:
- Glass cards with backdrop blur
- Smooth transitions (0.2s - 0.4s)
- Hover effects on interactive elements
- Color-coded status badges:
  - Success: emerald-500
  - Error: rose-500
  - Pending: amber-500
- Icons from lucide-react
- Responsive grid layouts

**Animations**:
- Stagger animation for stats cards
- Fade-in for table rows
- Slide-in for expandable details
- Pulse animation for sync in progress

### Form Validation

**Client-Side Validation**:
```typescript
const validationSchema = z.object({
  accountId: z.string()
    .min(1, 'Account ID is required')
    .uuid('Account ID must be a valid UUID'),
  apiToken: z.string()
    .min(1, 'API Token is required'),
  bonusProgramId: z.string()
    .min(1, 'Bonus Program ID is required')
    .uuid('Bonus Program ID must be a valid UUID'),
  syncDirection: z.enum(['BIDIRECTIONAL', 'MOYSKLAD_TO_US', 'US_TO_MOYSKLAD']),
  autoSync: z.boolean(),
  isActive: z.boolean()
});
```

**Error Messages**:
- Required fields: "[Field] is required"
- Invalid UUID: "[Field] must be a valid UUID"
- API errors: Display server error message
- Network errors: "Unable to connect. Please try again."

## Performance Optimization

### Caching Strategy

#### Balance Caching
- Cache МойСклад balance queries for 5 minutes
- Cache key: `moysklad:balance:${counterpartyId}`
- Invalidate on:
  - Successful sync operation
  - Manual sync trigger
  - Cache expiration

**Implementation**:
```typescript
class BalanceCache {
  private cache = new Map<string, { balance: number; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(counterpartyId: string): number | null {
    const cached = this.cache.get(counterpartyId);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(counterpartyId);
      return null;
    }
    
    return cached.balance;
  }

  set(counterpartyId: string, balance: number): void {
    this.cache.set(counterpartyId, {
      balance,
      timestamp: Date.now()
    });
  }

  invalidate(counterpartyId: string): void {
    this.cache.delete(counterpartyId);
  }
}
```

#### API Response Caching
- Cache counterparty lookups for 1 hour
- Cache key: `moysklad:counterparty:${counterpartyId}`
- Invalidate on: manual refresh, cache expiration

### Batching

#### Bulk Sync Operations
- When syncing multiple users, batch API calls
- Batch size: 10 users per batch
- Parallel execution within batch
- Sequential execution between batches (to avoid rate limits)

**Implementation**:
```typescript
async function bulkSync(userIds: string[]): Promise<BulkSyncResult> {
  const batchSize = 10;
  const batches = chunk(userIds, batchSize);
  
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ userId: string; error: string }> = [];
  
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(userId => syncUser(userId))
    );
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        errorCount++;
        errors.push({
          userId: batch[i],
          error: result.reason.message
        });
      }
    }
    
    // Rate limit protection: wait between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await sleep(1000);
    }
  }
  
  return {
    totalUsers: userIds.length,
    successCount,
    errorCount,
    errors
  };
}
```

### Database Optimization

#### Indexes
- MoySkladDirectIntegration: projectId, webhookSecret
- MoySkladDirectSyncLog: integrationId + createdAt (composite), userId, status, moySkladTransactionId
- User: moySkladDirectCounterpartyId

#### Query Optimization
- Use select to fetch only needed fields
- Use pagination for large result sets
- Use database-level filtering instead of application-level

**Example**:
```typescript
// Good: database-level filtering
const logs = await db.moySkladDirectSyncLog.findMany({
  where: {
    integrationId,
    status: 'error',
    createdAt: {
      gte: dateFrom,
      lte: dateTo
    }
  },
  select: {
    id: true,
    operation: true,
    direction: true,
    status: true,
    createdAt: true
  },
  take: limit,
  skip: offset,
  orderBy: { createdAt: 'desc' }
});

// Bad: application-level filtering
const allLogs = await db.moySkladDirectSyncLog.findMany({
  where: { integrationId }
});
const filteredLogs = allLogs
  .filter(log => log.status === 'error')
  .filter(log => log.createdAt >= dateFrom && log.createdAt <= dateTo)
  .slice(offset, offset + limit);
```

### Rate Limiting

#### МойСклад API Rate Limits
- Limit: 45 requests per 3 seconds per account
- Strategy: Token bucket algorithm
- Backoff: Exponential backoff on 429 errors

**Implementation**:
```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens = 45;
  private readonly refillInterval = 3000; // 3 seconds

  constructor() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    
    // Wait for next refill
    const waitTime = this.refillInterval - (Date.now() - this.lastRefill);
    await sleep(waitTime);
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed >= this.refillInterval) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
```

### Connection Pooling

#### Database Connection Pool
- Min connections: 2
- Max connections: 10
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

#### HTTP Connection Reuse
- Use keep-alive for МойСклад API requests
- Reuse TCP connections
- Connection timeout: 30 seconds

## Security Considerations

### API Token Security

**Storage**:
- Encrypted at rest using AES-256-GCM
- Master key stored in environment variable
- Never logged or exposed in API responses
- Decrypted only when needed for API calls

**Transmission**:
- HTTPS only (TLS 1.2+)
- Bearer token in Authorization header
- No token in URL parameters

**Access Control**:
- Only project owner can view/edit integration
- API tokens never returned in GET requests
- Audit log for all token access

### Webhook Security

**Signature Validation**:
- HMAC-SHA256 signature required
- Timing-safe comparison to prevent timing attacks
- Reject requests with invalid signatures

**Replay Protection**:
- Process each webhook event only once
- Store processed event IDs (future enhancement)
- Timestamp validation (future enhancement)

**Rate Limiting**:
- Limit webhook requests per project
- Prevent DoS attacks
- Return 429 if rate limit exceeded

### Multi-Tenancy Isolation

**Data Isolation**:
- All queries filtered by projectId or ownerId
- No cross-project data access
- Webhook URLs include projectId

**Authentication**:
- JWT-based authentication for API routes
- Project ownership verification
- Role-based access control (future enhancement)

### Input Validation

**Server-Side Validation**:
- Validate all input data
- Sanitize user input
- Use Zod schemas for type safety
- Reject invalid data with 400 Bad Request

**SQL Injection Prevention**:
- Use Prisma ORM (parameterized queries)
- Never concatenate user input into queries

**XSS Prevention**:
- Sanitize output in UI components
- Use React's built-in XSS protection
- Content Security Policy headers

## Deployment Considerations

### Environment Variables

**Required**:
```bash
# Database
DATABASE_URL="postgresql://..."

# Encryption
MOYSKLAD_ENCRYPTION_KEY="[strong-random-key-32-chars-min]"

# Application
NEXTAUTH_SECRET="[random-secret]"
NEXTAUTH_URL="https://your-domain.com"
```

**Optional**:
```bash
# МойСклад API (for testing)
MOYSKLAD_API_BASE_URL="https://api.moysklad.ru/api/remap/1.2"
MOYSKLAD_API_TIMEOUT="30000"

# Logging
LOG_LEVEL="info"
```

### Database Migration

**Migration Steps**:
1. Run Prisma migration: `npx prisma migrate deploy`
2. Verify tables created: MoySkladDirectIntegration, MoySkladDirectSyncLog
3. Verify indexes created
4. Verify User.moySkladDirectCounterpartyId field added

**Rollback Plan**:
- Keep previous migration version
- Backup database before migration
- Test migration in staging environment first

### Monitoring

**Key Metrics**:
- Sync success rate (target: > 99%)
- Sync latency (target: < 5s)
- API error rate (target: < 1%)
- Webhook delivery rate (target: 100%)
- Balance mismatch rate (target: < 1%)

**Alerts**:
- Sync success rate < 95% for 1 hour
- API error rate > 5% for 15 minutes
- No webhooks received for 1 hour (for active projects)
- Balance mismatch rate > 5% for 1 day

**Logging**:
- All sync operations logged
- All API errors logged
- All webhook requests logged
- Retention: 90 days for sync logs, 30 days for system logs

### Scaling Considerations

**Horizontal Scaling**:
- Stateless application design
- Shared database connection pool
- Distributed caching (Redis) for balance cache (future)

**Vertical Scaling**:
- Increase database connection pool size
- Increase API timeout for slow networks
- Increase worker threads for parallel sync

**Performance Targets**:
- Support 1000+ projects
- Support 100,000+ users
- Handle 10,000+ sync operations per day
- Process webhooks within 5 seconds

## Future Enhancements

### Automatic Balance Reconciliation
- Detect balance mismatches automatically
- Implement reconciliation strategies:
  - Trust МойСклад as source of truth
  - Trust our system as source of truth
  - Manual review queue for large discrepancies
- Schedule periodic balance checks

### Advanced Sync Strategies
- Conflict resolution for simultaneous updates
- Transaction deduplication
- Idempotent sync operations
- Sync retry queue for failed operations

### Enhanced Monitoring
- Real-time dashboard for sync status
- Grafana integration for metrics
- Sentry integration for error tracking
- Slack/email notifications for critical errors

### Performance Improvements
- Redis caching for balance and counterparty data
- Background job queue for async sync
- Webhook event batching
- Database read replicas for reporting

### Additional Features
- Bulk import of counterparty mappings
- CSV export of sync logs
- Sync scheduling (e.g., nightly full sync)
- Multi-currency support
- Custom sync rules per project

