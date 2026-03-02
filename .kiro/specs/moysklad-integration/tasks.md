# Implementation Plan: МойСклад Loyalty API Integration

## Overview

Данный план реализует интеграцию с МойСклад по модели Loyalty API Provider, где МойСклад (кассы/POS-терминалы) вызывают НАШИ HTTP endpoints для расчета скидок, управления бонусами и обработки транзакций в реальном времени во время оформления продаж.

**Язык реализации**: TypeScript (Next.js 15, React 19)

**Архитектурная модель**: Loyalty API Provider (МойСклад вызывает нас, не наоборот)

**Ключевые компоненты**:
- 9 Loyalty API endpoints для интеграции с МойСклад
- Middleware аутентификации с валидацией токенов
- Сервис расчета бонусов с логикой BonusBehavior
- Сервис кодов верификации (SMS/Telegram)
- Инфраструктура логирования API
- UI для настройки и мониторинга интеграции
- Схема БД для конфигурации интеграции
- Интеграция с Telegram ботом для кодов верификации

**Поток интеграции**:
1. Пользователь устанавливает наше решение в маркетплейсе МойСклад
2. Пользователь настраивает интеграцию через iframe (аутентификация)
3. Мы генерируем уникальный auth token и base URL
4. МойСклад сохраняет credentials и вызывает наши endpoints
5. При оформлении продажи МойСклад запрашивает расчет скидок
6. Мы рассчитываем бонусы по правилам проекта
7. МойСклад финализирует продажу, мы создаем транзакцию

## Tasks

- [x] 1. Обновить схему базы данных
  - [x] 1.1 Создать модель MoySkladIntegration в Prisma schema
    - Добавить поля: id, projectId, authToken (hashed), baseUrl, bonusPercentage, maxBonusSpend, isActive, lastRequestAt
    - Добавить unique constraint на projectId
    - Добавить unique constraint на authToken
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [x] 1.2 Создать модель MoySkladApiLog в Prisma schema
    - Добавить поля: id, integrationId, endpoint, method, requestBody, responseStatus, responseBody, processingTimeMs, errorMessage, createdAt
    - Добавить index на (integrationId, createdAt)
    - Добавить index на endpoint
    - Использовать JSON type для requestBody и responseBody
    - _Requirements: 13.4, 13.5, 13.6_
  
  - [x] 1.3 Расширить модель User
    - Добавить поле moySkladCounterpartyId (nullable string)
    - Добавить index на moySkladCounterpartyId
    - _Requirements: 13.7, 13.8_
  
  - [x] 1.4 Расширить модель Transaction
    - Добавить поле moySkladSaleId для связи с оригинальной продажей МойСклад
    - _Requirements: 13.11_
  
  - [x] 1.5 Создать модель VerificationCode
    - Добавить поля: id, userId, code, expiresAt, isUsed, createdAt
    - Добавить index на (userId, isUsed, expiresAt)
    - _Requirements: 6.4_
  
  - [ ] 1.6 Сгенерировать Prisma client и выполнить миграции (ПРОПУЩЕНО - требуется DATABASE_URL)
    - Запустить `npx prisma migrate dev --name moysklad_integration`
    - Проверить успешное применение миграций
    - _Requirements: 13.9_

- [x] 2. Создать TypeScript типы для Loyalty API
  - [x] 2.1 Определить типы запросов и ответов
    - Создать файл `src/lib/moysklad-loyalty/types.ts`
    - Определить CounterpartyRequest, CounterpartyResponse
    - Определить SearchCounterpartyRequest, SearchCounterpartyResponse
    - Определить BalanceRequest, BalanceResponse
    - Определить VerifyRequest, VerifyResponse
    - Определить RecalcRequest, RecalcResponse
    - Определить VerifySpendingRequest, VerifySpendingResponse
    - Определить CreateSaleRequest, CreateSaleResponse
    - Определить CreateReturnRequest, CreateReturnResponse
    - Определить GiftCardSearchRequest, GiftCardSearchResponse
    - _Requirements: 3.3, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2, 20.1, 20.2, 20.3_
  
  - [x] 2.2 Создать Zod схемы для валидации
    - Создать файл `src/lib/moysklad-loyalty/validation.ts`
    - Определить Zod схемы для всех типов запросов
    - Добавить валидацию обязательных полей
    - Добавить валидацию типов данных
    - Добавить валидацию форматов (телефон, email)
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  
  - [x] 2.3 Создать типы ошибок
    - Определить LoyaltyApiError класс
    - Определить стандартный формат ошибок: `{ error: { message: string, code: string } }`
    - Создать константы для кодов ошибок
    - _Requirements: 20.7_

