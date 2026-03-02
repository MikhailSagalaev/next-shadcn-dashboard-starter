# Design Document: МойСклад Integration

## Overview

This design document describes the technical architecture for integrating the SaaS Bonus System with МойСклад API. The integration enables bidirectional synchronization of bonus transactions between offline point-of-sale systems (МойСклад) and online stores (our system), providing users with a unified bonus balance across all channels.

### Key Objectives

1. **Unified Balance**: Maintain a single, consistent bonus balance across МойСклад and Bonus System
2. **Real-time Sync**: Synchronize bonus transactions in real-time using webhooks and REST API
3. **Conflict Resolution**: Automatically resolve balance discrepancies using Last Write Wins strategy
4. **Multi-tenant Support**: Isolate integration configurations per project (tenant)
5. **Resilience**: Handle external API failures gracefully without disrupting core system operations
6. **Security**: Protect sensitive integration credentials and validate all external requests

### Integration Flow

```
┌─────────────────┐         Webhook Events        ┌──────────────────┐
│   МойСклад      │ ─────────────────────────────> │  Bonus System    │
│   (Offline POS) │                                 │  (Online Store)  │
│                 │ <───────────────────────────── │                  │
└─────────────────┘         REST API Calls         └──────────────────┘
                            (Bonus Transactions)
```

### Synchronization Modes

- **BIDIRECTIONAL**: Full two-way sync (webhooks + API calls)
- **MOYSKLAD_TO_US**: Only receive transactions from МойСклад (webhooks only)
- **US_TO_MOYSKLAD**: Only send transactions to МойСклад (API calls only)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Bonus System                              │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Next.js    │      │  Integration │      │   Telegram   │  │
│  │   UI Layer   │──────│   Service    │──────│     Bot      │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                      │                      │          │
│         │                      │                      │          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Database Layer                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   Users    │  │Integration │  │  Sync Log  │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      МойСклад API                                │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Webhooks   │      │  REST API    │      │ Counterparty │  │
│  │   Events     │      │  Endpoints   │      │   Database   │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── moysklad/
│   │           └── [projectId]/
│   │               └── route.ts          # Webhook endpoint
│   └── dashboard/
│       └── projects/
│           └── [id]/
│               └── integrations/
│                   └── moysklad/
│                       ├── page.tsx      # Settings UI
│                       └── components/
│                           ├── integration-form.tsx
│                           ├── sync-history.tsx
│                           └── manual-sync.tsx
├── lib/
│   ├── moysklad/
│   │   ├── client.ts                    # API Client
│   │   ├── sync-service.ts              # Sync Service
│   │   ├── parser.ts                    # Parser/Printer
│   │   ├── types.ts                     # TypeScript types
│   │   └── circuit-breaker.ts           # Circuit Breaker
│   ├── telegram/
│   │   └── commands/
│   │       └── balance.ts               # Extended /balance command
│   └── encryption.ts                    # Token encryption
└── prisma/
    └── schema.prisma                    # Database schema
```

## Components and Interfaces

### 1. МойСклад API Client

**Location**: `src/lib/moysklad/client.ts`

**Purpose**: Provides typed interface for interacting with МойСклад REST API.

**Interface**:

```typescript
interface MoySkladClientConfig {
  accountId: string;
  apiToken: string;
  bonusProgramId: string;
  baseUrl?: string; // Default: https://api.moysklad.ru/api/remap/1.0
  timeout?: number;  // Default: 30000ms
}

class MoySkladClient {
  constructor(config: MoySkladClientConfig);
  
  // Connection validation
  async testConnection(): Promise<boolean>;
  
  // Counterparty operations
  async findCounterpartyByPhone(phone: string): Promise<Counterparty | null>;
  async findCounterpartyByEmail(email: string): Promise<Counterparty | null>;
  
  // Balance operations
  async getBalance(counterpartyId: string): Promise<number>;
  
  // Transaction operations
  async accrueBonus(params: AccrueBonusParams): Promise<BonusTransaction>;
  async spendBonus(params: SpendBonusParams): Promise<BonusTransaction>;
  
  // Transaction history
  async getTransactions(counterpartyId: string, limit?: number): Promise<BonusTransaction[]>;
  async getLastTransaction(counterpartyId: string): Promise<BonusTransaction | null>;
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
```

**Key Features**:
- Bearer token authentication
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Request timeout (30 seconds)
- Connection pooling (max 10 connections per project)
- Comprehensive error handling with typed errors
- Request/response logging

**Error Handling**:

```typescript
class MoySkladApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public response?: any
  ) {
    super(message);
  }
}

