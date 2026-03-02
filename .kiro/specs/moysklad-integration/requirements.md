# Requirements Document: МойСклад Loyalty API Integration

## Introduction

Данная спецификация описывает реализацию МойСклад Loyalty API для интеграции SaaS системы бонусов с кассами и POS-терминалами, использующими МойСклад. Интеграция реализует reverse integration модель, где наша система выступает в роли API provider, предоставляя endpoints для расчета скидок и управления бонусами в реальном времени во время оформления продаж.

**Бизнес-контекст:**
Клиенты системы имеют офлайн точки продаж (кассы, POS-терминалы), работающие на платформе МойСклад. При оформлении продажи кассир должен видеть баланс бонусов покупателя, применять бонусы к оплате и начислять новые бонусы за покупку. Все операции должны происходить в реальном времени через интеграцию с нашей бонусной системой.

**Архитектура интеграции:**
МойСклад Loyalty API использует reverse integration модель:
- МойСклад (касса/POS) вызывает НАШИ HTTP endpoints
- МЫ предоставляем API для МойСклад
- МЫ рассчитываем скидки и бонусы в реальном времени
- МЫ управляем балансами и транзакциями

**Scope:**
- Реализация Loyalty API endpoints согласно спецификации МойСклад
- Создание и поиск покупателей по номеру телефона/карты
- Получение баланса бонусов в реальном времени
- Расчет скидок и бонусов для продаж (pre-checkout)
- Подтверждение и фиксация транзакций (checkout)
- Обработка возвратов с реверсом бонусов
- Аутентификация запросов от МойСклад
- UI для настройки интеграции и генерации credentials
- Логирование всех операций Loyalty API

## Glossary

- **MoySklad_POS**: Касса или POS-терминал, работающий на платформе МойСклад
- **Loyalty_API**: HTTP API endpoints, которые мы предоставляем для МойСклад
- **Bonus_System**: Наша SaaS система управления бонусами
- **Loyalty_Service**: Сервис обработки запросов от МойСклад и расчета бонусов
- **Counterparty**: Покупатель (клиент) в терминологии МойСклад
- **Retail_Demand**: Розничная продажа в МойСклад
- **Retail_Sales_Return**: Возврат товара в МойСклад
- **Auth_Token**: Уникальный токен для аутентификации запросов от МойСклад
- **Base_URL**: URL нашего Loyalty API, который мы предоставляем МойСклад
- **Project_Owner**: Владелец проекта (tenant) в мультитенантной системе
- **Phone_Number**: Номер телефона в международном формате (основной идентификатор)
- **Bonus_Balance**: Текущий баланс бонусов покупателя
- **Transaction_Type**: Тип операции (EARNING - начисление, SPENDING - списание)
- **Recalc_Request**: Запрос на расчет скидок и бонусов перед оформлением продажи
- **Verify_Request**: Запрос на подтверждение списания бонусов (с кодом подтверждения)
- **API_Log**: Журнал всех запросов к Loyalty API
- **Solution_Descriptor**: XML-файл описания решения для каталога МойСклад
- **Iframe_Settings**: Страница настройки интеграции, открываемая в iframe МойСклад

## Requirements

### Requirement 1: Integration Configuration and Setup

**User Story:** Как Project_Owner, я хочу настроить интеграцию с МойСклад через UI, чтобы получить credentials для подключения моей кассы к бонусной системе.

#### Acceptance Criteria

1. THE Bonus_System SHALL provide a configuration page at `/dashboard/projects/[id]/integrations/moysklad`
2. WHEN Project_Owner activates integration, THE Bonus_System SHALL generate unique Auth_Token for the project
3. THE Bonus_System SHALL generate Base_URL in format `https://gupil.ru/api/moysklad-loyalty/[projectId]`
4. THE Bonus_System SHALL display Auth_Token and Base_URL for Project_Owner to configure in МойСклад
5. THE Bonus_System SHALL allow Project_Owner to regenerate Auth_Token if compromised
6. THE Bonus_System SHALL store Auth_Token as hashed value using bcrypt
7. THE Bonus_System SHALL allow Project_Owner to configure bonus calculation rules (percentage, max spend limit)
8. THE Bonus_System SHALL allow Project_Owner to enable or disable the integration at any time
9. WHEN integration is disabled, THE Loyalty_API SHALL return HTTP 503 Service Unavailable for all requests
10. THE Bonus_System SHALL display integration status (active, inactive, last request time)

### Requirement 2: Authentication and Security

