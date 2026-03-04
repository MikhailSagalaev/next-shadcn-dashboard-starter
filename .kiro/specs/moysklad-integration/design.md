# Design Document: МойСклад Loyalty API Integration

## Overview

This design document describes the technical architecture for implementing МойСклад Loyalty API endpoints in the SaaS Bonus System. The integration enables offline point-of-sale systems (cash registers and POS terminals running МойСклад) to interact with our bonus system in real-time during checkout operations.

### Key Objectives

1. **API Provider Role**: Implement HTTP endpoints that МойСклад calls (reverse integration model)
2. **Real-time Operations**: Process bonus calculations, balance checks, and transactions during checkout
3. **Multi-tenant Support**: Isolate integration configurations per project with unique authentication
4. **Security**: Authenticate all requests, validate data, and protect against unauthorized access
5. **Reliability**: Handle high request volumes with proper error handling and logging
6. **User Experience**: Provide UI for integration setup and monitoring

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    МойСклад (POS/Cash Register)             │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Cashier    │  │  Customer    │  │   Receipt    │      │
│  │  Interface   │  │  Lookup      │  │  Calculation │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          │ HTTP POST        │ HTTP GET         │ HTTP POST
          │ (Create Sale)    │ (Search User)    │ (Calculate)
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Bonus System - Loyalty API Endpoints           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication Middleware                            │  │
│  │  - Validate Auth Token                                │  │
│  │  - Check Integration Status                           │  │
│  │  - Rate Limiting                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Counterparty │  │   Balance    │  │   Discount   │      │
│  │  Endpoints   │  │  Endpoints   │  │  Calculation │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Transaction  │  │    Return    │  │   Logging    │      │
│  │  Endpoints   │  │  Endpoints   │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Workflow Overview

**Typical Checkout Flow:**

1. **Customer Identification**: Cashier enters phone number → МойСклад calls `/counterparty` (search)
2. **Balance Display**: МойСклад calls `/counterparty/detail` → Shows customer's bonus balance
3. **Discount Calculation**: Cashier adds items → МойСклад calls `/retaildemand/recalc` → Shows potential discount
4. **Verification** (if spending bonuses): МойСклад calls `/counterparty/verify` → Customer receives code via SMS/Telegram
5. **Verify Spending**: Cashier enters code → МойСклад calls `/retaildemand/verify` → Confirms bonus spending
6. **Finalize Sale**: Payment completed → МойСклад calls `/retaildemand` → Bonuses accrued/spent
7. **Return** (if needed): МойСклад calls `/retailsalesreturn` → Reverses bonus transaction

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/counterparty` | POST | Create new customer |
| `/counterparty` | GET | Search customer by phone/card |
| `/counterparty/detail` | POST | Get customer bonus balance |
| `/counterparty/verify` | POST | Request verification code |
| `/retaildemand/recalc` | POST | Calculate discounts (pre-checkout) |
| `/retaildemand/verify` | POST | Verify bonus spending with code |
| `/retaildemand` | POST | Finalize sale transaction |
| `/retailsalesreturn` | POST | Process return |
| `/giftcard` | GET | Search gift card (optional) |


## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Routes Layer                       │  │
│  │                                                            │  │
│  │  /api/moysklad-loyalty/[projectId]/                      │  │
│  │    ├── counterparty (POST, GET)                          │  │
│  │    ├── counterparty/detail (POST)                        │  │
│  │    ├── counterparty/verify (POST)                        │  │
│  │    ├── retaildemand (POST)                               │  │
│  │    ├── retaildemand/recalc (POST)                        │  │
│  │    ├── retaildemand/verify (POST)                        │  │
│  │    ├── retailsalesreturn (POST)                          │  │
│  │    └── giftcard (GET)                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Middleware Layer                         │  │
│  │                                                            │  │
│  │  ├── Authentication Middleware                           │  │
│  │  │   - Extract Auth Token from header                    │  │
│  │  │   - Validate against hashed token in DB               │  │
│  │  │   - Check integration active status                   │  │
│  │  │                                                         │  │
│  │  ├── Rate Limiting Middleware                            │  │
│  │  │   - 1000 requests/minute per project                  │  │
│  │  │   - Return 429 if exceeded                            │  │
│  │  │                                                         │  │
│  │  └── Request Validation Middleware                       │  │
│  │      - Validate request body schema                      │  │
│  │      - Sanitize input data                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Service Layer                           │  │
│  │                                                            │  │
│  │  ├── Loyalty Service                                     │  │
│  │  │   - Process loyalty operations                        │  │
│  │  │   - Calculate bonuses and discounts                   │  │
│  │  │   - Manage transactions                               │  │
│  │  │                                                         │  │
│  │  ├── User Service                                        │  │
│  │  │   - Find/create users                                 │  │
│  │  │   - Link МойСклад counterparty IDs                   │  │
│  │  │   - Normalize phone numbers                           │  │
│  │  │                                                         │  │
│  │  ├── Verification Service                                │  │
│  │  │   - Generate verification codes                       │  │
│  │  │   - Send via SMS/Telegram                             │  │
│  │  │   - Validate codes                                    │  │
│  │  │                                                         │  │
│  │  └── Logging Service                                     │  │
│  │      - Log all API requests/responses                    │  │
│  │      - Track performance metrics                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Data Access Layer                       │  │
│  │                                                            │  │
│  │  ├── Prisma ORM                                          │  │
│  │  ├── Database Connection Pool                            │  │
│  │  └── Transaction Management                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   PostgreSQL DB      │
                    │                      │
                    │  - Users             │
                    │  - Bonuses           │
                    │  - Transactions      │
                    │  - Projects          │
                    │  - Integrations      │
                    │  - API Logs          │
                    └──────────────────────┘
```


### Component Directory Structure

```
src/
├── app/
│   ├── api/
│   │   └── moysklad-loyalty/
│   │       └── [projectId]/
│   │           ├── counterparty/
│   │           │   ├── route.ts              # POST/GET counterparty
│   │           │   ├── detail/
│   │           │   │   └── route.ts          # POST balance
│   │           │   └── verify/
│   │           │       └── route.ts          # POST verification code
│   │           ├── retaildemand/
│   │           │   ├── route.ts              # POST create sale
│   │           │   ├── recalc/
│   │           │   │   └── route.ts          # POST calculate discounts
│   │           │   └── verify/
│   │           │       └── route.ts          # POST verify spending
│   │           ├── retailsalesreturn/
│   │           │   └── route.ts              # POST return
│   │           └── giftcard/
│   │               └── route.ts              # GET gift card
│   └── dashboard/
│       └── projects/
│           └── [id]/
│               └── integrations/
│                   └── moysklad/
│                       ├── page.tsx          # Settings UI
│                       └── components/
│                           ├── integration-form.tsx
│                           ├── api-logs-table.tsx
│                           ├── stats-cards.tsx
│                           └── test-connection.tsx
├── lib/
│   ├── moysklad/
│   │   ├── loyalty-service.ts               # Core loyalty logic
│   │   ├── auth-middleware.ts               # Authentication
│   │   ├── rate-limiter.ts                  # Rate limiting
│   │   ├── validator.ts                     # Request validation
│   │   ├── types.ts                         # TypeScript types
│   │   └── constants.ts                     # Constants
│   ├── services/
│   │   ├── user-service.ts                  # User operations
│   │   ├── bonus-service.ts                 # Bonus operations
│   │   ├── transaction-service.ts           # Transaction operations
│   │   └── verification-service.ts          # Verification codes
│   └── utils/
│       ├── phone-normalizer.ts              # Phone number utils
│       └── encryption.ts                    # Token encryption
└── prisma/
    └── schema.prisma                        # Database schema
```