- [x] 3. Реализовать middleware аутентификации
  - [x] 3.1 Создать authentication middleware
    - Создать файл `src/lib/moysklad-loyalty/auth-middleware.ts`
    - Извлекать `Lognex-Discount-API-Auth-Token` из заголовков
    - Валидировать токен против хешированного значения в БД
    - Возвращать 401 если токен невалиден или отсутствует
    - Возвращать 503 если интеграция отключена для проекта
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 3.2 Реализовать rate limiting
    - Добавить rate limiter (1000 запросов/минуту на проект)
    - Возвращать 429 Too Many Requests при превышении лимита
    - Использовать Redis или in-memory store для счетчиков
    - _Requirements: 2.7, 2.8_
  
  - [x] 3.3 Добавить логирование аутентификации
    - Логировать все неудачные попытки аутентификации
    - Включать timestamp и source IP
    - Не раскрывать чувствительные данные в ошибках
    - _Requirements: 2.9, 2.10_

- [x] 4. Реализовать сервис расчета бонусов
  - [x] 4.1 Создать BonusCalculationService
    - Создать файл `src/lib/moysklad-loyalty/bonus-calculation-service.ts`
    - Реализовать метод calculateEarnedBonuses(amount, percentage)
    - Реализовать метод calculateMaxSpendableBonuses(totalAmount, maxSpendPercent, userBalance)
    - Реализовать метод applyBonusBehavior(totalAmount, spentBonuses, bonusPercentage, behavior)
    - Округлять суммы бонусов до 2 знаков после запятой
    - _Requirements: 21.1, 21.9, 21.10_
  
  - [x] 4.2 Реализовать логику BonusBehavior
    - Для SPEND_AND_EARN: начислять на (total - spent bonuses) если бонусы использованы
    - Для SPEND_ONLY: НЕ начислять если бонусы использованы
    - Для EARN_ONLY: НЕ разрешать списание бонусов
    - Для всех режимов: начислять на полную сумму если бонусы НЕ использованы
    - _Requirements: 9.4, 9.5, 9.6, 21.2, 21.3, 21.4, 21.5_
  
  - [x] 4.3 Реализовать проверку доступного баланса
    - Получать текущий баланс пользователя
    - Исключать истекшие бонусы из расчета
    - Проверять достаточность баланса перед списанием
    - _Requirements: 5.5, 5.6, 21.7, 21.8_
  
  - [ ]* 4.4 Написать property тесты для расчета бонусов
    - **Property 1: Earned bonuses never exceed purchase amount**
    - **Validates: Requirements 21.1, 21.10**
    - Генерировать случайные суммы покупок и проценты
    - Проверять что начисленные бонусы <= сумма покупки
  
  - [ ]* 4.5 Написать property тесты для BonusBehavior
    - **Property 2: SPEND_AND_EARN calculates on remainder**
    - **Validates: Requirements 21.3**
    - Проверять что при использовании бонусов начисление идет на (total - spent)
    - **Property 3: SPEND_ONLY never earns when spending**
    - **Validates: Requirements 21.4**
    - Проверять что при использовании бонусов начисление = 0

- [x] 5. Реализовать сервис кодов верификации
  - [x] 5.1 Создать VerificationCodeService
    - Создать файл `src/lib/moysklad-loyalty/verification-code-service.ts`
    - Реализовать метод generateCode() - генерация 6-значного кода
    - Реализовать метод storeCode(userId, code) - сохранение с expiry 5 минут
    - Реализовать метод validateCode(userId, code) - проверка кода
    - Реализовать метод expireCode(userId, code) - пометка кода как использованного
    - _Requirements: 6.3, 6.4, 6.9_
  
  - [x] 5.2 Реализовать отправку кодов
    - Реализовать метод sendViaSMS(phone, code) - отправка через SMS провайдера
    - Реализовать метод sendViaTelegram(userId, code) - отправка через Telegram бота
    - Выбирать метод отправки на основе доступности (телефон или Telegram)
    - Возвращать 400 Bad Request если ни один метод недоступен
    - _Requirements: 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.3 Реализовать rate limiting для кодов
    - Ограничить до 3 запросов на пользователя за 10 минут
    - Возвращать 429 Too Many Requests при превышении
    - _Requirements: 6.10_
  
  - [ ]* 5.4 Написать unit тесты для VerificationCodeService
    - Тестировать генерацию 6-значных кодов
    - Тестировать expiry через 5 минут
    - Тестировать валидацию правильных и неправильных кодов
    - Тестировать rate limiting