**User Story:** Как Loyalty_API, я хочу аутентифицировать запросы от МойСклад, чтобы предотвратить несанкционированный доступ к бонусным операциям.

#### Acceptance Criteria

1. THE Loyalty_API SHALL require `Lognex-Discount-API-Auth-Token` header in all requests
2. WHEN request is received, THE Loyalty_API SHALL extract Auth_Token from header
3. THE Loyalty_API SHALL validate Auth_Token against hashed value in database
4. IF Auth_Token is invalid or missing, THEN THE Loyalty_API SHALL return HTTP 401 Unauthorized
5. IF integration is disabled for project, THEN THE Loyalty_API SHALL return HTTP 503 Service Unavailable
6. THE Loyalty_API SHALL use HTTPS for all endpoints
7. THE Loyalty_API SHALL apply rate limiting of 1000 requests per minute per project
8. IF rate limit is exceeded, THEN THE Loyalty_API SHALL return HTTP 429 Too Many Requests
9. THE Loyalty_API SHALL log all authentication failures with timestamp and source IP
10. THE Loyalty_API SHALL not expose sensitive data (tokens, full phone numbers) in error responses

### Requirement 3: Create Counterparty Endpoint

**User Story:** Как MoySklad_POS, я хочу создавать новых покупателей через API, чтобы зарегистрировать их в бонусной программе.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/counterparty`
2. WHEN request is received, THE Loyalty_API SHALL validate Auth_Token
3. THE Loyalty_API SHALL parse request body containing name, phone, email, and card number
4. THE Loyalty_API SHALL normalize Phone_Number to E.164 format
5. THE Loyalty_API SHALL check if user with Phone_Number already exists in project
6. IF user exists, THEN THE Loyalty_API SHALL return HTTP 409 Conflict with existing user data
7. IF user does not exist, THEN THE Loyalty_API SHALL create new user in Bonus_System
8. THE Loyalty_API SHALL generate unique МойСклад Counterparty ID for the user
9. WHEN user is created, THE Loyalty_API SHALL apply welcome bonus if configured in project settings
10. THE Loyalty_API SHALL return HTTP 201 Created with user data including Counterparty ID and initial balance
11. THE Loyalty_API SHALL log creation operation to API_Log

### Requirement 4: Search Counterparty Endpoint

**User Story:** Как MoySklad_POS, я хочу искать покупателей по номеру телефона или карты, чтобы идентифицировать их при оформлении продажи.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide GET endpoint at `/api/moysklad-loyalty/[projectId]/counterparty`
2. THE Loyalty_API SHALL accept query parameter `search` containing phone number or card number
3. THE Loyalty_API SHALL accept optional query parameter `retailStoreId` for filtering by store
4. WHEN search parameter is phone number, THE Loyalty_API SHALL normalize to E.164 format before searching
5. THE Loyalty_API SHALL search for users in project by phone number or card number
6. THE Loyalty_API SHALL return results in format `{ rows: [{ id, name, phone, email, cardNumber }] }`
7. IF no users found, THEN THE Loyalty_API SHALL return empty array in rows
8. IF multiple users match, THEN THE Loyalty_API SHALL return all matching users
9. THE Loyalty_API SHALL return HTTP 200 OK with search results
10. THE Loyalty_API SHALL log search operation to API_Log with search term

### Requirement 5: Get Counterparty Balance Endpoint

**User Story:** Как MoySklad_POS, я хочу получать баланс бонусов покупателя, чтобы показать его кассиру и покупателю перед оформлением продажи.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/counterparty/detail`
2. THE Loyalty_API SHALL accept request body containing `meta.id` (Counterparty ID)
3. THE Loyalty_API SHALL find user by МойСклад Counterparty ID
4. IF user not found, THEN THE Loyalty_API SHALL return HTTP 404 Not Found
5. THE Loyalty_API SHALL calculate current Bonus_Balance by summing all active bonuses
6. THE Loyalty_API SHALL exclude expired bonuses from balance calculation
7. THE Loyalty_API SHALL return balance in format `{ bonusProgram: { agentBonusBalance: <amount> } }`
8. THE Loyalty_API SHALL return HTTP 200 OK with balance data
9. THE Loyalty_API SHALL complete balance calculation within 500ms for 95th percentile
10. THE Loyalty_API SHALL log balance check operation to API_Log

### Requirement 6: Verification Code Request Endpoint