// Error types
- 401: Authentication failed (invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Resource not found (counterparty, transaction)
- 429: Rate limit exceeded
- 500: МойСклад server error
- TIMEOUT: Request timeout
- NETWORK: Network error
```

### 2. Integration Sync Service

**Location**: `src/lib/moysklad/sync-service.ts`

**Purpose**: Orchestrates synchronization between Bonus System and МойСклад.

**Interface**:

```typescript
class MoySkladSyncService {
  constructor(
    private client: MoySkladClient,
    private integration: MoySkladIntegration
  );
  
  // Incoming sync (МойСклад → Bonus System)
  async syncBonusAccrual(transaction: MoySkladBonusTransaction): Promise<void>;
  async syncBonusSpending(transaction: MoySkladBonusTransaction): Promise<void>;
  
  // Outgoing sync (Bonus System → МойСклад)
  async sendBonusAccrual(bonus: Bonus): Promise<void>;
  async sendBonusSpending(transaction: Transaction): Promise<void>;
  
  // Balance verification
  async verifyBalance(userId: string): Promise<BalanceVerificationResult>;
  async resolveBalanceConflict(userId: string): Promise<void>;
  
  // Manual sync
  async syncUser(userId: string): Promise<SyncResult>;
  async syncAllUsers(projectId: string): Promise<BulkSyncResult>;
  
  // User linking
  async linkUser(userId: string, phone: string): Promise<void>;
  async findOrCreateUser(counterparty: Counterparty): Promise<User>;
}

interface BalanceVerificationResult {
  bonusSystemBalance: number;
  moySkladBalance: number;
  isMatch: boolean;
  difference: number;
  lastBonusSystemTransaction?: Date;
  lastMoySkladTransaction?: Date;
}

interface SyncResult {
  success: boolean;
  userId: string;
  operation: string;
  error?: string;
}

interface BulkSyncResult {
  totalUsers: number;
  successCount: number;
  errorCount: number;
  conflictsResolved: number;
  errors: Array<{ userId: string; error: string }>;
}
```

**Key Features**:
- Bidirectional synchronization
- User identification by phone number (E.164 normalization)
- Automatic user creation for new counterparties
- Last Write Wins conflict resolution
- Circuit breaker pattern (5 failures → 5 minute cooldown)
- Comprehensive sync logging
- Rate limiting for bulk operations (10 users/second)

**Sync Flow**:

```
Incoming Transaction (Webhook):
1. Validate webhook signature
2. Parse webhook payload
3. Fetch full transaction details from API
4. Identify user by phone number
5. Create/update user if needed
6. Apply bonus calculation rules
7. Create bonus/transaction record
8. Log sync operation

Outgoing Transaction (API):
1. Check sync direction configuration
2. Find user's counterparty ID
3. Search counterparty if ID missing
4. Create bonus transaction via API
5. Log sync operation
6. Retry on failure (3 attempts)
```

### 3. Webhook Endpoint

**Location**: `src/app/api/webhook/moysklad/[projectId]/route.ts`

**Purpose**: Receives and processes webhook events from МойСклад.

**Interface**:

```typescript
// POST /api/webhook/moysklad/[projectId]
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
): Promise<Response>;
```

**Request Headers**:
- `X-MoySklad-Signature`: HMAC-SHA256 signature of request body
- `Content-Type`: application/json

**Request Body**:

```typescript
interface WebhookPayload {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  events: Array<{
    meta: {
      type: string;
      href: string;
    };
    action: string;
    accountId: string;
  }>;
}
```

**Response Codes**:
- `200`: Successfully processed
- `400`: Malformed request data
- `401`: Invalid signature
- `404`: Project not found or integration not active
- `429`: Rate limit exceeded (100 req/min per project)
- `500`: Processing error (triggers МойСклад retry)

**Security**:
- HMAC-SHA256 signature validation
- IP whitelist validation (МойСклад IP ranges)
- Rate limiting (100 requests/minute per project)
- Request size limit (1MB)

### 4. Parser and Pretty Printer

**Location**: `src/lib/moysklad/parser.ts`

**Purpose**: Parse and validate МойСклад JSON entities with type safety.

**Interface**:

```typescript
// Parser functions
function parseBonusTransaction(json: unknown): BonusTransaction;
function parseCounterparty(json: unknown): Counterparty;
function parseWebhookPayload(json: unknown): WebhookPayload;

// Pretty printer functions
function printBonusTransaction(transaction: BonusTransaction): string;
function printCounterparty(counterparty: Counterparty): string;

// Validation functions
function validateBonusTransaction(data: unknown): ValidationResult;
function validateCounterparty(data: unknown): ValidationResult;