- [ ] 6. Реализовать endpoint: Create Counterparty
  - [ ] 6.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/counterparty/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить request body (name, phone, email, cardNumber)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 6.2 Реализовать нормализацию телефона
    - Нормализовать Phone_Number в формат E.164
    - Поддерживать форматы: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX
    - Валидировать формат телефона
    - Возвращать 400 Bad Request при невалидном формате
    - _Requirements: 3.4, 14.2, 14.7, 14.8, 14.9_
  
  - [ ] 6.3 Реализовать создание пользователя
    - Проверять существование пользователя по телефону
    - Возвращать 409 Conflict если пользователь существует
    - Создавать нового пользователя если не существует
    - Генерировать уникальный МойСклад Counterparty ID
    - Сохранять Counterparty ID в User.moySkladCounterpartyId
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 14.3, 14.4_
  
  - [ ] 6.4 Применить приветственные бонусы
    - Проверять настройки проекта (welcomeRewardType, welcomeBonus)
    - Начислять приветственные бонусы если настроено
    - Использовать BonusType.WELCOME
    - Создавать транзакцию типа EARN
    - _Requirements: 3.9_
  
  - [ ] 6.5 Возвращать ответ
    - Возвращать 201 Created с данными пользователя
    - Включать Counterparty ID и начальный баланс
    - Логировать операцию в MoySkladApiLog
    - _Requirements: 3.10, 3.11_

- [ ] 7. Реализовать endpoint: Search Counterparty
  - [ ] 7.1 Создать GET handler
    - Добавить GET handler в `src/app/api/moysklad-loyalty/[projectId]/counterparty/route.ts`
    - Применить authentication middleware
    - Извлекать query параметр `search`
    - Извлекать опциональный параметр `retailStoreId`
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 7.2 Реализовать поиск пользователей
    - Нормализовать search параметр если это телефон
    - Искать по phone или cardNumber в БД
    - Фильтровать по projectId для мультитенантности
    - Возвращать массив найденных пользователей
    - _Requirements: 4.4, 4.5, 4.8_
  
  - [ ] 7.3 Форматировать ответ
    - Возвращать формат `{ rows: [{ id, name, phone, email, cardNumber }] }`
    - Возвращать пустой массив если ничего не найдено
    - Возвращать 200 OK
    - Логировать операцию поиска
    - _Requirements: 4.6, 4.7, 4.9, 4.10_

- [ ] 8. Реализовать endpoint: Get Counterparty Balance
  - [ ] 8.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/counterparty/detail/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить request body с `meta.id` (Counterparty ID)
    - _Requirements: 5.1, 5.2_
  
  - [ ] 8.2 Реализовать получение баланса
    - Найти пользователя по МойСклад Counterparty ID
    - Возвращать 404 Not Found если пользователь не найден
    - Рассчитать текущий баланс суммированием активных бонусов
    - Исключить истекшие бонусы из расчета
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  
  - [ ] 8.3 Форматировать и возвращать ответ
    - Возвращать формат `{ bonusProgram: { agentBonusBalance: <amount> } }`
    - Возвращать 200 OK
    - Обеспечить время ответа < 500ms для 95-го перцентиля
    - Логировать операцию проверки баланса
    - _Requirements: 5.7, 5.8, 5.9, 5.10_

- [ ] 9. Реализовать endpoint: Request Verification Code
  - [ ] 9.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/counterparty/verify/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить request body с Counterparty ID и operation type
    - _Requirements: 6.1, 6.2_
  
  - [ ] 9.2 Реализовать генерацию и отправку кода
    - Найти пользователя по Counterparty ID
    - Генерировать 6-значный код верификации
    - Сохранять код с expiry 5 минут
    - Отправлять код через SMS или Telegram
    - Возвращать 400 Bad Request если нет способа отправки
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [ ] 9.3 Применить rate limiting
    - Проверять лимит 3 запроса на пользователя за 10 минут
    - Возвращать 429 Too Many Requests при превышении
    - Возвращать 200 OK с сообщением об отправке
    - _Requirements: 6.8, 6.9, 6.10_

- [ ] 10. Реализовать endpoint: Calculate Discounts (Recalc)
  - [ ] 10.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/retaildemand/recalc/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить Recalc_Request (agent, positions, transactionType)
    - _Requirements: 7.1, 7.2_
  
  - [ ] 10.2 Реализовать расчет для EARNING
    - Когда transactionType = EARNING, рассчитать начисляемые бонусы
    - Применить процент бонусов из настроек проекта
    - Использовать BonusCalculationService
    - _Requirements: 7.3_
  
  - [ ] 10.3 Реализовать расчет для SPENDING
    - Когда transactionType = SPENDING, рассчитать максимум списываемых бонусов
    - Применить лимит maxBonusSpend из настроек проекта
    - Проверить текущий баланс пользователя
    - Ограничить до доступного баланса если запрошено больше
    - _Requirements: 7.4, 7.5, 7.6, 7.7_
  
  - [ ] 10.4 Рассчитать скидки по позициям
    - Распределить скидку пропорционально по позициям
    - Вернуть массив positions с discount значениями
    - _Requirements: 7.8, 7.9_
  
  - [ ] 10.5 Форматировать и возвращать ответ
    - Вернуть positions с рассчитанными скидками
    - Вернуть bonusProgram с earnedBonus или spentBonus
    - Возвращать 200 OK
    - Обеспечить время ответа < 1 секунды для 95-го перцентиля
    - Логировать операцию расчета
    - _Requirements: 7.10, 7.11, 7.12, 7.13_