**User Story:** Как MoySklad_POS, я хочу запрашивать код подтверждения для списания бонусов, чтобы обеспечить безопасность операций.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/counterparty/verify`
2. THE Loyalty_API SHALL accept request body containing Counterparty ID and operation type
3. THE Loyalty_API SHALL generate 6-digit verification code
4. THE Loyalty_API SHALL store verification code with expiry time of 5 minutes
5. WHERE user has phone number, THE Loyalty_API SHALL send SMS with verification code
6. WHERE user has Telegram bot linked, THE Loyalty_API SHALL send verification code via Telegram
7. IF neither phone nor Telegram available, THEN THE Loyalty_API SHALL return HTTP 400 Bad Request
8. THE Loyalty_API SHALL return HTTP 200 OK with message indicating code was sent
9. THE Loyalty_API SHALL limit verification code requests to 3 per user per 10 minutes
10. IF rate limit exceeded, THEN THE Loyalty_API SHALL return HTTP 429 Too Many Requests

### Requirement 7: Calculate Discounts for Sale (Recalc) Endpoint

**User Story:** Как MoySklad_POS, я хочу рассчитывать скидки и бонусы для продажи в реальном времени, чтобы показать покупателю итоговую сумму до оплаты.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/retaildemand/recalc`
2. THE Loyalty_API SHALL accept Recalc_Request containing agent (Counterparty), positions (items), and transactionType
3. WHEN transactionType is EARNING, THE Loyalty_API SHALL calculate bonuses to be accrued based on project bonus percentage
4. WHEN transactionType is SPENDING, THE Loyalty_API SHALL calculate maximum bonuses that can be spent
5. THE Loyalty_API SHALL apply project's maxBonusSpend limit (percentage of total that can be paid with bonuses)
6. THE Loyalty_API SHALL check user's current Bonus_Balance
7. IF user wants to spend more bonuses than available, THEN THE Loyalty_API SHALL limit to available balance
8. THE Loyalty_API SHALL calculate discount for each position proportionally
9. THE Loyalty_API SHALL return positions array with discount values
10. THE Loyalty_API SHALL return bonusProgram object with earnedBonus or spentBonus amount
11. THE Loyalty_API SHALL return HTTP 200 OK with calculated discounts
12. THE Loyalty_API SHALL complete calculation within 1 second for 95th percentile
13. THE Loyalty_API SHALL log recalc operation to API_Log with calculation details

### Requirement 8: Verify Bonus Spending Endpoint

**User Story:** Как MoySklad_POS, я хочу подтверждать списание бонусов с кодом верификации, чтобы предотвратить мошенничество.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/retaildemand/verify`
2. THE Loyalty_API SHALL accept Verify_Request containing Counterparty ID, bonus amount, and verification code
3. THE Loyalty_API SHALL validate verification code against stored code
4. IF verification code is invalid or expired, THEN THE Loyalty_API SHALL return HTTP 403 Forbidden
5. THE Loyalty_API SHALL check if user has sufficient Bonus_Balance
6. IF balance insufficient, THEN THE Loyalty_API SHALL return HTTP 400 Bad Request with error message
7. THE Loyalty_API SHALL reserve bonuses for spending (mark as pending)
8. THE Loyalty_API SHALL return HTTP 200 OK with confirmation
9. THE Loyalty_API SHALL expire verification code after successful use
10. THE Loyalty_API SHALL log verification operation to API_Log

### Requirement 9: Create Sale (Finalize Transaction) Endpoint

**User Story:** Как MoySklad_POS, я хочу фиксировать завершенную продажу, чтобы начислить или списать бонусы в бонусной системе.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/retaildemand`
2. THE Loyalty_API SHALL accept request containing Retail_Demand with agent, positions, sum, and transactionType
3. WHEN transactionType is EARNING, THE Loyalty_API SHALL calculate bonuses based on project bonus percentage
4. THE Loyalty_API SHALL apply BonusBehavior logic from project settings (SPEND_AND_EARN, SPEND_ONLY, EARN_ONLY)
5. WHEN customer used bonuses for payment, THE Loyalty_API SHALL calculate earned bonuses on remaining amount (sum - spent bonuses) for SPEND_AND_EARN mode
6. WHEN customer used bonuses for payment and mode is SPEND_ONLY, THE Loyalty_API SHALL NOT accrue new bonuses
7. THE Loyalty_API SHALL create Bonus record with expiry date based on project settings
8. THE Loyalty_API SHALL create Transaction record with type EARN and amount
9. WHEN transactionType is SPENDING, THE Loyalty_API SHALL deduct bonuses from user's balance
10. THE Loyalty_API SHALL create Transaction record with type SPEND and amount
11. THE Loyalty_API SHALL release any reserved bonuses from verify step
12. THE Loyalty_API SHALL return HTTP 201 Created with transaction details
13. THE Loyalty_API SHALL use database transaction to ensure atomicity
14. IF operation fails, THEN THE Loyalty_API SHALL rollback all changes and return HTTP 500
15. THE Loyalty_API SHALL log sale operation to API_Log with full transaction data