## Components and Interfaces

### 1. Authentication Middleware

**Location**: `src/lib/moysklad/auth-middleware.ts`

**Purpose**: Authenticate and authorize all incoming requests from МойСклад.

**Interface**:

```typescript
interface AuthMiddlewareConfig {
  projectId: string;
  authToken: string; // From request header
}

interface AuthResult {
  success: boolean;
  integration?: MoySkladIntegration;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
}

async function authenticateRequest(
  projectId: string,
  authToken: string
): Promise<AuthResult>;

async function validateIntegrationStatus(
  integration: MoySkladIntegration
): Promise<boolean>;
```

**Implementation Details**:

```typescript
export async function authenticateRequest(
  projectId: string,
  authToken: string
): Promise<AuthResult> {
  // 1. Find integration by projectId
  const integration = await db.moySkladIntegration.findUnique({
    where: { projectId },
    include: { project: true }
  });

  if (!integration) {
    return {
      success: false,
      error: {
        code: 'INTEGRATION_NOT_FOUND',
        message: 'МойСклад integration not configured for this project',
        statusCode: 404
      }
    };
  }

  // 2. Check if integration is active
  if (!integration.isActive) {
    return {
      success: false,
      error: {
        code: 'INTEGRATION_DISABLED',
        message: 'МойСклад integration is disabled',
        statusCode: 503
      }
    };
  }

  // 3. Validate auth token (compare with hashed value)
  const isValid = await bcrypt.compare(authToken, integration.authTokenHash);

  if (!isValid) {
    return {
      success: false,
      error: {
        code: 'INVALID_AUTH_TOKEN',
        message: 'Invalid authentication token',
        statusCode: 401
      }
    };
  }

  // 4. Update last request timestamp
  await db.moySkladIntegration.update({
    where: { id: integration.id },
    data: { lastRequestAt: new Date() }
  });

  return {
    success: true,
    integration
  };
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing auth token
- `404 Not Found`: Integration not configured
- `503 Service Unavailable`: Integration disabled


### 2. Rate Limiting Middleware

**Location**: `src/lib/moysklad/rate-limiter.ts`

**Purpose**: Prevent abuse and ensure fair resource allocation across projects.

**Interface**:

```typescript
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

async function checkRateLimit(
  projectId: string,
  config?: RateLimitConfig
): Promise<RateLimitResult>;
```

**Implementation**:

```typescript
// Default: 1000 requests per minute per project
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000,      // 1 minute
  maxRequests: 1000
};

export async function checkRateLimit(
  projectId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const key = `ratelimit:moysklad:${projectId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Use Redis or in-memory store
  const requests = await redis.zcount(key, windowStart, now);

  if (requests >= config.maxRequests) {
    const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetAt = new Date(
      parseInt(oldestRequest[1]) + config.windowMs
    );

    return {
      allowed: false,
      remaining: 0,
      resetAt
    };
  }

  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, Math.ceil(config.windowMs / 1000));

  return {
    allowed: true,
    remaining: config.maxRequests - requests - 1,
    resetAt: new Date(now + config.windowMs)
  };
}
```

**Response Headers**:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when limit resets

**Error Response** (429 Too Many Requests):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Превышен лимит запросов. Попробуйте позже.",
    "retryAfter": 45
  }
}
```


### 3. Request Validator

**Location**: `src/lib/moysklad/validator.ts`

**Purpose**: Validate incoming request data against МойСклад Loyalty API schema.

**Interface**:

```typescript
import { z } from 'zod';

// Counterparty schemas
const CreateCounterpartySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  cardNumber: z.string().optional()
});

const SearchCounterpartySchema = z.object({
  search: z.string().min(1),
  retailStoreId: z.string().optional()
});

const CounterpartyDetailSchema = z.object({
  meta: z.object({
    id: z.string().uuid()
  })
});

// Retail demand schemas
const PositionSchema = z.object({
  assortment: z.object({
    meta: z.object({
      href: z.string(),
      type: z.string()
    })
  }),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().optional()
});

const RecalcRequestSchema = z.object({
  agent: z.object({
    meta: z.object({
      id: z.string().uuid()
    })
  }),
  positions: z.array(PositionSchema),
  transactionType: z.enum(['EARNING', 'SPENDING'])
});

const VerifyRequestSchema = z.object({
  agent: z.object({
    meta: z.object({
      id: z.string().uuid()
    })
  }),
  bonusValue: z.number().positive(),
  verificationCode: z.string().length(6)
});

const CreateSaleSchema = z.object({
  agent: z.object({
    meta: z.object({
      id: z.string().uuid()
    })
  }),
  positions: z.array(PositionSchema),
  sum: z.number().positive(),
  transactionType: z.enum(['EARNING', 'SPENDING']),
  bonusValue: z.number().nonnegative().optional(),
  moment: z.string().datetime().optional()
});

const CreateReturnSchema = z.object({
  agent: z.object({
    meta: z.object({
      id: z.string().uuid()
    })
  }),
  demand: z.object({
    meta: z.object({
      href: z.string()
    })
  }),
  sum: z.number().positive(),
  moment: z.string().datetime().optional()
});

// Validation functions
export function validateCreateCounterparty(data: unknown) {
  return CreateCounterpartySchema.safeParse(data);
}

export function validateSearchCounterparty(data: unknown) {
  return SearchCounterpartySchema.safeParse(data);
}

export function validateCounterpartyDetail(data: unknown) {
  return CounterpartyDetailSchema.safeParse(data);
}

export function validateRecalcRequest(data: unknown) {
  return RecalcRequestSchema.safeParse(data);
}

export function validateVerifyRequest(data: unknown) {
  return VerifyRequestSchema.safeParse(data);
}

export function validateCreateSale(data: unknown) {
  return CreateSaleSchema.safeParse(data);
}

export function validateCreateReturn(data: unknown) {
  return CreateReturnSchema.safeParse(data);
}
```

**Error Response Format** (400 Bad Request):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации данных запроса",
    "details": [
      {
        "field": "agent.meta.id",
        "message": "Expected string, received number"
      },
      {
        "field": "positions",
        "message": "Array must contain at least 1 element(s)"
      }
    ]
  }
}
```


### 4. Loyalty Service

**Location**: `src/lib/moysklad/loyalty-service.ts`

**Purpose**: Core business logic for bonus calculations and transaction management.

**Interface**:

```typescript
interface LoyaltyServiceConfig {
  integration: MoySkladIntegration;
  project: Project;
}

class LoyaltyService {
  constructor(config: LoyaltyServiceConfig);

  // Counterparty operations
  async createCounterparty(data: CreateCounterpartyData): Promise<CounterpartyResponse>;
  async searchCounterparty(search: string): Promise<CounterpartySearchResponse>;
  async getCounterpartyBalance(counterpartyId: string): Promise<BalanceResponse>;

  // Verification
  async requestVerificationCode(counterpartyId: string): Promise<VerificationResponse>;
  async verifyCode(counterpartyId: string, code: string): Promise<boolean>;

  // Discount calculation
  async calculateDiscounts(request: RecalcRequest): Promise<RecalcResponse>;

  // Transaction operations
  async createSale(request: CreateSaleRequest): Promise<SaleResponse>;
  async createReturn(request: CreateReturnRequest): Promise<ReturnResponse>;

  // Bonus calculation helpers
  calculateEarnedBonuses(amount: number, spentBonuses: number): number;
  calculateMaxSpendableBonuses(totalAmount: number, availableBalance: number): number;
}
```