- [ ] 11. Реализовать endpoint: Verify Bonus Spending
  - [ ] 11.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/retaildemand/verify/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить Verify_Request (Counterparty ID, bonus amount, verification code)
    - _Requirements: 8.1, 8.2_
  
  - [ ] 11.2 Реализовать валидацию кода
    - Валидировать код верификации через VerificationCodeService
    - Возвращать 403 Forbidden если код невалиден или истек
    - Пометить код как использованный после успешной валидации
    - _Requirements: 8.3, 8.4, 8.9_
  
  - [ ] 11.3 Реализовать проверку баланса
    - Проверить достаточность баланса пользователя
    - Возвращать 400 Bad Request если баланс недостаточен
    - Зарезервировать бонусы для списания (пометить как pending)
    - _Requirements: 8.5, 8.6, 8.7_
  
  - [ ] 11.4 Возвращать подтверждение
    - Возвращать 200 OK с подтверждением
    - Логировать операцию верификации
    - _Requirements: 8.8, 8.10_

- [ ] 12. Реализовать endpoint: Create Sale (Finalize Transaction)
  - [ ] 12.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/retaildemand/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить request с Retail_Demand (agent, positions, sum, transactionType)
    - _Requirements: 9.1, 9.2_
  
  - [ ] 12.2 Реализовать начисление бонусов (EARNING)
    - Когда transactionType = EARNING, рассчитать бонусы
    - Применить логику BonusBehavior из настроек проекта
    - Для SPEND_AND_EARN: начислять на (sum - spent bonuses) если бонусы использованы
    - Для SPEND_ONLY: НЕ начислять если бонусы использованы
    - Для всех режимов: начислять на полную сумму если бонусы НЕ использованы
    - _Requirements: 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 12.3 Создать записи бонусов и транзакций (EARNING)
    - Создать Bonus запись с expiry датой из настроек проекта
    - Создать Transaction запись с типом EARN
    - Сохранить МойСклад sale ID в Transaction.moySkladSaleId
    - _Requirements: 9.7, 9.8_
  
  - [ ] 12.4 Реализовать списание бонусов (SPENDING)
    - Когда transactionType = SPENDING, списать бонусы с баланса
    - Создать Transaction запись с типом SPEND
    - Освободить зарезервированные бонусы из verify шага
    - _Requirements: 9.9, 9.10, 9.11_
  
  - [ ] 12.5 Обеспечить атомарность операции
    - Использовать database transaction для всех изменений
    - Откатить все изменения при ошибке
    - Возвращать 500 Internal Server Error при сбое
    - _Requirements: 9.13, 9.14_
  
  - [ ] 12.6 Возвращать ответ
    - Возвращать 201 Created с деталями транзакции
    - Логировать операцию продажи с полными данными
    - _Requirements: 9.12, 9.15_