### Requirement 10: Create Return Endpoint

**User Story:** Как MoySklad_POS, я хочу обрабатывать возвраты товаров, чтобы реверсировать бонусные операции.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide POST endpoint at `/api/moysklad-loyalty/[projectId]/retailsalesreturn`
2. THE Loyalty_API SHALL accept request containing Retail_Sales_Return with original sale reference
3. THE Loyalty_API SHALL find original Transaction by МойСклад sale ID
4. IF original transaction not found, THEN THE Loyalty_API SHALL return HTTP 404 Not Found
5. WHEN original transaction was EARN, THE Loyalty_API SHALL deduct returned amount from user's bonus balance
6. THE Loyalty_API SHALL mark original bonuses as expired or reduce their amount
7. WHEN original transaction was SPEND, THE Loyalty_API SHALL return bonuses to user's balance
8. THE Loyalty_API SHALL create new Transaction record with type RETURN
9. THE Loyalty_API SHALL link return transaction to original transaction
10. THE Loyalty_API SHALL return HTTP 201 Created with return transaction details
11. THE Loyalty_API SHALL use database transaction to ensure atomicity
12. THE Loyalty_API SHALL log return operation to API_Log

### Requirement 11: Gift Card Search Endpoint (Optional)

**User Story:** Как MoySklad_POS, я хочу искать подарочные сертификаты, чтобы применять их к продажам.

#### Acceptance Criteria

1. THE Loyalty_API SHALL provide GET endpoint at `/api/moysklad-loyalty/[projectId]/giftcard`
2. THE Loyalty_API SHALL accept query parameter `name` containing gift card code
3. WHERE project has gift card feature enabled, THE Loyalty_API SHALL search for gift card by code
4. THE Loyalty_API SHALL return gift card data including balance and status
5. IF gift card not found, THEN THE Loyalty_API SHALL return empty result
6. THE Loyalty_API SHALL return HTTP 200 OK with gift card data
7. WHERE project does not have gift card feature, THE Loyalty_API SHALL return HTTP 501 Not Implemented

### Requirement 12: API Logging and Monitoring

**User Story:** Как Project_Owner, я хочу видеть историю всех запросов к Loyalty API, чтобы отслеживать операции и диагностировать проблемы.

#### Acceptance Criteria

1. THE Loyalty_API SHALL create API_Log entry for every request
2. THE API_Log SHALL include endpoint path, HTTP method, and timestamp
3. THE API_Log SHALL include request body (sanitized, without sensitive data)
4. THE API_Log SHALL include response status code and body
5. THE API_Log SHALL include processing time in milliseconds
6. WHEN operation fails, THE API_Log SHALL include error message and stack trace
7. THE Bonus_System SHALL display API log on integration settings page
8. THE Bonus_System SHALL allow filtering API_Log by endpoint, status code, and date range
9. THE Bonus_System SHALL display API statistics (total requests, success rate, average response time, last request time)
10. THE Bonus_System SHALL retain API_Log entries for at least 90 days
11. THE Bonus_System SHALL provide export functionality for API logs in CSV format

### Requirement 13: Database Schema

**User Story:** Как система, я хочу хранить данные интеграции в структурированном виде, чтобы обеспечить надежность и производительность.

#### Acceptance Criteria

1. THE Bonus_System SHALL create MoySkladIntegration table with fields: id, projectId, authToken (hashed), baseUrl, bonusPercentage, maxBonusSpend, isActive, lastRequestAt, createdAt, updatedAt
2. THE MoySkladIntegration table SHALL have unique constraint on projectId
3. THE MoySkladIntegration table SHALL have unique constraint on authToken
4. THE Bonus_System SHALL create MoySkladApiLog table with fields: id, integrationId, endpoint, method, requestBody, responseStatus, responseBody, processingTimeMs, errorMessage, createdAt
5. THE MoySkladApiLog table SHALL have index on (integrationId, createdAt)
6. THE MoySkladApiLog table SHALL have index on endpoint
7. THE Bonus_System SHALL add moySkladCounterpartyId field to User table as nullable string
8. THE Bonus_System SHALL add index on User.moySkladCounterpartyId
9. THE authToken field SHALL store hashed value using bcrypt with salt rounds of 10
10. THE requestBody and responseBody fields SHALL use JSON type for flexible storage
11. THE Bonus_System SHALL add moySkladSaleId field to Transaction table for linking to original МойСклад sale

