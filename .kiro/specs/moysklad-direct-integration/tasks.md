# Implementation Plan: МойСклад Direct API Integration

## Overview

This implementation plan breaks down the МойСклад Direct API Integration feature into discrete, incremental coding tasks. The integration provides bidirectional bonus synchronization between our SaaS Bonus System and МойСклад POS using their Bonus Transaction API (JSON API 1.2).

The implementation follows a layered approach:
1. Database schema and encryption foundation
2. Core API client and services
3. Webhook handling and sync orchestration
4. API routes for integration management
5. UI components for admin dashboard
6. Telegram bot integration
7. Testing and documentation

Each task builds on previous work and includes specific requirements references for traceability.

## Tasks

- [-] 1. Database schema and encryption setup
  - [x] 1.1 Create Prisma schema for МойСклад Direct integration
    - Add `MoySkladDirectIntegration` model with all fields (accountId, apiToken, bonusProgramId, syncDirection, autoSync, webhookSecret, isActive, lastSyncAt, lastError)
    - Add `MoySkladDirectSyncLog` model with operation tracking fields
    - Add `moySkladDirectCounterpartyId` field to User model
    - Add `SyncDirection` enum (BIDIRECTIONAL, MOYSKLAD_TO_US, US_TO_MOYSKLAD)
    - Create indexes for performance (projectId, webhookSecret, integrationId+createdAt composite, userId, status, moySkladTransactionId, moySkladDirectCounterpartyId)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.4, 4.5_

  - [x] 1.2 Generate and apply Prisma migration
    - Run `npx prisma migrate dev --name moysklad_direct_integration`
    - Verify migration creates all tables and indexes correctly
    - Test migration rollback capability
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Implement encryption service for API tokens
    - Create `src/lib/moysklad-direct/encryption.ts`
    - Implement `encryptApiToken()` using AES-256-GCM with PBKDF2 key derivation
    - Implement `decryptApiToken()` with authentication tag verification
    - Implement `testEncryption()` for validation
    - Use MOYSKLAD_ENCRYPTION_KEY environment variable
    - Format: `salt:iv:authTag:encryptedData` (base64 encoded)
    - _Requirements: 1.5, 2.8_

  - [ ] 1.4 Write property test for encryption round-trip
    - **Property 1: API Token Encryption Round-Trip**
    - **Validates: Requirements 1.5, 2.8**
    - Generate random API token strings (various lengths, characters)
    - Verify encrypt → decrypt produces original token
    - Test with edge cases (empty, very long, special characters)