- [ ] 13. Реализовать endpoint: Create Return
  - [ ] 13.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/retailsalesreturn/route.ts`
    - Реализовать POST handler
    - Применить authentication middleware
    - Парсить request с Retail_Sales_Return и ссылкой на оригинальную продажу
    - _Requirements: 10.1, 10.2_
  
  - [ ] 13.2 Найти оригинальную транзакцию
    - Найти оригинальную Transaction по МойСклад sale ID
    - Возвращать 404 Not Found если транзакция не найдена
    - _Requirements: 10.3, 10.4_
  
  - [ ] 13.3 Реверсировать начисление бонусов (EARN)
    - Когда оригинальная транзакция была EARN, вычесть возвращаемую сумму
    - Пометить оригинальные бонусы как истекшие или уменьшить их сумму
    - _Requirements: 10.5, 10.6_
  
  - [ ] 13.4 Реверсировать списание бонусов (SPEND)
    - Когда оригинальная транзакция была SPEND, вернуть бонусы на баланс
    - _Requirements: 10.7_
  
  - [ ] 13.5 Создать транзакцию возврата
    - Создать новую Transaction запись с типом RETURN
    - Связать с оригинальной транзакцией
    - Использовать database transaction для атомарности
    - _Requirements: 10.8, 10.9, 10.11_
  
  - [ ] 13.6 Возвращать ответ
    - Возвращать 201 Created с деталями возврата
    - Логировать операцию возврата
    - _Requirements: 10.10, 10.12_

- [ ] 14. Реализовать endpoint: Gift Card Search (Optional)
  - [ ] 14.1 Создать route handler
    - Создать файл `src/app/api/moysklad-loyalty/[projectId]/giftcard/route.ts`
    - Реализовать GET handler
    - Применить authentication middleware
    - Извлекать query параметр `name` (gift card code)
    - _Requirements: 11.1, 11.2_
  
  - [ ] 14.2 Реализовать поиск подарочных карт
    - Проверить включена ли функция gift cards в проекте
    - Возвращать 501 Not Implemented если функция отключена
    - Искать gift card по коду
    - Возвращать данные карты (balance, status)
    - _Requirements: 11.3, 11.4, 11.7_
  
  - [ ] 14.3 Возвращать ответ
    - Возвращать пустой результат если карта не найдена
    - Возвращать 200 OK с данными карты
    - _Requirements: 11.5, 11.6_

- [ ] 15. Checkpoint - Ensure all API endpoints pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Реализовать API logging infrastructure
  - [x] 16.1 Создать API logging service
    - Создать файл `src/lib/moysklad-loyalty/api-logger.ts`
    - Реализовать метод logRequest(integrationId, endpoint, method, requestBody)
    - Реализовать метод logResponse(logId, status, responseBody, processingTime)
    - Реализовать метод logError(logId, errorMessage, stackTrace)
    - Санитизировать чувствительные данные перед логированием
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [ ] 16.2 Интегрировать логирование во все endpoints
    - Добавить логирование в начале каждого endpoint handler
    - Логировать время обработки в миллисекундах
    - Логировать ошибки со stack trace
    - _Requirements: 12.1, 12.5, 12.6_
  
  - [x] 16.3 Реализовать retention policy
    - Хранить API_Log записи минимум 90 дней
    - Создать скрипт архивации старых записей
    - _Requirements: 12.10_

- [ ] 17. Реализовать UI для настройки интеграции
  - [ ] 17.1 Создать страницу настроек интеграции
    - Создать файл `src/app/dashboard/projects/[id]/integrations/moysklad/page.tsx`
    - Реализовать Server Component для загрузки данных
    - Загрузить конфигурацию интеграции из БД
    - Применить owner filter для мультитенантности
    - Отобразить статус интеграции и статистику
    - _Requirements: 1.1, 1.10, 12.7_
  
  - [ ] 17.2 Создать форму активации интеграции
    - Создать Client Component для формы
    - Добавить поля: bonusPercentage, maxBonusSpend
    - Добавить toggle для включения/отключения интеграции
    - Реализовать валидацию формы с Zod
    - _Requirements: 1.2, 1.7, 1.8_
  
  - [ ] 17.3 Реализовать генерацию credentials
    - При активации генерировать уникальный Auth_Token
    - Хешировать токен с помощью bcrypt (10 salt rounds)
    - Генерировать Base_URL в формате `https://gupil.ru/api/moysklad-loyalty/[projectId]`
    - Отображать Auth_Token и Base_URL для копирования
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 13.9_
  
  - [ ] 17.4 Реализовать регенерацию токена
    - Добавить кнопку "Regenerate Token"
    - Генерировать новый токен при нажатии
    - Показывать предупреждение о необходимости обновить токен в МойСклад
    - _Requirements: 1.5_
  
  - [ ] 17.5 Отображать статус интеграции
    - Показывать статус: active, inactive
    - Показывать время последнего запроса (lastRequestAt)
    - Показывать статистику: total requests, success rate, average response time
    - _Requirements: 1.9, 1.10, 12.9_

- [ ] 18. Реализовать UI для мониторинга API логов
  - [ ] 18.1 Создать компонент истории API запросов
    - Создать Client Component `ApiLogHistory`
    - Загрузить MoySkladApiLog записи с пагинацией
    - Отобразить таблицу с колонками: timestamp, endpoint, method, status, processing time
    - _Requirements: 12.7_
  
  - [ ] 18.2 Реализовать фильтрацию логов
    - Добавить фильтры: endpoint, status code, date range
    - Реализовать поиск по endpoint
    - Обновлять таблицу при изменении фильтров
    - _Requirements: 12.8_
  
  - [ ] 18.3 Добавить детальный просмотр запросов
    - Сделать строки таблицы раскрываемыми
    - Показывать request body и response body в раскрытой строке
    - Форматировать JSON для читаемости
    - Показывать error message и stack trace при ошибках
    - _Requirements: 12.2, 12.3, 12.4, 12.6_
  
  - [ ] 18.4 Реализовать экспорт логов
    - Добавить кнопку "Export to CSV"
    - Экспортировать отфильтрованные логи в CSV формат
    - Включать все поля кроме чувствительных данных
    - _Requirements: 12.11_