### Requirement 14: User Identification and Linking

**User Story:** Как Loyalty_Service, я хочу идентифицировать пользователей по номеру телефона, чтобы связать их аккаунты между МойСклад и бонусной системой.

#### Acceptance Criteria

1. THE Loyalty_Service SHALL use Phone_Number as the primary identifier for matching users
2. WHEN creating Counterparty, THE Loyalty_Service SHALL normalize Phone_Number to E.164 format
3. THE Loyalty_Service SHALL generate unique МойСклад Counterparty ID for each user
4. THE Loyalty_Service SHALL store Counterparty ID in User.moySkladCounterpartyId field
5. WHEN searching Counterparty, THE Loyalty_Service SHALL search by normalized phone number
6. WHERE card number is provided, THE Loyalty_Service SHALL use it as secondary identifier
7. THE Loyalty_Service SHALL support phone number formats: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX
8. THE Loyalty_Service SHALL validate phone number format before processing
9. IF phone number is invalid, THEN THE Loyalty_Service SHALL return HTTP 400 Bad Request with validation error

### Requirement 15: Telegram Bot Integration

**User Story:** Как пользователь, я хочу видеть свои офлайн покупки в Telegram боте, чтобы отслеживать все бонусные операции в одном месте.

#### Acceptance Criteria

1. WHEN user sends /balance command, THE Telegram_Bot SHALL display balance including bonuses from МойСклад sales
2. WHEN user sends /history command, THE Telegram_Bot SHALL display all transactions including МойСклад sales
3. THE Telegram_Bot SHALL mark МойСклад transactions with special icon or label
4. THE Telegram_Bot SHALL display store name for МойСклад transactions if available
5. WHEN verification code is requested, THE Telegram_Bot SHALL send code to user via Telegram message
6. THE Telegram_Bot SHALL format verification code message with clear instructions
7. THE Telegram_Bot SHALL include expiry time in verification code message

### Requirement 16: Error Handling and Resilience

**User Story:** Как Loyalty_API, я хочу обрабатывать ошибки gracefully, чтобы система оставалась стабильной при проблемах с запросами.

#### Acceptance Criteria

1. WHEN database is unavailable, THE Loyalty_API SHALL return HTTP 503 Service Unavailable
2. THE Loyalty_API SHALL validate all incoming request data against expected schema
3. IF request data is malformed, THEN THE Loyalty_API SHALL return HTTP 400 Bad Request with validation errors
4. THE Loyalty_API SHALL implement request timeout of 30 seconds
5. IF operation exceeds timeout, THEN THE Loyalty_API SHALL return HTTP 504 Gateway Timeout
6. THE Loyalty_API SHALL use database transactions for all operations that modify data
7. IF database transaction fails, THEN THE Loyalty_API SHALL rollback all changes
8. THE Loyalty_API SHALL log all errors with stack trace and context
9. THE Loyalty_API SHALL not expose internal error details in API responses
10. THE Loyalty_API SHALL return user-friendly error messages in Russian
11. WHEN unexpected error occurs, THE Loyalty_API SHALL return HTTP 500 Internal Server Error

### Requirement 17: Performance and Scalability

**User Story:** Как система, я хочу эффективно обрабатывать большие объемы запросов от касс, чтобы не замедлять процесс оформления продаж.

#### Acceptance Criteria

1. THE Loyalty_API SHALL process balance check requests within 500ms for 95th percentile
2. THE Loyalty_API SHALL process recalc requests within 1 second for 95th percentile
3. THE Loyalty_API SHALL process sale creation requests within 2 seconds for 95th percentile
4. THE Loyalty_API SHALL handle at least 100 concurrent requests per project
5. THE Loyalty_API SHALL use database connection pooling with minimum 5 and maximum 20 connections
6. THE Loyalty_API SHALL cache project configuration for 5 minutes to reduce database queries
7. THE Loyalty_API SHALL use database indexes on frequently queried fields (phone, counterpartyId)
8. THE API_Log table SHALL use partitioning by month for efficient querying
9. THE Bonus_System SHALL archive API_Log entries older than 90 days to separate table
10. THE Loyalty_API SHALL implement graceful degradation when under high load