- [-] 2. МойСклад API client implementation
  - [x] 2.1 Create TypeScript types for МойСклад API
    - Create `src/lib/moysklad-direct/types.ts`
    - Define `MoySkladClientConfig`, `MoySkladBonusTransaction`, `MoySkladCounterparty`, `MoySkladMeta` interfaces
    - Define `AccrueBonusParams`, `SpendBonusParams` interfaces
    - Define `MoySkladApiError` class extending Error
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Implement MoySkladClient core functionality
    - Create `src/lib/moysklad-direct/client.ts`
    - Implement constructor with config validation
    - Implement `accrueBonus()` method with POST to bonus transaction endpoint
    - Implement `spendBonus()` method with POST to bonus transaction endpoint
    - Implement `getBalance()` method with GET to counterparty endpoint
    - Implement `getBonusTransaction()` method with GET by transaction ID
    - Use fetch API with Bearer token authentication
    - Decrypt API token before each request
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 2.3 Implement counterparty operations
    - Implement `findCounterpartyByPhone()` with phone normalization to E.164
    - Implement `getCounterparty()` by ID
    - Implement phone number normalization utility
    - Handle multiple phone formats (+7, 8, 7, with/without spaces/dashes)
    - _Requirements: 2.4, 5.1_

  - [ ] 2.4 Write property test for phone normalization idempotence
    - **Property 2: Phone Number Normalization Idempotence**
    - **Validates: Requirements 2.4**
    - Generate random phone numbers in various formats
    - Verify normalize(normalize(phone)) === normalize(phone)

  - [x] 2.5 Implement error handling and retry logic
    - Implement exponential backoff retry for transient errors (429, 500, 502, 503)
    - Implement `MoySkladApiError` with statusCode and response body
    - Add retry logic with 3 attempts and delays (1s, 2s, 4s for rate limits; 2s, 4s, 8s for server errors)
    - Handle non-retryable errors (401, 403, 404) without retry
    - Log all API calls and errors using logger service
    - _Requirements: 2.7, 2.9, 3.3_

  - [ ] 2.6 Write property test for API error handling consistency
    - **Property 3: API Error Handling Consistency**
    - **Validates: Requirements 2.9**
    - Generate random error responses (401, 403, 404, 429, 500, 502, 503)
    - Mock API to return errors
    - Verify MoySkladApiError thrown with correct statusCode

  - [x] 2.7 Implement balance caching
    - Create in-memory cache for balance queries (5 minute TTL)
    - Implement cache key: `moysklad:balance:${counterpartyId}`
    - Implement cache invalidation on sync operations
    - Add cache hit/miss logging
    - _Requirements: 2.6, 10.1_

  - [x] 2.8 Implement connection testing
    - Implement `testConnection()` method
    - Verify API credentials by fetching account info
    - Return success/error with details
    - _Requirements: 2.10, 7.5_

- [x] 3. Sync service implementation
  - [x] 3.1 Create SyncService class structure
    - Create `src/lib/moysklad-direct/sync-service.ts`
    - Define interfaces: `SyncAccrualParams`, `SyncSpendingParams`, `SyncFromMoySkladParams`, `BalanceCheckResult`
    - Implement constructor with dependency injection (MoySkladClient, BonusService, db)
    - _Requirements: 3.1, 3.2, 4.1, 5.1_

  - [x] 3.2 Implement outgoing sync (us → МойСклад)
    - Implement `syncBonusAccrualToMoySklad()` method
    - Load integration settings and check isActive and syncDirection
    - Get user's moySkladDirectCounterpartyId or call findAndLinkCounterparty()
    - Call MoySkladClient.accrueBonus() with bonus details
    - Create sync log with status "success" or "error"
    - Update integration.lastSyncAt on success
    - Handle errors gracefully without throwing (non-critical operation)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.3 Write property test for sync direction filtering
    - **Property 4: Sync Direction Filtering**
    - **Validates: Requirements 3.2, 4.4**
    - Generate random sync directions
    - Attempt outgoing and incoming syncs
    - Verify operations only execute when direction allows

  - [ ] 3.4 Write property test for sync audit trail completeness
    - **Property 5: Sync Audit Trail Completeness**
    - **Validates: Requirements 3.1, 3.4, 4.5, 6.6**
    - Generate random sync operations
    - Execute sync
    - Verify log exists with correct operation, direction, status, timestamp

  - [ ] 3.5 Write property test for error handling non-throwing
    - **Property 6: Error Handling Non-Throwing**
    - **Validates: Requirements 3.3, 6.7**
    - Generate random sync errors
    - Mock error conditions
    - Verify no exception thrown, sync log created with status "error"

  - [x] 3.6 Implement bonus spending sync
    - Implement `syncBonusSpendingToMoySklad()` method
    - Similar logic to accrual but calls MoySkladClient.spendBonus()
    - Create sync log with operation "bonus_spending"
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.7 Implement incoming sync (МойСклад → us)
    - Implement `syncFromMoySklad()` method
    - Check syncDirection allows incoming sync
    - Extract counterpartyId from bonusTransaction
    - Find user by moySkladDirectCounterpartyId or by phone
    - For EARNING transactions: create Bonus record (type: PURCHASE, source: "moysklad_offline") and Transaction (type: EARN)
    - For SPENDING transactions: call BonusService.spendBonuses() and create Transaction (type: SPEND)
    - Store moySkladTransactionId in transaction metadata
    - Create sync log with full transaction data
    - Send Telegram notification if user has telegramChatId
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 3.8 Write property test for incoming sync data transformation
    - **Property 7: Incoming Sync Data Transformation**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate random МойСклад bonus transactions (EARNING and SPENDING)
    - Call syncFromMoySklad()
    - Verify correct Bonus/Transaction records created with correct types and amounts

  - [ ] 3.9 Write property test for Telegram notification conditional sending
    - **Property 8: Telegram Notification Conditional Sending**
    - **Validates: Requirements 4.6, 9.3**
    - Generate random users (with and without telegramChatId)
    - Perform incoming sync
    - Verify notification sent ⟺ user has telegramChatId

  - [x] 3.10 Implement user linking by phone
    - Implement `findAndLinkCounterparty()` method
    - Get user's phone number and normalize to E.164
    - Call MoySkladClient.findCounterpartyByPhone()
    - If found, call linkUserToCounterparty()
    - Return true if linked, false otherwise
    - Log warnings if user not found
    - _Requirements: 5.1, 5.2_

  - [x] 3.11 Implement balance verification
    - Implement `checkAndSyncBalance()` method
    - Load user with integration settings
    - Fetch balances in parallel: BonusService.getAvailableBalance() and MoySkladClient.getBalance()
    - Calculate difference and determine if synced (threshold < 0.01)
    - Create sync log with operation "balance_sync"
    - Return BalanceCheckResult with both balances and sync status
    - Handle МойСклад API errors gracefully (return local balance with moySkladBalance = null)
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [ ] 3.12 Write property test for balance comparison threshold
    - **Property 9: Balance Comparison Threshold**
    - **Validates: Requirements 5.3, 5.5**
    - Generate random balance pairs
    - Verify |balance1 - balance2| < 0.01 → synced = true
    - Verify |balance1 - balance2| >= 0.01 → synced = false, warning logged

  - [ ] 3.13 Write property test for balance check error resilience
    - **Property 10: Balance Check Error Resilience**
    - **Validates: Requirements 5.6**
    - Generate random API errors
    - Mock МойСклад API to fail
    - Verify returns { ourBalance: X, moySkladBalance: null, synced: false, error: "..." }