- [ ] 19. Интегрировать с Telegram ботом
  - [ ] 19.1 Расширить команду /balance
    - Модифицировать обработчик команды /balance
    - Отображать баланс включая бонусы из МойСклад транзакций
    - Форматировать баланс с символом валюты из настроек проекта
    - _Requirements: 15.1, 15.4_
  
  - [ ] 19.2 Расширить команду /history
    - Модифицировать обработчик команды /history
    - Отображать все транзакции включая МойСклад продажи
    - Помечать МойСклад транзакции специальной иконкой (🏪)
    - Отображать название магазина если доступно
    - _Requirements: 15.2, 15.3, 15.4_
  
  - [ ] 19.3 Реализовать отправку кодов верификации
    - Создать метод sendVerificationCode(userId, code)
    - Форматировать сообщение с кодом и инструкциями
    - Включать время истечения кода (5 минут)
    - _Requirements: 15.5, 15.6, 15.7_
  
  - [ ]* 19.4 Написать integration тесты для Telegram бота
    - Тестировать /balance с МойСклад транзакциями
    - Тестировать /history с МойСклад транзакциями
    - Тестировать отправку кодов верификации

- [ ] 20. Реализовать обработку ошибок и resilience
  - [ ] 20.1 Реализовать валидацию входящих данных
    - Валидировать все входящие запросы против Zod схем
    - Возвращать 400 Bad Request с детальными ошибками валидации
    - Логировать ошибки валидации
    - _Requirements: 16.2, 16.3, 20.4_
  
  - [ ] 20.2 Реализовать обработку недоступности БД
    - Возвращать 503 Service Unavailable при недоступности БД
    - Логировать ошибки подключения к БД
    - _Requirements: 16.1_
  
  - [ ] 20.3 Реализовать timeouts
    - Установить timeout 30 секунд для всех операций
    - Возвращать 504 Gateway Timeout при превышении
    - _Requirements: 16.4, 16.5_
  
  - [ ] 20.4 Реализовать database transactions
    - Использовать Prisma transactions для всех операций изменения данных
    - Откатывать все изменения при ошибке
    - _Requirements: 16.6, 16.7_
  
  - [ ] 20.5 Реализовать user-friendly ошибки
    - Не раскрывать внутренние детали ошибок в API ответах
    - Возвращать понятные сообщения на русском языке
    - Возвращать 500 Internal Server Error для неожиданных ошибок
    - _Requirements: 16.8, 16.9, 16.10, 16.11, 20.8_
  
  - [ ]* 20.6 Написать тесты для error scenarios
    - Тестировать обработку невалидных данных
    - Тестировать обработку недоступности БД
    - Тестировать timeout behavior
    - Тестировать rollback при ошибках

- [ ] 21. Реализовать оптимизации производительности
  - [ ] 21.1 Оптимизировать запросы к БД
    - Добавить индексы на часто запрашиваемые поля
    - Использовать database connection pooling (min 5, max 20)
    - Оптимизировать запросы баланса для < 500ms (95-й перцентиль)
    - _Requirements: 17.1, 17.5, 17.7_
  
  - [ ] 21.2 Реализовать кеширование конфигурации
    - Кешировать конфигурацию проекта на 5 минут
    - Инвалидировать кеш при изменении настроек
    - _Requirements: 17.6_
  
  - [ ] 21.3 Оптимизировать обработку запросов
    - Обеспечить время ответа < 1 секунды для recalc (95-й перцентиль)
    - Обеспечить время ответа < 2 секунд для create sale (95-й перцентиль)
    - Поддерживать минимум 100 concurrent requests на проект
    - _Requirements: 17.2, 17.3, 17.4_
  
  - [ ] 21.4 Реализовать партиционирование логов
    - Использовать партиционирование по месяцам для MoySkladApiLog
    - Архивировать записи старше 90 дней
    - _Requirements: 17.8, 17.9_
  
  - [ ] 21.5 Реализовать graceful degradation
    - Продолжать работу при высокой нагрузке
    - Приоритизировать критичные операции
    - _Requirements: 17.10_

- [ ] 22. Создать Solution Descriptor для маркетплейса МойСклад
  - [ ] 22.1 Создать XML файл решения
    - Создать файл `public/moysklad/solution-descriptor.xml`
    - Следовать формату МойСклад solution
    - Включить блок `<loyaltyApi/>` для включения Loyalty API интеграции
    - Указать iframe URL для страницы настроек
    - _Requirements: 18.1, 18.2, 18.3_
  
  - [ ] 22.2 Добавить метаданные решения
    - Указать название решения, описание, иконку
    - Указать требуемые разрешения (read customers, modify sales)
    - _Requirements: 18.4, 18.5_
  
  - [ ] 22.3 Создать iframe страницу настройки
    - Создать страницу `/integrations/moysklad/setup`
    - Принимать МойСклад context параметры (accountId, userId)
    - Реализовать аутентификацию или регистрацию пользователя
    - _Requirements: 18.6, 18.7, 18.8_
  
  - [ ] 22.4 Реализовать отправку credentials в МойСклад
    - После завершения настройки отправлять baseUrl и authToken через postMessage
    - Отображать сообщение об успехе
    - _Requirements: 18.9, 18.10_