### Requirement 18: Solution Descriptor and Marketplace Integration

**User Story:** Как разработчик, я хочу создать решение в каталоге МойСклад, чтобы пользователи могли легко установить интеграцию.

#### Acceptance Criteria

1. THE Solution_Descriptor SHALL be XML file following МойСклад solution format
2. THE Solution_Descriptor SHALL include `<loyaltyApi/>` block to enable Loyalty API integration
3. THE Solution_Descriptor SHALL specify iframe URL for settings page
4. THE Solution_Descriptor SHALL include solution name, description, and icon
5. THE Solution_Descriptor SHALL specify required permissions (read customers, modify sales)
6. THE Iframe_Settings page SHALL be accessible at `/integrations/moysklad/setup`
7. THE Iframe_Settings page SHALL accept МойСклад context parameters (accountId, userId)
8. THE Iframe_Settings page SHALL allow user to authenticate or register
9. WHEN user completes setup, THE Iframe_Settings page SHALL send baseUrl and authToken to МойСклад via postMessage
10. THE Iframe_Settings page SHALL display success message after configuration is saved

### Requirement 19: Testing and Validation

**User Story:** Как разработчик, я хочу тестировать интеграцию, чтобы убедиться в корректности работы всех endpoints.

#### Acceptance Criteria

1. THE Bonus_System SHALL provide test mode for МойСклад integration
2. WHEN test mode is enabled, THE Loyalty_API SHALL log all requests and responses in detail
3. THE Bonus_System SHALL provide test credentials page with sample Auth_Token
4. THE Bonus_System SHALL provide API documentation page with request/response examples
5. THE Bonus_System SHALL provide Postman collection for testing all endpoints
6. THE Loyalty_API SHALL validate request format and return detailed validation errors
7. THE Bonus_System SHALL provide test data generator for creating sample users and transactions
8. THE Bonus_System SHALL allow Project_Owner to reset test data

### Requirement 20: Request and Response Format Validation

**User Story:** Как Loyalty_API, я хочу валидировать формат запросов и ответов, чтобы обеспечить совместимость с МойСклад.

#### Acceptance Criteria

1. THE Loyalty_API SHALL validate all incoming requests against МойСклад Loyalty API schema
2. THE Loyalty_API SHALL validate required fields are present in request body
3. THE Loyalty_API SHALL validate data types for all fields (string, number, boolean, object, array)
4. IF validation fails, THEN THE Loyalty_API SHALL return HTTP 400 Bad Request with list of validation errors
5. THE Loyalty_API SHALL format all responses according to МойСклад Loyalty API specification
6. THE Loyalty_API SHALL include Content-Type: application/json header in all responses
7. THE Loyalty_API SHALL return consistent error format: `{ error: { message: string, code: string } }`
8. THE Loyalty_API SHALL support both Russian and English error messages based on Accept-Language header

### Requirement 21: Bonus Calculation Rules

**User Story:** Как Loyalty_Service, я хочу применять правильные правила расчета бонусов, чтобы соответствовать настройкам проекта.

#### Acceptance Criteria

1. WHEN calculating earned bonuses, THE Loyalty_Service SHALL apply project's bonusPercentage
2. THE Loyalty_Service SHALL apply BonusBehavior logic (SPEND_AND_EARN, SPEND_ONLY, EARN_ONLY)
3. WHEN BonusBehavior is SPEND_AND_EARN and customer used bonuses, THE Loyalty_Service SHALL calculate earned bonuses on (total - spent bonuses)
4. WHEN BonusBehavior is SPEND_ONLY and customer used bonuses, THE Loyalty_Service SHALL NOT accrue new bonuses
5. WHEN BonusBehavior is EARN_ONLY, THE Loyalty_Service SHALL NOT allow spending bonuses
6. WHEN calculating maximum spendable bonuses, THE Loyalty_Service SHALL apply project's maxBonusSpend percentage
7. THE Loyalty_Service SHALL check user's available balance before allowing bonus spending
8. THE Loyalty_Service SHALL exclude expired bonuses from available balance
9. THE Loyalty_Service SHALL set expiry date for new bonuses based on project's bonusExpiryDays setting
10. THE Loyalty_Service SHALL round bonus amounts to 2 decimal places