- [ ] 4. Checkpoint - Core services complete
  - Ensure all tests pass, ask the user if questions arise.

- [-] 5. Webhook handler implementation
  - [x] 5.1 Create webhook route handler
    - Create `src/app/api/webhook/moysklad-direct/[projectId]/route.ts`
    - Implement POST handler with projectId extraction
    - Find MoySkladDirectIntegration by projectId
    - Return 404 if integration not found or not active
    - _Requirements: 6.1, 6.3_

  - [x] 5.2 Implement webhook signature validation
    - Extract X-MoySklad-Signature header
    - Read request body as text
    - Validate HMAC-SHA256 signature using webhookSecret
    - Use timing-safe comparison (crypto.timingSafeEqual)
    - Return 401 Unauthorized if signature invalid
    - _Requirements: 6.2_

  - [ ] 5.3 Write property test for webhook signature validation
    - **Property 11: Webhook Signature Validation**
    - **Validates: Requirements 6.2**
    - Generate random webhook payloads
    - Generate valid and invalid signatures
    - Verify valid signature → 200 OK, invalid → 401 Unauthorized

  - [ ] 5.4 Write property test for webhook integration validation
    - **Property 12: Webhook Integration Validation**
    - **Validates: Requirements 6.3**
    - Generate random projectIds (existing, non-existing, inactive)
    - Verify existing + active → 200 OK, others → 404 Not Found

  - [x] 5.5 Implement webhook event processing
    - Parse JSON payload
    - Extract events array
    - Filter events by type "bonustransaction"
    - For each bonustransaction event:
      - Extract transaction ID from meta.href
      - Call MoySkladClient.getBonusTransaction(transactionId)
      - Call SyncService.syncFromMoySklad()
    - Create sync log for webhook request
    - Return 200 OK
    - Handle errors and return 500 with error logging
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

  - [ ] 5.6 Write property test for webhook event filtering
    - **Property 13: Webhook Event Filtering**
    - **Validates: Requirements 6.4, 6.5**
    - Generate random webhook payloads with mixed event types
    - Verify only bonustransaction events processed