**Key Methods Implementation**:

```typescript
export class LoyaltyService {
  private integration: MoySkladIntegration;
  private project: Project;

  constructor(config: LoyaltyServiceConfig) {
    this.integration = config.integration;
    this.project = config.project;
  }

  /**
   * Calculate earned bonuses based on project settings and BonusBehavior
   * 
   * BonusBehavior logic:
   * - SPEND_AND_EARN: If customer used bonuses, calculate on (total - spent)
   * - SPEND_ONLY: If customer used bonuses, do NOT accrue new bonuses
   * - EARN_ONLY: Always calculate on full amount (spending not allowed)
   */
  calculateEarnedBonuses(
    totalAmount: number,
    spentBonuses: number = 0
  ): number {
    const { bonusPercentage, bonusBehavior } = this.project;

    // EARN_ONLY: Always calculate on full amount
    if (bonusBehavior === 'EARN_ONLY') {
      return Math.round((totalAmount * bonusPercentage / 100) * 100) / 100;
    }

    // If customer didn't use bonuses, calculate on full amount
    if (spentBonuses === 0) {
      return Math.round((totalAmount * bonusPercentage / 100) * 100) / 100;
    }

    // Customer used bonuses
    if (bonusBehavior === 'SPEND_AND_EARN') {
      // Calculate on remaining amount (total - spent bonuses)
      const remainingAmount = totalAmount - spentBonuses;
      return Math.round((remainingAmount * bonusPercentage / 100) * 100) / 100;
    }

    if (bonusBehavior === 'SPEND_ONLY') {
      // Do NOT accrue new bonuses
      return 0;
    }

    return 0;
  }

  /**
   * Calculate maximum bonuses that can be spent
   * Based on project's maxBonusSpend percentage
   */
  calculateMaxSpendableBonuses(
    totalAmount: number,
    availableBalance: number
  ): number {
    const { maxBonusSpend } = this.project;

    // Calculate maximum allowed by project settings
    const maxAllowed = Math.round((totalAmount * maxBonusSpend / 100) * 100) / 100;

    // Return minimum of available balance and max allowed
    return Math.min(availableBalance, maxAllowed);
  }

  /**
   * Create new counterparty (customer)
   * Automatically applies welcome bonus if configured
   */
  async createCounterparty(
    data: CreateCounterpartyData
  ): Promise<CounterpartyResponse> {
    // Normalize phone number to E.164 format
    const normalizedPhone = data.phone 
      ? normalizePhoneNumber(data.phone) 
      : null;

    // Check if user already exists
    if (normalizedPhone) {
      const existingUser = await db.user.findFirst({
        where: {
          projectId: this.project.id,
          phone: normalizedPhone
        }
      });

      if (existingUser) {
        throw new ConflictError('User with this phone already exists');
      }
    }

    // Create user (welcome bonus applied automatically in UserService)
    const user = await userService.createUser({
      projectId: this.project.id,
      name: data.name,
      phone: normalizedPhone,
      email: data.email,
      cardNumber: data.cardNumber,
      source: 'MOYSKLAD'
    });

    // Generate МойСклад counterparty ID
    const counterpartyId = generateCounterpartyId();

    // Update user with counterparty ID
    await db.user.update({
      where: { id: user.id },
      data: { moySkladCounterpartyId: counterpartyId }
    });

    // Get current balance (including welcome bonus)
    const balance = await bonusService.getAvailableBalance(user.id);

    return {
      id: counterpartyId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      cardNumber: user.cardNumber,
      bonusBalance: balance
    };
  }
}
```


### 5. Verification Service

**Location**: `src/lib/services/verification-service.ts`

**Purpose**: Generate and validate verification codes for bonus spending operations.

**Interface**:

```typescript
interface VerificationCode {
  code: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

class VerificationService {
  // Generate 6-digit verification code
  generateCode(): string;

  // Store code with expiry (5 minutes)
  async storeCode(userId: string, code: string): Promise<void>;

  // Send code via SMS or Telegram
  async sendCode(userId: string, code: string): Promise<void>;

  // Validate code
  async validateCode(userId: string, code: string): Promise<boolean>;

  // Mark code as used
  async markCodeUsed(userId: string, code: string): Promise<void>;

  // Check rate limit (3 requests per 10 minutes)
  async checkRateLimit(userId: string): Promise<boolean>;
}
```

**Implementation**:

```typescript
export class VerificationService {
  generateCode(): string {
    // Generate 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async storeCode(userId: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await redis.setex(
      `verification:${userId}`,
      300, // 5 minutes in seconds
      JSON.stringify({ code, expiresAt, used: false })
    );
  }

  async sendCode(userId: string, code: string): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Try Telegram first if bot is linked
    if (user.telegramChatId) {
      await telegramBot.sendMessage(
        user.telegramChatId,
        `🔐 Код подтверждения для списания бонусов: ${code}\n\n` +
        `Код действителен 5 минут.`
      );
      return;
    }

    // Fallback to SMS if phone available
    if (user.phone) {
      await smsService.send(
        user.phone,
        `Код подтверждения: ${code}. Действителен 5 минут.`
      );
      return;
    }

    throw new BadRequestError(
      'Cannot send verification code: no Telegram or phone number'
    );
  }

  async validateCode(userId: string, code: string): Promise<boolean> {
    const stored = await redis.get(`verification:${userId}`);

    if (!stored) {
      return false; // Code not found or expired
    }

    const data = JSON.parse(stored);

    if (data.used) {
      return false; // Code already used
    }

    if (new Date() > new Date(data.expiresAt)) {
      return false; // Code expired
    }

    return data.code === code;
  }

  async markCodeUsed(userId: string, code: string): Promise<void> {
    const stored = await redis.get(`verification:${userId}`);

    if (stored) {
      const data = JSON.parse(stored);
      data.used = true;
      await redis.setex(
        `verification:${userId}`,
        300,
        JSON.stringify(data)
      );
    }
  }

  async checkRateLimit(userId: string): Promise<boolean> {
    const key = `verification:ratelimit:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in window, set expiry
      await redis.expire(key, 600); // 10 minutes
    }

    return count <= 3; // Max 3 requests per 10 minutes
  }
}
```


### 6. API Logging Service

**Location**: `src/lib/moysklad/logging-service.ts`

**Purpose**: Log all API requests and responses for monitoring and debugging.

**Interface**:

```typescript
interface ApiLogEntry {
  integrationId: string;
  endpoint: string;
  method: string;
  requestBody: any;
  responseStatus: number;
  responseBody: any;
  processingTimeMs: number;
  errorMessage?: string;
  ipAddress?: string;
}

class ApiLoggingService {
  async logRequest(entry: ApiLogEntry): Promise<void>;
  async getLogsByIntegration(
    integrationId: string,
    filters?: LogFilters
  ): Promise<ApiLog[]>;
  async getStatistics(integrationId: string): Promise<ApiStatistics>;
  async exportLogs(integrationId: string, format: 'csv' | 'json'): Promise<string>;
}

