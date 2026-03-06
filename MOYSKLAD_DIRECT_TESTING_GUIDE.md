# МойСклад Direct Integration - Руководство по тестированию

## Статус реализации

✅ **Завершено:**
- Task 1: Database schema и encryption
- Task 2: МойСклад API client
- Task 3: Sync service
- Task 5: Webhook handler
- Task 6: Integration management API routes
- Task 8 (частично): UI компоненты (status card, form, webhook credentials, stats cards, logs table)

⏳ **В процессе:**
- Task 8: Оставшиеся UI компоненты
- Task 9: Telegram bot integration
- Task 10: Интеграция с BonusService

## Подготовка к тестированию

### 1. Обновить Prisma Client

```powershell
# Сгенерировать Prisma Client с новыми моделями
npx prisma generate

# Создать миграцию (если еще не создана)
npx prisma migrate dev --name moysklad_direct_integration
```

### 2. Установить переменные окружения

Добавьте в `.env.local`:

```env
# МойСклад Direct Integration
MOYSKLAD_ENCRYPTION_KEY=your-strong-random-key-32-chars-minimum

# Базовый URL приложения (для webhook URL)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Важно:** Используйте сильный случайный ключ для `MOYSKLAD_ENCRYPTION_KEY`. Пример генерации:

```powershell
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3. Запустить dev сервер

```powershell
yarn dev
```

## Тестирование API endpoints

### 1. Создание интеграции

```powershell
# Замените [PROJECT_ID] на реальный ID проекта
$projectId = "your-project-id"

# Создать интеграцию
$body = @{
    accountId = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    apiToken = "your-moysklad-bearer-token"
    bonusProgramId = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    syncDirection = "BIDIRECTIONAL"
    autoSync = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
```

### 2. Получение интеграции

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct" `
    -Method GET
```

### 3. Тест подключения

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct/test" `
    -Method POST