- [-] 6. Integration management API routes
  - [x] 6.1 Implement GET integration endpoint
    - Create `src/app/api/projects/[id]/integrations/moysklad-direct/route.ts`
    - Implement GET handler with authentication check
    - Verify user is project owner
    - Fetch integration by projectId
    - Return integration data (exclude apiToken for security)
    - Return 404 if not found, 403 if not owner
    - _Requirements: 7.1_

  - [x] 6.2 Implement POST create integration endpoint
    - Implement POST handler in same route file
    - Validate request body (accountId, apiToken, bonusProgramId required)
    - Check UUID format for accountId and bonusProgramId
    - Encrypt apiToken using encryptApiToken()
    - Generate unique webhookSecret (crypto.randomBytes)
    - Create MoySkladDirectIntegration record
    - Return created integration with webhookSecret
    - Return 409 if integration already exists
    - _Requirements: 7.2_

  - [ ] 6.3 Write property test for integration CRUD persistence
    - **Property 14: Integration CRUD Persistence**
    - **Validates: Requirements 7.2, 7.3, 7.4**
    - Generate random integration data
    - POST to create → verify in database
    - PUT to update → verify changes
    - DELETE → verify isActive = false

  - [x] 6.4 Implement PUT update integration endpoint
    - Implement PUT handler for partial updates
    - Validate optional fields (accountId, apiToken, bonusProgramId, syncDirection, autoSync, isActive)
    - Encrypt apiToken if provided
    - Update integration record
    - Return updated integration
    - Return 404 if not found
    - _Requirements: 7.3_

  - [x] 6.5 Implement DELETE integration endpoint
    - Implement DELETE handler for soft delete
    - Set isActive = false instead of hard delete
    - Preserve sync logs for audit
    - Return 204 No Content
    - Return 404 if not found
    - _Requirements: 7.4_

  - [x] 6.6 Implement test connection endpoint
    - Create `src/app/api/projects/[id]/integrations/moysklad-direct/test/route.ts`
    - Implement POST handler
    - Load integration settings
    - Create MoySkladClient instance
    - Call testConnection() method
    - Return success/error with details
    - _Requirements: 7.5_

  - [x] 6.7 Implement manual sync endpoint
    - Create `src/app/api/projects/[id]/integrations/moysklad-direct/sync/route.ts`
    - Implement POST handler with optional userId parameter
    - If userId provided: sync specific user
    - If no userId: sync all users for project (use batching)
    - Return sync results (synced count, errors count, details)
    - _Requirements: 7.6_

  - [x] 6.8 Implement sync logs query endpoint
    - Create `src/app/api/projects/[id]/integrations/moysklad-direct/logs/route.ts`
    - Implement GET handler with query parameters (operation, direction, status, dateFrom, dateTo, limit, offset)
    - Validate query parameters
    - Build Prisma query with filters
    - Apply pagination (default limit: 50, max: 100)
    - Return logs array with total count
    - _Requirements: 7.7_

  - [ ] 6.9 Write property test for sync logs query filtering
    - **Property 15: Sync Logs Query Filtering**
    - **Validates: Requirements 7.7**
    - Create random sync logs with various attributes
    - Generate random filter combinations
    - Verify all returned logs match all specified filters