interface LogFilters {
  endpoint?: string;
  status?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

interface ApiStatistics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastRequestAt: Date;
  requestsByEndpoint: Record<string, number>;
  errorsByCode: Record<string, number>;
}
```

**Implementation**:

```typescript
export class ApiLoggingService {
  async logRequest(entry: ApiLogEntry): Promise<void> {
    // Sanitize sensitive data
    const sanitizedRequest = this.sanitizeData(entry.requestBody);
    const sanitizedResponse = this.sanitizeData(entry.responseBody);

    await db.moySkladApiLog.create({
      data: {
        integrationId: entry.integrationId,
        endpoint: entry.endpoint,
        method: entry.method,
        requestBody: sanitizedRequest,
        responseStatus: entry.responseStatus,
        responseBody: sanitizedResponse,
        processingTimeMs: entry.processingTimeMs,
        errorMessage: entry.errorMessage,
        ipAddress: entry.ipAddress
      }
    });
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    const sanitizeObject = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  async getStatistics(integrationId: string): Promise<ApiStatistics> {
    const logs = await db.moySkladApiLog.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' }
    });

    const totalRequests = logs.length;
    const successCount = logs.filter(log => log.responseStatus < 400).length;
    const successRate = totalRequests > 0 
      ? (successCount / totalRequests) * 100 
      : 0;

    const avgResponseTime = totalRequests > 0
      ? logs.reduce((sum, log) => sum + log.processingTimeMs, 0) / totalRequests
      : 0;

    const lastRequestAt = logs[0]?.createdAt || new Date();