```

### 4. Обновление интеграции

```powershell
$updateBody = @{
    syncDirection = "MOYSKLAD_TO_US"
    autoSync = $false
    isActive = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct" `
    -Method PUT `
    -Headers @{"Content-Type"="application/json"} `
    -Body $updateBody
```

### 5. Ручная синхронизация

```powershell
# Синхронизация всех пользователей
Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct/sync" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body "{}"

# Синхронизация конкретного пользователя
$syncBody = @{
    userId = "user-id-here"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct/sync" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $syncBody
```

### 6. Получение логов синхронизации

```powershell
# Все логи
Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct/logs"

# С фильтрами
$params = @{
    operation = "bonus_accrual"
    status = "success"
    limit = 10
}
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
Invoke-RestMethod -Uri "http://localhost:3000/api/projects/$projectId/integrations/moysklad-direct/logs?$query"
```

## Тестирование UI

### 1. Открыть страницу интеграции

Перейдите в браузере:
```
http://localhost:3000/dashboard/projects/[PROJECT_ID]/integrations/moysklad-direct
```

### 2. Проверить компоненты

- ✅ **IntegrationStatusCard**: Отображает статус, последнюю синхронизацию, ошибки
- ✅ **IntegrationForm**: Форма с валидацией UUID, выбор направления синхронизации
- ✅ **WebhookCredentials**: Отображение URL и secret с кнопками копирования
- ✅ **SyncStatsCards**: 4 карточки со статистикой (анимация stagger)
- ✅ **SyncLogsTable**: Таблица последних 10 синхронизаций

### 3. Тестовые сценарии UI

1. **Создание интеграции:**
   - Заполните форму с валидными UUID
   - Проверьте валидацию (невалидные UUID должны показывать ошибку)
   - Нажмите "Создать"
   - Проверьте, что появился webhook secret

2. **Тест подключения:**
   - Нажмите кнопку "Проверить подключение" в IntegrationStatusCard
   - Проверьте toast уведомление с результатом

3. **Ручная синхронизация:**
   - Нажмите кнопку "Синхронизировать"
   - Проверьте прогресс и результат

4. **Копирование credentials:**
   - Нажмите кнопку копирования для webhook URL
   - Нажмите кнопку показа/скрытия secret
   - Нажмите кнопку копирования secret

## Тестирование webhook

### 1. Настроить ngrok (для локального тестирования)

```powershell
# Установить ngrok (если еще не установлен)
# https://ngrok.com/download

# Запустить туннель
ngrok http 3000
```

Используйте ngrok URL вместо localhost в webhook URL.

### 2. Создать тестовый webhook запрос

```powershell
# Пример webhook payload от МойСклад
$webhookPayload = @{
    action = "CREATE"
    events = @(
        @{
            meta = @{
                href = "https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction/test-transaction-id"
                type = "bonustransaction"
            }
            action = "CREATE"
            accountId = "your-account-id"
        }
    )
} | ConvertTo-Json -Depth 10

# Вычислить HMAC-SHA256 подпись
$secret = "your-webhook-secret"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$signature = [BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($webhookPayload))).Replace("-", "").ToLower()

# Отправить webhook
Invoke-RestMethod -Uri "http://localhost:3000/api/webhook/moysklad-direct/$projectId" `
    -Method POST `
    -Headers @{
        "Content-Type"="application/json"
        "X-MoySklad-Signature"=$signature
    } `
    -Body $webhookPayload
```

## Тестирование encryption

### 1. Тест шифрования/дешифрования

```typescript
// Создайте файл scripts/test-moysklad-encryption.ts
import { encryptApiToken, decryptApiToken, testEncryption } from '@/lib/moysklad-direct/encryption';

console.log('Testing encryption...');

// Тест 1: Round-trip
const testToken = 'test-api-token-12345';
const encrypted = encryptApiToken(testToken);
console.log('Encrypted:', encrypted);

const decrypted = decryptApiToken(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testToken === decrypted);

// Тест 2: Встроенный тест
const result = testEncryption();
console.log('Built-in test:', result ? 'PASSED' : 'FAILED');
```

Запустить:
```powershell
npx tsx scripts/test-moysklad-encryption.ts
```

## Тестирование sync service

### 1. Тест синхронизации начисления

```typescript
// scripts/test-moysklad-sync.ts
import { SyncService } from '@/lib/moysklad-direct/sync-service';

const syncService = new SyncService();

// Тест начисления
await syncService.syncBonusAccrualToMoySklad({
  userId: 'test-user-id',
  amount: 100,
  source: 'test_purchase',
  description: 'Test bonus accrual'
});
```

### 2. Тест проверки баланса

```typescript
const result = await syncService.checkAndSyncBalance('test-user-id');
console.log('Balance check result:', result);
```

## Проверка TypeScript ошибок

```powershell
# Проверить типы
npx tsc --noEmit

# Если есть ошибки с Prisma Client, запустите:
npx prisma generate
```

## Известные проблемы и решения

### 1. Prisma Client не обновлен

**Проблема:** Ошибки типа "Property 'moySkladDirectIntegration' does not exist"

**Решение:**
```powershell
npx prisma generate
```

### 2. Ошибка шифрования

**Проблема:** "MOYSKLAD_ENCRYPTION_KEY not set"

**Решение:** Добавьте переменную в `.env.local`

### 3. Webhook signature validation fails

**Проблема:** 401 Unauthorized при отправке webhook

**Решение:** Проверьте правильность вычисления HMAC-SHA256 подписи

## Следующие шаги

После успешного тестирования API и UI:

1. ✅ Завершить Task 8 (оставшиеся UI компоненты)
2. ⏳ Task 9: Интеграция с Telegram ботом
3. ⏳ Task 10: Хуки в BonusService
4. ⏳ Task 11-16: Оптимизация, документация, деплой

## Контрольный список тестирования

### API Routes
- [ ] POST /api/projects/[id]/integrations/moysklad-direct (создание)
- [ ] GET /api/projects/[id]/integrations/moysklad-direct (получение)
- [ ] PUT /api/projects/[id]/integrations/moysklad-direct (обновление)
- [ ] DELETE /api/projects/[id]/integrations/moysklad-direct (удаление)
- [ ] POST /api/projects/[id]/integrations/moysklad-direct/test (тест подключения)
- [ ] POST /api/projects/[id]/integrations/moysklad-direct/sync (ручная синхронизация)
- [ ] GET /api/projects/[id]/integrations/moysklad-direct/logs (логи)
- [ ] POST /api/webhook/moysklad-direct/[projectId] (webhook)

### UI Components
- [ ] IntegrationStatusCard отображается корректно
- [ ] IntegrationForm валидирует UUID
- [ ] WebhookCredentials копирует URL и secret
- [ ] SyncStatsCards показывает статистику
- [ ] SyncLogsTable отображает логи

### Функциональность
- [ ] Encryption/decryption работает
- [ ] МойСклад API client подключается
- [ ] Sync service синхронизирует бонусы
- [ ] Webhook обрабатывает события
- [ ] Balance check работает

## Полезные команды

```powershell
# Проверить логи
Get-Content .next/server/app/api/projects/[id]/integrations/moysklad-direct/route.js

# Проверить базу данных
npx prisma studio

# Очистить кеш Next.js
Remove-Item -Recurse -Force .next

# Перезапустить dev сервер
yarn dev
```

## Поддержка

При возникновении проблем:
1. Проверьте логи в консоли браузера (F12)
2. Проверьте логи сервера в терминале
3. Проверьте Prisma Studio для данных БД
4. Проверьте переменные окружения