- [ ] 7. Checkpoint - API routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. UI components for admin dashboard
  - [x] 8.1 Create integration settings page layout
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/page.tsx`
    - Implement Server Component with data loading
    - Create `data-access.ts` for fetching integration and stats
    - Use dashboard layout with sidebar and header
    - Apply glass-card styling from design system
    - _Requirements: 8.1_

  - [x] 8.2 Create IntegrationStatusCard component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/status-card.tsx`
    - Display integration status (active/inactive badge)
    - Show last sync timestamp with relative time
    - Show last error if any (expandable)
    - Add quick action buttons: Test Connection, Manual Sync
    - Use motion animations for status changes
    - _Requirements: 8.1_

  - [x] 8.3 Create IntegrationForm component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/integration-form.tsx`
    - Mark as 'use client' for form interactivity
    - Add form fields: Account ID, API Token (password), Bonus Program ID, Sync Direction (select), Auto Sync (checkbox), Is Active (toggle)
    - Implement Zod validation schema (UUID format for IDs, required fields)
    - Add real-time validation on blur
    - Disable submit button until valid
    - Show error messages below fields
    - Add Test Connection button with loading state
    - _Requirements: 8.2, 8.3_

  - [ ] 8.4 Write property test for form input validation
    - **Property 16: Form Input Validation**
    - **Validates: Requirements 8.3**
    - Generate random form inputs (valid and invalid)
    - Verify valid data → submission succeeds
    - Verify invalid data → submission blocked, errors displayed

  - [x] 8.5 Create WebhookCredentials component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/webhook-credentials.tsx`
    - Display webhook URL (read-only with copy button)
    - Display webhook secret (masked by default with show/hide toggle and copy button)
    - Add setup instructions accordion with 5 steps
    - Use glass-card styling
    - _Requirements: 8.4_

  - [x] 8.6 Create SyncStatsCards component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/stats-cards.tsx`
    - Mark as 'use client' for animations
    - Display 4 stat cards: Total Syncs, Success Rate, Last Sync Time, Total Bonus Synced
    - Use stagger animation (framer-motion)
    - Use color-coded icons (emerald for success, rose for error, amber for pending)
    - Apply glass-card styling with hover effects
    - _Requirements: 8.5_

  - [x] 8.7 Create SyncLogsTable component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/sync-logs-table.tsx`
    - Mark as 'use client' for interactivity
    - Display columns: Timestamp, Operation (badge), Direction (icon), User (link), Amount, Status (badge), Actions
    - Implement filters: operation dropdown, direction dropdown, status dropdown, date range picker
    - Implement pagination with page size selector (25, 50, 100)
    - Add expandable rows for request/response data (JSON viewer)
    - Use DataTableBuilder from composite components if available
    - _Requirements: 8.6_

  - [ ] 8.8 Create SyncStatsChart component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/stats-chart.tsx`
    - Mark as 'use client' for Recharts
    - Display line chart: syncs over time (last 30 days)
    - Separate lines for success (emerald) and error (rose)
    - Use AreaChart with gradient fills
    - Add hover tooltips with details
    - Support dark mode with theme detection
    - _Requirements: 8.7_

  - [ ] 8.9 Create ManualSyncDialog component
    - Create `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/manual-sync-dialog.tsx`
    - Mark as 'use client' for dialog state
    - Add radio options: Sync all users, Sync specific user (with user selector)
    - Show progress indicator during sync
    - Display results: success count, error count, error details (expandable)
    - Use Dialog component from shadcn/ui
    - _Requirements: 8.8_

- [ ] 9. Telegram bot integration (ОПЦИОНАЛЬНО - НЕ ТРЕБУЕТСЯ)
  - [ ] 9.1 Update balance command to include МойСклад balance
    - Locate existing Telegram bot balance command handler
    - Call SyncService.checkAndSyncBalance() for users with МойСклад integration
    - Format response message with both balances
    - Show sync status indicator (✅ synced, ⚠️ mismatch)
    - Handle case where МойСклад integration not active
    - Handle case where МойСклад API error (show local balance only)
    - _Requirements: 9.1, 9.2_
    - **ПРИМЕЧАНИЕ:** Пользователь уточнил, что Telegram бот интеграция НЕ нужна. Основная задача - синхронизация бонусов между онлайн и офлайн системами.

  - [ ] 9.2 Write property test for Telegram balance command response
    - **Property 17: Telegram Balance Command Response**
    - **Validates: Requirements 9.1, 9.2**
    - Generate random users (with/without МойСклад integration)
    - Send /balance command
    - Verify message contains local balance
    - Verify message contains МойСклад balance if integration active
    - Verify message contains sync status

  - [ ] 9.3 Implement Telegram notification for offline purchases
    - Update SyncService.syncFromMoySklad() to send notifications
    - Check if user has telegramChatId
    - Format notification message with bonus amount and source
    - Send notification using Telegram bot API
    - Log notification sending
    - _Requirements: 9.3_

- [x] 10. Integration with existing bonus system
  - [x] 10.1 Hook sync into BonusService.awardBonus()
    - Добавлен неблокирующий вызов SyncService.syncBonusAccrualToMoySklad()
    - Синхронизация происходит после успешного начисления бонусов
    - Ошибки синхронизации логируются, но не блокируют основной процесс
    - _Requirements: 3.1, 3.2_

  - [x] 10.2 Hook sync into BonusService.spendBonuses()
    - Добавлен неблокирующий вызов SyncService.syncBonusSpendingToMoySklad()
    - Синхронизация происходит после успешного списания бонусов
    - Ошибки синхронизации логируются, но не блокируют основной процесс
    - _Requirements: 3.1, 3.2_

  - [x] 10.3 Hook sync into UserService.createUser()
    - Добавлен неблокирующий вызов SyncService.findAndLinkCounterparty()
    - Автоматическое связывание пользователя с МойСклад по телефону
    - Выполняется только если у пользователя есть телефон
    - Ошибки не блокируют создание пользователя
    - _Requirements: 5.1, 5.2_

- [ ] 11. Checkpoint - Integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Performance optimizations
  - [ ] 12.1 Implement rate limiting for МойСклад API
    - Create `src/lib/moysklad-direct/rate-limiter.ts`
    - Implement token bucket algorithm (45 requests per 3 seconds)
    - Integrate into MoySkladClient before each API call
    - Add wait logic when tokens exhausted
    - _Requirements: 10.3_

  - [ ] 12.2 Implement bulk sync with batching
    - Update SyncService to support bulk sync operations
    - Implement batching logic (10 users per batch)
    - Use Promise.allSettled for parallel execution within batch
    - Add 1 second delay between batches for rate limit protection
    - Return BulkSyncResult with success/error counts
    - _Requirements: 10.2_

  - [ ] 12.3 Optimize database queries with proper indexes
    - Verify all indexes created by migration
    - Test query performance for sync logs filtering
    - Add composite index for integrationId + createdAt if not exists
    - Use database-level filtering in all queries
    - _Requirements: 10.4_

  - [ ] 12.4 Implement connection pooling configuration
    - Update Prisma client configuration
    - Set connection pool limits (min: 2, max: 10)
    - Set timeouts (idle: 30s, connection: 5s)
    - Test under load
    - _Requirements: 10.5_

- [ ] 13. Documentation
  - [ ] 13.1 Create API integration guide
    - Create `docs/moysklad-direct-integration.md`
    - Document setup steps for МойСклад account
    - Document how to obtain API token and bonus program ID
    - Document webhook configuration in МойСклад
    - Include screenshots and examples
    - _Requirements: All_

  - [ ] 13.2 Update changelog
    - Add entry to `docs/changelog.md`
    - Document new feature: МойСклад Direct API Integration
    - List key capabilities: bidirectional sync, webhook support, balance verification
    - Note breaking changes if any
    - _Requirements: All_

  - [ ] 13.3 Create troubleshooting guide
    - Add section to `docs/TROUBLESHOOTING.md`
    - Document common issues: invalid API token, webhook signature errors, user not found
    - Provide solutions and debugging steps
    - Include sync log investigation tips
    - _Requirements: All_

  - [ ] 13.4 Update project README
    - Update main README.md with МойСклад integration feature
    - Add to features list
    - Link to detailed documentation
    - _Requirements: All_

- [ ] 14. Testing and validation
  - [ ] 14.1 Run all property-based tests
    - Execute all property tests created in previous tasks
    - Verify all properties pass with random inputs
    - Fix any failures discovered
    - Document test coverage

  - [ ] 14.2 Manual integration testing with МойСклад sandbox
    - Create test МойСклад account
    - Create test bonus program
    - Generate API token
    - Configure integration in admin dashboard
    - Test connection succeeds
    - Configure webhook in МойСклад
    - Test online → МойСклад sync (create purchase via Tilda/InSales webhook)
    - Test МойСклад → online sync (create purchase in МойСклад POS)
    - Test balance check via Telegram bot
    - Test balance mismatch detection
    - Test error scenarios (invalid token, user not found, API down)
    - _Requirements: All_

  - [ ] 14.3 Load testing
    - Test bulk sync with 100+ users
    - Verify rate limiting works correctly
    - Verify no database deadlocks
    - Verify webhook processing under load
    - Measure sync latency (target: < 5s)
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 14.4 Security testing
    - Test webhook signature validation with invalid signatures
    - Test API token encryption/decryption
    - Test multi-tenancy isolation (no cross-project access)
    - Test authentication on all API routes
    - Verify API token never exposed in responses
    - _Requirements: 1.5, 6.2, 11.1, 11.2, 11.3_

- [ ] 15. Deployment preparation
  - [ ] 15.1 Set up environment variables
    - Add MOYSKLAD_ENCRYPTION_KEY to production environment
    - Generate strong random key (32+ characters)
    - Document in deployment guide
    - Verify key is identical across all servers
    - _Requirements: 12.1_

  - [ ] 15.2 Run database migration in staging
    - Test migration in staging environment
    - Verify all tables and indexes created
    - Verify no data loss
    - Test rollback procedure
    - _Requirements: 12.2_

  - [ ] 15.3 Configure monitoring and alerts
    - Set up metrics tracking: sync success rate, sync latency, API error rate, webhook delivery rate, balance mismatch rate
    - Configure alerts: sync success rate < 95% for 1 hour, API error rate > 5% for 15 minutes, no webhooks for 1 hour, balance mismatch rate > 5% for 1 day
    - Set up log retention: sync logs 90 days, system logs 30 days, error logs 180 days
    - Test alert delivery
    - _Requirements: 12.3_

  - [ ] 15.4 Create deployment checklist
    - Document deployment steps
    - Include database migration
    - Include environment variable setup
    - Include monitoring setup
    - Include rollback procedure
    - _Requirements: 12.2_

  - [ ] 15.5 Deploy to production
    - Run database migration
    - Deploy application code
    - Verify environment variables set
    - Verify monitoring active
    - Test with one pilot project
    - Monitor for errors
    - _Requirements: All_

- [ ] 16. Final checkpoint - Feature complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements implemented
  - Verify all documentation complete
  - Verify monitoring and alerts configured
  - Feature ready for production use

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- The implementation uses TypeScript with Next.js 15, React 19, Prisma ORM, and Grammy for Telegram
- All code follows the project's design system and best practices (Server Components First, glass-card styling, etc.)
- Integration hooks into existing BonusService to enable automatic synchronization
- Webhook handling is secure with HMAC-SHA256 signature validation
- All sync operations are logged for audit and debugging
- Performance optimizations include caching, batching, and rate limiting