// Type guards
function isBonusTransaction(data: unknown): data is BonusTransaction;
function isCounterparty(data: unknown): data is Counterparty;
```

**Key Features**:
- Zod schema validation
- Required field validation
- Enum value validation
- ISO 8601 timestamp parsing
- Nested object handling
- Round-trip property guarantee

**Type Definitions**:

```typescript
interface BonusTransaction {
  id: string;
  meta: {
    href: string;
    type: 'bonustransaction';
  };
  agent: {
    meta: {
      href: string;
      type: 'counterparty';
    };
  };
  bonusValue: number;
  transactionType: 'EARNING' | 'SPENDING';
  transactionStatus: 'COMPLETED' | 'WAIT_PROCESSING';
  moment: Date;
  comment?: string;
}

interface Counterparty {
  id: string;
  meta: {
    href: string;
    type: 'counterparty';
  };
  name: string;
  phone?: string;
  email?: string;
  bonusPoints?: number;
}
```

### 5. Circuit Breaker

**Location**: `src/lib/moysklad/circuit-breaker.ts`

**Purpose**: Prevent cascading failures when МойСклад API is unavailable.

**Interface**:

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

class CircuitBreaker {
  constructor(config: CircuitBreakerConfig);
  
  async execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
  reset(): void;
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Default: 5
  resetTimeout: number;         // Default: 300000 (5 minutes)
  monitoringPeriod: number;     // Default: 60000 (1 minute)
}
```

**Behavior**:
- **CLOSED**: All requests pass through normally
- **OPEN**: After 5 consecutive failures, circuit opens for 5 minutes
- **HALF_OPEN**: After timeout, allows 1 test request
- Success in HALF_OPEN → CLOSED
- Failure in HALF_OPEN → OPEN again

### 6. UI Components

#### Integration Settings Page

**Location**: `src/app/dashboard/projects/[id]/integrations/moysklad/page.tsx`

**Features**:
- Integration configuration form
- Connection test button
- Webhook URL display
- Sync direction selector
- Enable/disable toggle
- Sync history table
- Manual sync controls
- Statistics dashboard

**Form Fields**:
- МойСклад Account ID
- API Token (encrypted)
- Bonus Program ID
- Sync Direction (BIDIRECTIONAL | MOYSKLAD_TO_US | US_TO_MOYSKLAD)
- Phone Field Name (default: "phone")
- Email Field Name (default: "email")

#### Sync History Component

**Location**: `src/app/dashboard/projects/[id]/integrations/moysklad/components/sync-history.tsx`

**Features**:
- Paginated sync log table
- Filters: status, operation type, date range
- Expandable rows for request/response data
- Export to CSV
- Real-time updates

**Columns**:
- Timestamp
- Operation (bonus_accrual | bonus_spending | balance_sync)
- Direction (incoming | outgoing)
- User
- Status (success | error | pending)
- Error message (if failed)

#### Manual Sync Component

**Location**: `src/app/dashboard/projects/[id]/integrations/moysklad/components/manual-sync.tsx`

**Features**:
- "Sync All Users" button
- Individual user sync
- Progress indicator
- Results summary
- Error details

### 7. Telegram Bot Extension

**Location**: `src/lib/telegram/commands/balance.ts`

**Enhanced /balance Command**:

```typescript
async function handleBalanceCommand(ctx: Context) {
  const user = await getUserFromContext(ctx);
  const project = await getProjectForUser(user);
  
  // Fetch local balance
  const localBalance = await getLocalBalance(user.id);
  
  // Check if МойСклад integration is active
  const integration = await getMoySkladIntegration(project.id);
  
  if (!integration?.isActive) {
    return ctx.reply(`Ваш баланс: ${localBalance} ${project.currency}`);
  }
  
  // Fetch МойСклад balance
  const moySkladBalance = await fetchMoySkladBalance(user, integration);
  
  // Compare balances
  if (Math.abs(localBalance - moySkladBalance) < 0.01) {
    return ctx.reply(`Ваш баланс: ${localBalance} ${project.currency}`);
  }
  
  // Balances differ - show both and trigger sync
  await ctx.reply(
    `⚠️ Обнаружено расхождение балансов:\n` +
    `Онлайн: ${localBalance} ${project.currency}\n` +
    `Офлайн: ${moySkladBalance} ${project.currency}\n\n` +
    `Выполняется синхронизация...`
  );
  
  // Trigger automatic sync
  await syncService.resolveBalanceConflict(user.id);
  
  // Send follow-up
  const newBalance = await getLocalBalance(user.id);
  await ctx.reply(
    `✅ Синхронизация завершена\n` +
    `Актуальный баланс: ${newBalance} ${project.currency}`
  );
}
```

## Data Models

### Database Schema