    const requestsByEndpoint = logs.reduce((acc, log) => {
      acc[log.endpoint] = (acc[log.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByCode = logs
      .filter(log => log.responseStatus >= 400)
      .reduce((acc, log) => {
        const code = log.responseStatus.toString();
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalRequests,
      successRate,
      averageResponseTime: Math.round(avgResponseTime),
      lastRequestAt,
      requestsByEndpoint,
      errorsByCode
    };
  }
}
```


### 7. Phone Number Normalizer

**Location**: `src/lib/utils/phone-normalizer.ts`

**Purpose**: Normalize phone numbers to E.164 format for consistent user identification.

**Interface**:

```typescript
function normalizePhoneNumber(phone: string): string | null;
function isValidPhoneNumber(phone: string): boolean;
```

**Implementation**:

```typescript
/**
 * Normalize phone number to E.164 format
 * Supports formats:
 * - +7XXXXXXXXXX
 * - 8XXXXXXXXXX
 * - 7XXXXXXXXXX
 * - XXXXXXXXXX (assumes Russia +7)
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.startsWith('8') && digits.length === 11) {
    // 8XXXXXXXXXX -> +7XXXXXXXXXX
    return '+7' + digits.slice(1);
  }

  if (digits.startsWith('7') && digits.length === 11) {
    // 7XXXXXXXXXX -> +7XXXXXXXXXX
    return '+' + digits;
  }

  if (digits.length === 10) {
    // XXXXXXXXXX -> +7XXXXXXXXXX (assume Russia)
    return '+7' + digits;
  }

  if (digits.startsWith('7') && digits.length === 10) {
    // Edge case: 7XXXXXXXXX (9 digits after 7)
    return '+7' + digits.slice(1);
  }

  // Already in E.164 format or invalid
  if (phone.startsWith('+') && digits.length >= 11) {
    return phone;
  }

  return null; // Invalid format
}

export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;

  // Check E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{10,14}$/;
  return e164Regex.test(normalized);
}
```

**Examples**:
- `+79991234567` → `+79991234567`
- `89991234567` → `+79991234567`
- `79991234567` → `+79991234567`
- `9991234567` → `+79991234567`
- `8 (999) 123-45-67` → `+79991234567`


## Data Models

### Database Schema

```prisma
// МойСклад Integration Configuration
model MoySkladIntegration {
  id                String   @id @default(cuid())
  projectId         String   @unique
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Authentication
  authTokenHash     String   @unique  // bcrypt hashed token
  baseUrl           String   // https://gupil.ru/api/moysklad-loyalty/[projectId]
  
  // Bonus calculation settings
  bonusPercentage   Float    @default(5)     // % of purchase to accrue as bonuses
  maxBonusSpend     Float    @default(50)    // Max % of purchase payable with bonuses
  
  // Status
  isActive          Boolean  @default(false)
  lastRequestAt     DateTime?
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  apiLogs           MoySkladApiLog[]
  
  @@index([projectId])
  @@index([authTokenHash])
}

// API Request/Response Log
model MoySkladApiLog {
  id                String   @id @default(cuid())
  integrationId     String
  integration       MoySkladIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  
  // Request details
  endpoint          String   // e.g., "/counterparty", "/retaildemand/recalc"
  method            String   // GET, POST
  requestBody       Json?
  ipAddress         String?
  
  // Response details
  responseStatus    Int      // HTTP status code
  responseBody      Json?
  processingTimeMs  Int      // Processing time in milliseconds
  
  // Error tracking
  errorMessage      String?
  
  // Timestamp
  createdAt         DateTime @default(now())
  
  @@index([integrationId, createdAt])
  @@index([endpoint])
  @@index([responseStatus])
}

// User model extension
model User {
  id                      String   @id @default(cuid())
  projectId               String
  project                 Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Basic info
  name                    String
  phone                   String?
  email                   String?
  cardNumber              String?
  
  // МойСклад integration
  moySkladCounterpartyId  String?  @unique  // UUID generated for МойСклад
  
  // Telegram integration
  telegramChatId          String?  @unique
  telegramUsername        String?
  
  // Timestamps
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  // Relations
  bonuses                 Bonus[]
  transactions            Transaction[]
  
  @@unique([projectId, phone])
  @@index([projectId])
  @@index([moySkladCounterpartyId])
  @@index([phone])
}

// Bonus record
model Bonus {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId         String
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Bonus details
  amount            Float
  type              BonusType
  source            BonusSource
  expiresAt         DateTime?
  
  // МойСклад reference
  moySkladSaleId    String?  // Reference to original МойСклад sale
  
  // Status
  isActive          Boolean  @default(true)
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([projectId])
  @@index([expiresAt])
  @@index([moySkladSaleId])
}

enum BonusType {
  WELCOME
  PURCHASE
  REFERRAL
  MANUAL
  MOYSKLAD  // New type for МойСклад transactions
}

enum BonusSource {
  TILDA
  MANUAL
  REFERRAL
  TELEGRAM
  MOYSKLAD  // New source for МойСклад integration
}

// Transaction record
model Transaction {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId         String
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Transaction details
  type              TransactionType
  amount            Float
  description       String
  
  // МойСклад reference
  moySkladSaleId    String?  // Reference to МойСклад sale/return
  moySkladReturnId  String?  // Reference to original sale for returns
  
  // Timestamps
  createdAt         DateTime @default(now())
  
  @@index([userId])
  @@index([projectId])
  @@index([type])
  @@index([moySkladSaleId])
}

enum TransactionType {
  EARN
  SPEND
  EXPIRE
  RETURN
  MANUAL_ADJUST
}

// Project model extension
model Project {
  id                String   @id @default(cuid())
  ownerId           String
  
  // Basic info
  name              String
  currency          String   @default("₽")
  
  // Bonus settings
  bonusPercentage   Float    @default(5)
  maxBonusSpend     Float    @default(50)
  bonusBehavior     BonusBehavior @default(SPEND_AND_EARN)
  bonusExpiryDays   Int?     // null = never expire
  
  // Welcome bonus
  welcomeBonus      Float    @default(0)
  welcomeRewardType WelcomeRewardType @default(BONUS)
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  users             User[]
  bonuses           Bonus[]
  transactions      Transaction[]
  moySkladIntegration MoySkladIntegration?
  
  @@index([ownerId])
}

enum BonusBehavior {
  SPEND_AND_EARN  // Can spend and earn bonuses
  SPEND_ONLY      // Can only spend, no earning when spending
  EARN_ONLY       // Can only earn, cannot spend
}

enum WelcomeRewardType {
  BONUS
  DISCOUNT
  NONE
}
```


### TypeScript Type Definitions

**Location**: `src/lib/moysklad/types.ts`

```typescript
// Request types
export interface CreateCounterpartyRequest {
  name: string;
  phone?: string;
  email?: string;
  cardNumber?: string;
}

export interface SearchCounterpartyRequest {
  search: string;
  retailStoreId?: string;
}

export interface CounterpartyDetailRequest {
  meta: {
    id: string; // Counterparty UUID
  };
}

export interface VerificationRequest {
  agent: {
    meta: {
      id: string; // Counterparty UUID
    };
  };
  operationType: 'SPENDING';
}

export interface Position {
  assortment: {
    meta: {
      href: string;
      type: string;
    };
  };
  quantity: number;
  price: number;
  discount?: number;
}

export interface RecalcRequest {
  agent: {
    meta: {
      id: string; // Counterparty UUID
    };
  };
  positions: Position[];
  transactionType: 'EARNING' | 'SPENDING';
}

export interface VerifySpendingRequest {
  agent: {
    meta: {
      id: string;
    };
  };
  bonusValue: number;
  verificationCode: string;
}

export interface CreateSaleRequest {
  agent: {
    meta: {
      id: string;
    };
  };
  positions: Position[];
  sum: number;
  transactionType: 'EARNING' | 'SPENDING';
  bonusValue?: number;
  moment?: string; // ISO 8601 datetime
}

export interface CreateReturnRequest {
  agent: {
    meta: {
      id: string;
    };
  };
  demand: {
    meta: {
      href: string; // Reference to original sale
    };
  };
  sum: number;
  moment?: string;
}

// Response types
export interface CounterpartyResponse {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  cardNumber?: string;
  bonusBalance?: number;
}

export interface CounterpartySearchResponse {
  rows: CounterpartyResponse[];
}

export interface BalanceResponse {
  bonusProgram: {
    agentBonusBalance: number;
  };
}

export interface VerificationResponse {
  message: string;
  expiresIn: number; // seconds
}

export interface RecalcResponse {
  positions: Array<{
    assortment: {
      meta: {
        href: string;
        type: string;
      };
    };
    quantity: number;
    price: number;
    discount: number;
  }>;
  bonusProgram: {
    earnedBonus?: number;
    spentBonus?: number;
    maxSpendableBonus?: number;
  };
}

export interface SaleResponse {
  id: string;
  moment: string;
  sum: number;
  bonusProgram: {
    earnedBonus?: number;
    spentBonus?: number;
  };
}

export interface ReturnResponse {
  id: string;
  moment: string;
  sum: number;
  bonusProgram: {
    returnedBonus: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Internal types
export interface CounterpartyData {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cardNumber: string | null;
  balance: number;
}
```


### Data Flow Diagrams

#### 1. Customer Identification Flow

```
┌──────────────┐
│  Cashier     │
│  enters      │
│  phone       │
└──────┬───────┘
       │
       │ GET /api/moysklad-loyalty/[projectId]/counterparty?search=+79991234567
       │ Header: Lognex-Discount-API-Auth-Token: <token>
       ▼
┌──────────────────────────────────────────┐
│  Authentication Middleware               │
│  1. Extract projectId from URL           │
│  2. Extract auth token from header       │
│  3. Validate token against DB            │
│  4. Check integration is active          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Rate Limiting Middleware                │
│  1. Check request count for project      │
│  2. Allow if under limit (1000/min)      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Loyalty Service                         │
│  1. Normalize phone to E.164             │
│  2. Search user by phone in project      │
│  3. Return user with counterparty ID     │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response                                │
│  {                                       │
│    "rows": [{                            │
│      "id": "uuid",                       │
│      "name": "Иван Иванов",              │
│      "phone": "+79991234567"             │
│    }]                                    │
│  }                                       │
└──────────────────────────────────────────┘
```

#### 2. Balance Check Flow

```
┌──────────────┐
│  МойСклад    │
│  requests    │
│  balance     │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/counterparty/detail
       │ Body: { "meta": { "id": "counterparty-uuid" } }
       ▼
┌──────────────────────────────────────────┐
│  Authentication + Rate Limiting          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Loyalty Service                         │
│  1. Find user by counterpartyId          │
│  2. Calculate available balance:         │
│     - Sum all active bonuses             │
│     - Exclude expired bonuses            │
│     - Exclude reserved bonuses           │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response (< 500ms)                      │
│  {                                       │
│    "bonusProgram": {                     │
│      "agentBonusBalance": 1250.50        │
│    }                                     │
│  }                                       │
└──────────────────────────────────────────┘
```


#### 3. Discount Calculation Flow (Recalc)

```
┌──────────────┐
│  Cashier     │
│  adds items  │
│  to cart     │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/retaildemand/recalc
       │ Body: {
       │   "agent": { "meta": { "id": "uuid" } },
       │   "positions": [...],
       │   "transactionType": "SPENDING"
       │ }
       ▼
┌──────────────────────────────────────────┐
│  Loyalty Service                         │
│  1. Get user by counterpartyId           │
│  2. Get available balance                │
│  3. Calculate max spendable:             │
│     maxSpend = min(                      │
│       balance,                           │
│       total * maxBonusSpend%             │
│     )                                    │
│  4. Calculate discount per position      │
│     proportionally                       │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response (< 1s)                         │
│  {                                       │
│    "positions": [                        │
│      {                                   │
│        "assortment": {...},              │
│        "quantity": 2,                    │
│        "price": 1000,                    │
│        "discount": 100  // 10% of item   │
│      }                                   │
│    ],                                    │
│    "bonusProgram": {                     │
│      "maxSpendableBonus": 500,           │
│      "spentBonus": 200                   │
│    }                                     │
│  }                                       │
└──────────────────────────────────────────┘
```

#### 4. Sale Finalization Flow (with BonusBehavior)

```
┌──────────────┐
│  Payment     │
│  completed   │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/retaildemand
       │ Body: {
       │   "agent": { "meta": { "id": "uuid" } },
       │   "sum": 5000,
       │   "transactionType": "EARNING",
       │   "bonusValue": 1000  // Customer spent 1000 bonuses
       │ }
       ▼
┌──────────────────────────────────────────┐
│  Loyalty Service                         │
│  1. Get project settings                 │
│  2. Check BonusBehavior mode             │
│  3. Calculate earned bonuses:            │
│                                          │
│  IF bonusBehavior == SPEND_AND_EARN:     │
│    earnedAmount = sum - bonusValue       │
│    earned = earnedAmount * percentage    │
│    // 5000 - 1000 = 4000                │
│    // 4000 * 5% = 200 bonuses           │
│                                          │
│  IF bonusBehavior == SPEND_ONLY:         │
│    IF bonusValue > 0:                    │
│      earned = 0  // No bonuses           │
│    ELSE:                                 │
│      earned = sum * percentage           │
│                                          │
│  IF bonusBehavior == EARN_ONLY:          │
│    earned = sum * percentage             │
│    // bonusValue should be 0             │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Database Transaction (Atomic)           │
│  1. Create Bonus record:                 │
│     - amount: 200                        │
│     - type: MOYSKLAD                     │
│     - expiresAt: now + expiryDays        │
│     - moySkladSaleId: generated          │
│  2. Create Transaction record:           │
│     - type: EARN                         │
│     - amount: 200                        │
│     - moySkladSaleId: same               │
│  3. Commit or rollback                   │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response (< 2s)                         │
│  {                                       │
│    "id": "sale-uuid",                    │
│    "moment": "2024-01-20T10:30:00Z",     │
│    "sum": 5000,                          │
│    "bonusProgram": {                     │
│      "earnedBonus": 200                  │
│    }                                     │
│  }                                       │
└──────────────────────────────────────────┘
```


#### 5. Verification Code Flow

```
┌──────────────┐
│  Customer    │
│  wants to    │
│  spend bonus │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/counterparty/verify
       │ Body: {
       │   "agent": { "meta": { "id": "uuid" } },
       │   "operationType": "SPENDING"
       │ }
       ▼
┌──────────────────────────────────────────┐
│  Verification Service                    │
│  1. Check rate limit (3 per 10 min)     │
│  2. Generate 6-digit code                │
│  3. Store in Redis (5 min expiry)       │
│  4. Get user's contact info              │
└──────┬───────────────────────────────────┘
       │
       ├─ Has Telegram ────────────────────┐
       │                                    │
       │                                    ▼
       │                    ┌───────────────────────────┐
       │                    │  Send via Telegram Bot    │
       │                    │  "🔐 Код: 123456"         │
       │                    │  "Действителен 5 минут"   │
       │                    └───────────────────────────┘
       │
       └─ Has Phone ───────────────────────┐
                                            │
                                            ▼
                            ┌───────────────────────────┐
                            │  Send via SMS             │
                            │  "Код: 123456"            │
                            └───────────────────────────┘
       
       ▼
┌──────────────────────────────────────────┐
│  Response                                │
│  {                                       │
│    "message": "Код отправлен",           │
│    "expiresIn": 300                      │
│  }                                       │
└──────────────────────────────────────────┘
       
       │
       │ Customer enters code in POS
       │
       ▼
┌──────────────┐
│  Cashier     │
│  enters code │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/retaildemand/verify
       │ Body: {
       │   "agent": { "meta": { "id": "uuid" } },
       │   "bonusValue": 500,
       │   "verificationCode": "123456"
       │ }
       ▼
┌──────────────────────────────────────────┐
│  Verification Service                    │
│  1. Get stored code from Redis           │
│  2. Check if expired                     │
│  3. Check if already used                │
│  4. Compare codes                        │
│  5. Check user has sufficient balance    │
│  6. Mark code as used                    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response                                │
│  {                                       │
│    "verified": true                      │
│  }                                       │
└──────────────────────────────────────────┘
```


#### 6. Return Processing Flow

```
┌──────────────┐
│  Customer    │
│  returns     │
│  product     │
└──────┬───────┘
       │
       │ POST /api/moysklad-loyalty/[projectId]/retailsalesreturn
       │ Body: {
       │   "agent": { "meta": { "id": "uuid" } },
       │   "demand": { "meta": { "href": "original-sale-url" } },
       │   "sum": 2000
       │ }
       ▼
┌──────────────────────────────────────────┐
│  Loyalty Service                         │
│  1. Extract sale ID from demand.meta.href│
│  2. Find original transaction            │
│  3. Determine transaction type           │
└──────┬───────────────────────────────────┘
       │
       ├─ Original was EARN ───────────────┐
       │                                    │
       │                                    ▼
       │                    ┌───────────────────────────┐
       │                    │  Deduct bonuses:          │
       │                    │  1. Find bonus by saleId  │
       │                    │  2. Reduce amount or      │
       │                    │     mark as expired       │
       │                    │  3. Create RETURN txn     │
       │                    └───────────────────────────┘
       │
       └─ Original was SPEND ──────────────┐
                                            │
                                            ▼
                            ┌───────────────────────────┐
                            │  Return bonuses:          │
                            │  1. Create new Bonus      │
                            │  2. Amount = spent amount │
                            │  3. Create RETURN txn     │
                            └───────────────────────────┘
       
       ▼
┌──────────────────────────────────────────┐
│  Database Transaction (Atomic)           │
│  1. Update/Create Bonus records          │
│  2. Create Transaction record:           │
│     - type: RETURN                       │
│     - moySkladReturnId: original sale ID │
│  3. Commit or rollback                   │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response                                │
│  {                                       │
│    "id": "return-uuid",                  │
│    "moment": "2024-01-20T15:00:00Z",     │
│    "sum": 2000,                          │
│    "bonusProgram": {                     │
│      "returnedBonus": 100                │
│    }                                     │
│  }                                       │
└──────────────────────────────────────────┘
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Token Validation

*For any* request to the Loyalty API, if the request includes a valid auth token in the `Lognex-Discount-API-Auth-Token` header and the integration is active, then the request should be authenticated successfully; otherwise, it should return 401 Unauthorized (invalid token) or 503 Service Unavailable (integration disabled).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: Auth Token Hashing

*For any* generated auth token, the stored value in the database should be a bcrypt hash, not the plaintext token, and comparing the plaintext token with the hash should succeed.

**Validates: Requirements 1.6**

### Property 3: Auth Token Uniqueness

*For any* two different projects, their generated auth tokens should be unique, and regenerating a token for a project should produce a different token than the previous one.

**Validates: Requirements 1.2, 1.5**

### Property 4: Base URL Format

*For any* project ID, the generated base URL should follow the format `https://gupil.ru/api/moysklad-loyalty/[projectId]` where [projectId] is the actual project identifier.

**Validates: Requirements 1.3**

### Property 5: Rate Limiting Enforcement

*For any* project, when the number of requests exceeds 1000 in a 1-minute window, the 1001st request should return HTTP 429 Too Many Requests with appropriate retry-after information.

**Validates: Requirements 2.7, 2.8**

### Property 6: Sensitive Data Sanitization

*For any* API log entry or error response, sensitive fields (tokens, passwords, secrets) should be redacted or excluded from the logged/returned data.

**Validates: Requirements 2.10, 12.3**

### Property 7: Phone Number Normalization Round-Trip

*For any* valid phone number in formats (+7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX, XXXXXXXXXX), normalizing it to E.164 format should produce a consistent result, and the normalized format should be used for all user lookups and storage.

**Validates: Requirements 3.4, 4.4, 14.2, 14.7, 14.8**

### Property 8: User Creation with Welcome Bonus

*For any* new user created through the counterparty endpoint, if the project has welcomeRewardType === 'BONUS' and welcomeBonus > 0, then a welcome bonus should be automatically created with type WELCOME and the user's initial balance should equal the welcome bonus amount.

**Validates: Requirements 3.9**

### Property 9: Counterparty ID Uniqueness

*For any* set of users created through the Loyalty API, all generated МойСклад counterparty IDs should be unique across the entire system.

**Validates: Requirements 3.8, 14.3**

### Property 10: Duplicate User Detection

*For any* phone number, attempting to create a second user with the same normalized phone number in the same project should return HTTP 409 Conflict with the existing user's data.

**Validates: Requirements 3.5, 3.6**

### Property 11: Search Returns All Matches

*For any* search query that matches multiple users, the search endpoint should return all matching users in the rows array, not just the first match.

**Validates: Requirements 4.8**

### Property 12: Balance Calculation Excludes Expired Bonuses

*For any* user, the calculated bonus balance should equal the sum of all active (non-expired) bonuses, and expired bonuses should not contribute to the available balance.

**Validates: Requirements 5.5, 5.6, 21.8**

### Property 13: Verification Code Properties

*For any* generated verification code, it should be exactly 6 digits, stored with a 5-minute expiry, and become invalid after successful use or expiration.

**Validates: Requirements 6.3, 6.4, 8.9**

### Property 14: Verification Code Rate Limiting

*For any* user, requesting more than 3 verification codes within a 10-minute window should result in HTTP 429 Too Many Requests.

**Validates: Requirements 6.9, 6.10**

### Property 15: Maximum Spendable Bonus Calculation

*For any* purchase with total amount T, user balance B, and project maxBonusSpend percentage M, the maximum spendable bonuses should be min(B, T * M / 100).

**Validates: Requirements 7.4, 7.5, 7.7, 21.6**

### Property 16: Proportional Discount Distribution

*For any* set of positions in a recalc request, the sum of all position discounts should equal the total discount amount, and discounts should be distributed proportionally based on each position's contribution to the total.

**Validates: Requirements 7.8**

### Property 17: BonusBehavior - SPEND_AND_EARN Logic

*For any* sale with BonusBehavior set to SPEND_AND_EARN, if the customer spent S bonuses on a purchase of total T, then the earned bonuses should be calculated as (T - S) * bonusPercentage / 100; if no bonuses were spent (S = 0), then earned bonuses should be T * bonusPercentage / 100.

**Validates: Requirements 9.4, 9.5, 21.2, 21.3**

### Property 18: BonusBehavior - SPEND_ONLY Logic

*For any* sale with BonusBehavior set to SPEND_ONLY, if the customer spent any bonuses (S > 0), then no new bonuses should be accrued (earned = 0); if no bonuses were spent (S = 0), then earned bonuses should be T * bonusPercentage / 100.

**Validates: Requirements 9.6, 21.4**

### Property 19: BonusBehavior - EARN_ONLY Logic

*For any* project with BonusBehavior set to EARN_ONLY, attempting to spend bonuses should be rejected, and all sales should accrue bonuses based on the full purchase amount.

**Validates: Requirements 21.5**

### Property 20: Bonus Expiry Date Calculation

*For any* newly created bonus, if the project has bonusExpiryDays set to N (where N > 0), then the bonus expiresAt date should be exactly N days from the creation date; if bonusExpiryDays is null, then expiresAt should be null (never expires).

**Validates: Requirements 9.7, 21.9**

### Property 21: Bonus Amount Rounding

*For any* calculated bonus amount, the value should be rounded to exactly 2 decimal places.

**Validates: Requirements 21.10**

### Property 22: Database Transaction Atomicity

*For any* operation that modifies multiple database records (creating bonuses and transactions, processing returns), either all changes should be committed successfully, or all changes should be rolled back, ensuring no partial state is persisted.

**Validates: Requirements 9.13, 9.14, 10.11, 16.6, 16.7**

### Property 23: Return Transaction Reversal - Earned Bonuses

*For any* return of a sale where bonuses were earned, the returned amount of bonuses should be deducted from the user's balance, and the original bonus records should be adjusted (reduced or marked expired).

**Validates: Requirements 10.5, 10.6**

### Property 24: Return Transaction Reversal - Spent Bonuses

*For any* return of a sale where bonuses were spent, the spent bonuses should be returned to the user's balance as new active bonuses.

**Validates: Requirements 10.7**

### Property 25: Return Transaction Linking

*For any* return transaction, it should be linked to the original sale transaction via moySkladReturnId, allowing traceability between returns and original sales.

**Validates: Requirements 10.9**

### Property 26: API Logging Completeness

*For any* request to the Loyalty API, an API log entry should be created containing the endpoint, method, request body (sanitized), response status, response body, processing time, and timestamp.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

### Property 27: Error Logging

*For any* request that results in an error (status >= 400), the API log should include the error message and stack trace for debugging purposes.

**Validates: Requirements 12.6, 16.8**

### Property 28: Request Schema Validation

*For any* incoming request, if the request body does not match the expected schema (missing required fields, wrong data types, invalid values), then the API should return HTTP 400 Bad Request with a list of specific validation errors.

**Validates: Requirements 16.2, 16.3, 20.1, 20.2, 20.3, 20.4**

### Property 29: Response Format Consistency

*For any* successful response from the Loyalty API, it should include the Content-Type: application/json header and follow the МойСклад Loyalty API specification format.

**Validates: Requirements 20.5, 20.6**

### Property 30: Error Response Format Consistency

*For any* error response, it should follow the consistent format `{ error: { code: string, message: string, details?: any } }` with appropriate HTTP status codes.

**Validates: Requirements 20.7**

### Property 31: Integration Status Enforcement

*For any* request to a project where the МойСклад integration is disabled (isActive = false), the API should return HTTP 503 Service Unavailable regardless of the endpoint or request validity.

**Validates: Requirements 1.9**

### Property 32: User Identification by Phone

*For any* user lookup operation (search, balance check, transaction), the primary identifier should be the normalized phone number, with card number as a secondary fallback identifier.

**Validates: Requirements 14.1, 14.5, 14.6**

### Property 33: Invalid Phone Number Rejection

*For any* phone number that cannot be normalized to a valid E.164 format, the API should return HTTP 400 Bad Request with a validation error indicating the phone number is invalid.

**Validates: Requirements 14.9**

### Property 34: Database Unavailability Handling

*For any* request when the database is unavailable or unreachable, the API should return HTTP 503 Service Unavailable without exposing internal error details.

**Validates: Requirements 16.1**

### Property 35: Request Timeout Enforcement

*For any* operation that exceeds 30 seconds, the API should terminate the request and return HTTP 504 Gateway Timeout.

**Validates: Requirements 16.4, 16.5**

### Property 36: Error Message Localization

*For any* error response, the error message should be in Russian by default, or in English if the Accept-Language header indicates English preference.

**Validates: Requirements 16.10, 20.8**


## Error Handling

### Error Response Format

All error responses follow a consistent JSON structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message (Russian/English)
    details?: any;          // Additional context (validation errors, etc.)
  };
}
```

### HTTP Status Codes

| Status Code | Usage | Example Scenarios |
|-------------|-------|-------------------|
| 400 Bad Request | Invalid request data | Malformed JSON, missing required fields, invalid phone format |
| 401 Unauthorized | Authentication failure | Missing or invalid auth token |
| 403 Forbidden | Authorization failure | Invalid verification code, expired code |
| 404 Not Found | Resource not found | User not found, original transaction not found |
| 409 Conflict | Resource already exists | Duplicate user with same phone number |
| 429 Too Many Requests | Rate limit exceeded | > 1000 requests/min, > 3 verification codes/10min |
| 500 Internal Server Error | Unexpected server error | Unhandled exceptions, programming errors |
| 503 Service Unavailable | Service temporarily unavailable | Integration disabled, database unavailable |
| 504 Gateway Timeout | Request timeout | Operation exceeded 30 seconds |

### Error Codes

```typescript
enum ErrorCode {
  // Authentication errors
  INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND',
  INTEGRATION_DISABLED = 'INTEGRATION_DISABLED',
  INVALID_AUTH_TOKEN = 'INVALID_AUTH_TOKEN',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  
  // Resource errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  
  // Business logic errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',
  NO_CONTACT_METHOD = 'NO_CONTACT_METHOD',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}
```

### Error Handling Strategy

1. **Input Validation**: Validate all inputs at the API boundary using Zod schemas
2. **Early Returns**: Return errors as soon as they're detected
3. **Graceful Degradation**: Handle external service failures (SMS, Telegram) gracefully
4. **Transaction Rollback**: Use database transactions for all multi-step operations
5. **Error Logging**: Log all errors with context for debugging
6. **User-Friendly Messages**: Return clear, actionable error messages in Russian
7. **No Internal Leakage**: Never expose stack traces, database errors, or internal paths to clients

### Example Error Responses

**Validation Error (400)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации данных запроса",
    "details": [
      {
        "field": "agent.meta.id",
        "message": "Обязательное поле"
      },
      {
        "field": "positions",
        "message": "Массив должен содержать хотя бы 1 элемент"
      }
    ]
  }
}
```

**Authentication Error (401)**:
```json
{
  "error": {
    "code": "INVALID_AUTH_TOKEN",
    "message": "Неверный токен аутентификации"
  }
}
```

**Insufficient Balance (400)**:
```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Недостаточно бонусов на счете",
    "details": {
      "available": 500,
      "requested": 1000
    }
  }
}
```

**Rate Limit (429)**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Превышен лимит запросов. Попробуйте позже.",
    "details": {
      "retryAfter": 45
    }
  }
}
```


## Testing Strategy

### Dual Testing Approach

The МойСклад integration requires both unit tests and property-based tests for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property Tests**: Verify universal properties across all inputs using randomized testing

### Unit Testing Focus

Unit tests should cover:

1. **Specific Examples**:
   - Creating a user with phone +79991234567
   - Calculating bonuses for a 5000₽ purchase with 5% rate
   - Processing a return for a specific sale

2. **Edge Cases**:
   - Empty search results
   - User with no phone or Telegram
   - Expired bonuses in balance calculation
   - Return amount exceeding original sale

3. **Integration Points**:
   - Authentication middleware integration
   - Rate limiter integration
   - Database transaction boundaries
   - SMS/Telegram service integration

4. **Error Conditions**:
   - Invalid auth token
   - Malformed request body
   - Database connection failure
   - Verification code expiry

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript property-based testing

**Configuration**:
```typescript
import fc from 'fast-check';

// Minimum 100 iterations per property test
const testConfig = {
  numRuns: 100,
  verbose: true
};

// Example property test
describe('Property Tests', () => {
  it('Property 7: Phone Number Normalization Round-Trip', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 10, maxLength: 10 }).map(s => s.replace(/\D/g, '')),
          fc.string({ minLength: 11, maxLength: 11 }).map(s => '8' + s.slice(1)),
          fc.string({ minLength: 11, maxLength: 11 }).map(s => '7' + s.slice(1)),
          fc.string({ minLength: 11, maxLength: 11 }).map(s => '+7' + s.slice(1))
        ),
        (phone) => {
          const normalized = normalizePhoneNumber(phone);
          if (normalized) {
            // Should start with +7
            expect(normalized).toMatch(/^\+7\d{10}$/);
            // Normalizing again should be idempotent
            expect(normalizePhoneNumber(normalized)).toBe(normalized);
          }
        }
      ),
      testConfig
    );
  });
});
```

**Property Test Tags**:

Each property test must include a comment tag referencing the design document property:

```typescript
/**
 * Feature: moysklad-integration, Property 17: BonusBehavior - SPEND_AND_EARN Logic
 * 
 * For any sale with BonusBehavior set to SPEND_AND_EARN, if the customer spent S bonuses
 * on a purchase of total T, then the earned bonuses should be calculated as
 * (T - S) * bonusPercentage / 100
 */
it('Property 17: SPEND_AND_EARN bonus calculation', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 100, max: 100000 }), // total amount
      fc.float({ min: 0, max: 50000 }),    // spent bonuses
      fc.float({ min: 1, max: 20 }),       // bonus percentage
      (total, spent, percentage) => {
        fc.pre(spent <= total); // Precondition: can't spend more than total
        
        const project = createTestProject({
          bonusPercentage: percentage,
          bonusBehavior: 'SPEND_AND_EARN'
        });
        
        const loyaltyService = new LoyaltyService({ project, integration });
        const earned = loyaltyService.calculateEarnedBonuses(total, spent);
        
        const expected = Math.round(((total - spent) * percentage / 100) * 100) / 100;
        expect(earned).toBe(expected);
      }
    ),
    testConfig
  );
});
```

### Test Data Generators

Create reusable generators for property tests:

```typescript
// Arbitrary phone number generator
const phoneArbitrary = fc.oneof(
  fc.tuple(fc.constantFrom('+7', '8', '7', ''), fc.string({ minLength: 10, maxLength: 10 }))
    .map(([prefix, digits]) => prefix + digits.replace(/\D/g, ''))
);