- [ ] 23. Реализовать тестирование и валидацию
  - [ ] 23.1 Создать test mode для интеграции
    - Добавить флаг testMode в MoySkladIntegration
    - Логировать все запросы и ответы детально в test mode
    - _Requirements: 19.1, 19.2_
  
  - [ ] 23.2 Создать страницу тестовых credentials
    - Отображать sample Auth_Token для тестирования
    - Предоставлять примеры запросов и ответов
    - _Requirements: 19.3, 19.4_
  
  - [ ] 23.3 Создать API документацию
    - Создать страницу с документацией всех endpoints
    - Включить примеры request/response для каждого endpoint
    - _Requirements: 19.4_
  
  - [ ] 23.4 Создать Postman коллекцию
    - Экспортировать все endpoints в Postman коллекцию
    - Включить примеры для всех операций
    - Добавить environment variables для baseUrl и authToken
    - _Requirements: 19.5_
  
  - [ ] 23.5 Реализовать детальную валидацию
    - Валидировать формат всех запросов
    - Возвращать детальные ошибки валидации
    - _Requirements: 19.6, 20.1, 20.2, 20.3_
  
  - [ ] 23.6 Создать test data generator
    - Реализовать генератор тестовых пользователей и транзакций
    - Добавить функцию сброса тестовых данных
    - _Requirements: 19.7, 19.8_

- [ ] 24. Checkpoint - Ensure all components integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Финальная интеграция и тестирование
  - [ ] 25.1 Интегрировать все компоненты
    - Подключить все endpoints к authentication middleware
    - Подключить все endpoints к API logger
    - Подключить UI формы к API routes
    - Подключить Telegram бота к VerificationCodeService
    - Обеспечить правильное распространение ошибок
    - _Requirements: All_
  
  - [ ]* 25.2 Написать end-to-end integration тесты
    - Тестировать полный flow создания покупателя
    - Тестировать полный flow расчета и создания продажи
    - Тестировать полный flow возврата
    - Тестировать flow верификации с кодом
    - Тестировать интеграцию с Telegram ботом
  
  - [ ]* 25.3 Выполнить load testing
    - Тестировать endpoint баланса с 100 concurrent requests
    - Тестировать endpoint recalc с высокой нагрузкой
    - Проверить 95-й перцентиль времени ответа < 2 секунд
    - Проверить rate limiting работает корректно
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [ ]* 25.4 Выполнить security testing
    - Тестировать аутентификацию с невалидными токенами
    - Тестировать rate limiting
    - Тестировать SQL injection защиту
    - Тестировать XSS защиту в UI
    - Проверить что чувствительные данные не логируются

- [ ] 26. Документация и deployment
  - [ ] 26.1 Создать руководство по интеграции
    - Создать файл `docs/moysklad-loyalty-api-integration.md`
    - Описать процесс установки решения из маркетплейса МойСклад
    - Описать процесс настройки интеграции через UI
    - Добавить примеры запросов и ответов для всех endpoints
    - Добавить troubleshooting секцию
  
  - [ ] 26.2 Обновить API документацию
    - Добавить описание всех 9 Loyalty API endpoints в `docs/api.md`
    - Документировать форматы запросов и ответов
    - Документировать коды ошибок
    - Добавить примеры использования
  
  - [ ] 26.3 Создать changelog entry
    - Добавить запись в `docs/changelog.md`
    - Описать новую функциональность МойСклад интеграции
    - Перечислить все 9 реализованных endpoints
    - Указать дату релиза
  
  - [ ] 26.4 Обновить tasktracker
    - Отметить задачу МойСклад интеграции как завершенную
    - Добавить метрики: затраченное время, сложность
    - Добавить ссылки на документацию

- [ ] 27. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Задачи помеченные `*` являются опциональными и могут быть пропущены для быстрого MVP
- Каждая задача ссылается на конкретные requirements для трассируемости
- Checkpoints обеспечивают инкрементальную валидацию на ключевых этапах
- Property тесты валидируют универсальные свойства корректности
- Unit тесты валидируют конкретные примеры и граничные случаи
- Integration тесты валидируют взаимодействие компонентов
- Реализация следует паттерну Server Components First для UI
- Все чувствительные данные (auth tokens) должны быть хешированы перед сохранением
- Мультитенантная безопасность (owner filter) должна применяться ко всем запросам к БД
- Rate limiting защищает от злоупотреблений
- Комплексное логирование обеспечивает debugging и мониторинг
- Все endpoints должны возвращать user-friendly ошибки на русском языке