```prisma
// МойСклад Integration Configuration
model MoySkladIntegration {
  id                String   @id @default(cuid())
  projectId         String   @unique
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // МойСклад credentials
  accountId         String
  apiToken          String   // Encrypted with AES-256
  bonusProgramId    String
  
  // Sync configuration
  syncDirection     SyncDirection @default(BIDIRECTIONAL)
  syncBonuses       Boolean  @default(true)
  syncTransactions  Boolean  @default(true)
  
  // Field mapping
  phoneFieldName    String   @default("phone")
  emailFieldName    String   @default("email")
  
  // Webhook configuration
  webhookUrl        String   @unique
  webhookSecret     String   // For HMAC signature validation
  
  // Status
  isActive          Boolean  @default(false)
  lastSyncAt        DateTime?
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  syncLogs          MoySkladSyncLog[]
  
  @@index([projectId])
}

enum SyncDirection {
  BIDIRECTIONAL
  MOYSKLAD_TO_US
  US_TO_MOYSKLAD
}

// Synchronization Log
model MoySkladSyncLog {
  id              String   @id @default(cuid())
  integrationId   String
  integration     MoySkladIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  
  // Operation details
  operation       SyncOperation
  direction       SyncDirection
  moySkladId      String?  // МойСклад entity ID
  
  // User reference
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // Request/Response data
  requestData     Json?
  responseData    Json?
  
  // Status
  status          SyncStatus
  errorMessage    String?
  
  // Timestamp
  createdAt       DateTime @default(now())
  
  @@index([integrationId, createdAt])
  @@index([userId])
  @@index([status])
}

enum SyncOperation {
  BONUS_ACCRUAL
  BONUS_SPENDING
  BALANCE_SYNC
  USER_LINK
  MANUAL_SYNC
}

enum SyncStatus {
  SUCCESS
  ERROR
  PENDING
}

// User model extension
model User {
  id                      String   @id @default(cuid())
  // ... existing fields ...
  
  // МойСклад integration
  moySkladCounterpartyId  String?  @unique
  lastSyncAt              DateTime?
  
  // Relations
  moySkladSyncLogs        MoySkladSyncLog[]
}
```

### Data Flow Diagrams

#### Incoming Webhook Flow

```
┌──────────────┐
│  МойСклад    │
│  Webhook     │
└──────┬───────┘
       │ POST /api/webhook/moysklad/[projectId]
       │ X-MoySklad-Signature: <hmac>
       │ { action: "CREATE", events: [...] }
       ▼
┌──────────────────────────────────────────┐
│  Webhook Endpoint                        │
│  1. Validate signature                   │
│  2. Check rate limit                     │
│  3. Parse payload                        │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Integration Sync Service                │
│  1. Fetch transaction details from API   │
│  2. Normalize phone number               │
│  3. Find or create user                  │
│  4. Apply bonus rules                    │
│  5. Create bonus/transaction record      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Database                                │
│  1. Insert Bonus/Transaction             │
│  2. Update User.lastSyncAt               │
│  3. Insert MoySkladSyncLog               │
└──────────────────────────────────────────┘
```

#### Outgoing API Flow

```
┌──────────────┐
│  Bonus       │
│  Created     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Integration Sync Service                │
│  1. Check sync direction                 │
│  2. Get user's counterparty ID           │
│  3. Search counterparty if needed        │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  МойСклад API Client                     │
│  1. Build request payload                │
│  2. Add Bearer token                     │
│  3. POST to МойСклад API                 │
│  4. Handle response/errors               │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Circuit Breaker                         │
│  1. Check circuit state                  │
│  2. Execute request or fail fast         │
│  3. Update failure count                 │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Database                                │
│  1. Insert MoySkladSyncLog               │
│  2. Update Integration.lastSyncAt        │
└──────────────────────────────────────────┘
```

#### Balance Conflict Resolution Flow

```
┌──────────────┐
│  /balance    │
│  Command     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Telegram Bot                            │
│  1. Fetch local balance                  │
│  2. Fetch МойСклад balance               │
│  3. Compare with tolerance (0.01)        │
└──────┬───────────────────────────────────┘
       │
       │ Balances differ
       ▼
┌──────────────────────────────────────────┐
│  Integration Sync Service                │
│  1. Fetch last transaction timestamps    │
│  2. Compare timestamps                   │
│  3. Apply Last Write Wins                │
└──────┬───────────────────────────────────┘
       │
       ├─ МойСклад newer ──────────────────┐
       │                                    │
       │                                    ▼
       │                    ┌───────────────────────────┐
       │                    │  Update local balance     │
       │                    │  to match МойСклад        │
       │                    └───────────────────────────┘
       │
       └─ Local newer ─────────────────────┐
                                            │
                                            ▼
                            ┌───────────────────────────┐
                            │  Send adjustment          │
                            │  transaction to МойСклад  │
                            └───────────────────────────┘
```