// Arbitrary user generator
const userArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  phone: fc.option(phoneArbitrary, { nil: null }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  cardNumber: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
});

// Arbitrary project settings generator
const projectArbitrary = fc.record({
  bonusPercentage: fc.float({ min: 0, max: 100 }),
  maxBonusSpend: fc.float({ min: 0, max: 100 }),
  bonusBehavior: fc.constantFrom('SPEND_AND_EARN', 'SPEND_ONLY', 'EARN_ONLY'),
  bonusExpiryDays: fc.option(fc.integer({ min: 1, max: 365 }), { nil: null })
});

// Arbitrary sale request generator
const saleRequestArbitrary = fc.record({
  sum: fc.float({ min: 1, max: 1000000 }),
  bonusValue: fc.float({ min: 0, max: 50000 }),
  transactionType: fc.constantFrom('EARNING', 'SPENDING')
});
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All 36 correctness properties implemented
- **Integration Test Coverage**: All 9 API endpoints tested end-to-end
- **Error Path Coverage**: All error codes tested

### Testing Checklist

Before deployment, verify:

- [ ] All 36 correctness properties have property-based tests
- [ ] All property tests run minimum 100 iterations
- [ ] All property tests are tagged with feature and property number
- [ ] Unit tests cover all edge cases identified in prework
- [ ] Integration tests cover all 9 API endpoints
- [ ] Error handling tests cover all error codes
- [ ] Authentication and authorization tests pass
- [ ] Rate limiting tests verify limits are enforced
- [ ] Database transaction tests verify atomicity
- [ ] Phone normalization tests cover all supported formats
- [ ] BonusBehavior tests cover all three modes
- [ ] Bonus expiry tests verify correct date calculation
- [ ] Return processing tests verify correct reversal logic
- [ ] API logging tests verify all requests are logged
- [ ] Performance tests verify response time requirements (where applicable)

### Test Environment Setup

```typescript
// Test database setup
beforeAll(async () => {
  // Use separate test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  
  // Run migrations
  await execSync('npx prisma migrate deploy');
  
  // Seed test data
  await seedTestData();
});

afterAll(async () => {
  // Clean up test database
  await db.$executeRaw`TRUNCATE TABLE "User", "Bonus", "Transaction", "MoySkladIntegration", "MoySkladApiLog" CASCADE`;
  await db.$disconnect();
});

// Test isolation
beforeEach(async () => {
  // Start transaction
  await db.$executeRaw`BEGIN`;
});

afterEach(async () => {
  // Rollback transaction
  await db.$executeRaw`ROLLBACK`;
});
```

### Continuous Integration

Property-based tests should run on every commit:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: yarn install
      - run: yarn test:unit
      - run: yarn test:property
      - run: yarn test:integration
```