## Ключевые отличия от старой архитектуры

**СТАРАЯ архитектура (НЕПРАВИЛЬНО)**:
- МЫ вызывали API МойСклад
- МЫ получали webhooks от МойСклад
- МЫ синхронизировали данные между системами
- Требовался МойСклад API client

**НОВАЯ архитектура (ПРАВИЛЬНО)**:
- МойСклад вызывает НАШИ endpoints
- МЫ предоставляем Loyalty API для МойСклад
- МЫ рассчитываем скидки и бонусы в реальном времени
- НЕ требуется МойСклад API client
- НЕ требуются webhooks от МойСклад
- НЕ требуется синхронизация балансов

## Архитектурная модель: Loyalty API Provider

```
┌─────────────────────────────────────────────────────────────┐
│                    МойСклад (POS/Касса)                      │
│                                                               │
│  При оформлении продажи:                                      │
│  1. Кассир вводит номер телефона покупателя                  │
│  2. МойСклад вызывает наш API для поиска покупателя          │
│  3. МойСклад вызывает наш API для получения баланса          │
│  4. МойСклад вызывает наш API для расчета скидок             │
│  5. Покупатель подтверждает списание (код верификации)       │
│  6. МойСклад вызывает наш API для финализации продажи        │
│                                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS POST/GET
                        │ Lognex-Discount-API-Auth-Token: <token>
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Наша система (Loyalty API Provider)             │
│                                                               │
│  Endpoints:                                                   │
│  POST /api/moysklad-loyalty/[projectId]/counterparty         │
│  GET  /api/moysklad-loyalty/[projectId]/counterparty         │
│  POST /api/moysklad-loyalty/[projectId]/counterparty/detail  │
│  POST /api/moysklad-loyalty/[projectId]/counterparty/verify  │
│  POST /api/moysklad-loyalty/[projectId]/retaildemand/recalc  │
│  POST /api/moysklad-loyalty/[projectId]/retaildemand/verify  │
│  POST /api/moysklad-loyalty/[projectId]/retaildemand         │
│  POST /api/moysklad-loyalty/[projectId]/retailsalesreturn    │
│  GET  /api/moysklad-loyalty/[projectId]/giftcard             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Критичные моменты реализации

### 1. BonusBehavior логика (КРИТИЧНО)
При реализации endpoint Create Sale (задача 12.2) необходимо правильно применить логику BonusBehavior:

```typescript
// Псевдокод для расчета начисляемых бонусов
function calculateEarnedBonuses(
  totalAmount: number,
  spentBonuses: number,
  bonusPercentage: number,
  bonusBehavior: BonusBehavior
): number {
  // Если клиент НЕ использовал бонусы
  if (spentBonuses === 0) {
    // Все режимы: начисляем на полную сумму
    return totalAmount * (bonusPercentage / 100);
  }
  
  // Если клиент использовал бонусы
  switch (bonusBehavior) {
    case 'SPEND_AND_EARN':
      // Начисляем на остаток (сумма - списанные бонусы)
      return (totalAmount - spentBonuses) * (bonusPercentage / 100);
    
    case 'SPEND_ONLY':
      // НЕ начисляем
      return 0;
    
    case 'EARN_ONLY':
      // Не должно произойти (бонусы нельзя тратить)
      throw new Error('Cannot spend bonuses in EARN_ONLY mode');
  }
}
```

### 2. Приветственные бонусы
При создании нового покупателя (задача 6.4) автоматически начислять приветственные бонусы если настроено в проекте. Логика уже реализована в `UserService.createUser`, но нужно убедиться что она вызывается.

### 3. Нормализация телефонов
Все телефоны должны нормализоваться в формат E.164 (+7XXXXXXXXXX) перед сохранением и поиском. Поддерживать форматы: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX.

### 4. Аутентификация
Все endpoints должны проверять заголовок `Lognex-Discount-API-Auth-Token` и валидировать его против хешированного значения в БД (bcrypt).

### 5. Мультитенантность
Все запросы к БД должны фильтроваться по projectId для изоляции данных между клиентами.

### 6. Логирование
Каждый запрос к Loyalty API должен логироваться в MoySkladApiLog с полными деталями (request, response, processing time, errors).

### 7. Коды верификации
Коды верификации должны:
- Быть 6-значными
- Истекать через 5 минут
- Отправляться через SMS или Telegram
- Ограничиваться 3 запросами на пользователя за 10 минут
- Помечаться как использованные после успешной валидации

### 8. Performance требования
- Balance check: < 500ms (95-й перцентиль)
- Recalc: < 1 секунда (95-й перцентиль)
- Create sale: < 2 секунды (95-й перцентиль)
- Поддержка минимум 100 concurrent requests на проект
