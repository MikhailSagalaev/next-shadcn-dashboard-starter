# МойСклад Direct API - Быстрый старт

> **Статус:** 🚀 В разработке (20% готово)  
> **Дата:** 2026-03-06

## 🎯 Что это?

Прямая интеграция с МойСклад через Bonus Transaction API для синхронизации бонусов между онлайн и офлайн покупками.

## ✅ Что уже готово

### 1. База данных
```prisma
model MoySkladDirectIntegration {
  id              String
  projectId       String
  accountId       String    // ID организации
  apiToken        String    // Bearer token (encrypted)
  bonusProgramId  String    // ID программы лояльности
  syncDirection   SyncDirection
  isActive        Boolean
  // ...
}

model MoySkladDirectSyncLog {
  id            String
  operation     String  // "bonus_accrual", "bonus_spending"
  direction     String  // "incoming", "outgoing"
  amount        Decimal
  status        String  // "success", "error"
  // ...
}
```

### 2. API Client
```typescript
import { MoySkladClient } from '@/lib/moysklad-direct/client';

const client = new MoySkladClient({
  accountId: 'xxx',
  apiToken: 'encrypted_token',
  bonusProgramId: 'yyy'
});

// Начисление бонусов
await client.accrueBonus({
  counterpartyId: 'counterparty_id',
  amount: 100,
  comment: 'Онлайн покупка'
});

// Списание бонусов
await client.spendBonus({
  counterpartyId: 'counterparty_id',
  amount: 50,
  comment: 'Оплата бонусами'
});

// Получение баланса
const balance = await client.getBalance({
  counterpartyId: 'counterparty_id'
});

// Поиск контрагента
const counterparty = await client.findCounterpartyByPhone({
  phone: '+79991234567'
});
```

### 3. Типы TypeScript
```typescript
// Все типы в src/lib/moysklad-direct/types.ts
import {
  MoySkladConfig,
  MoySkladCounterparty,
  MoySkladBonusTransaction,
  BalanceCheckResult
} from '@/lib/moysklad-direct/types';
```

### 4. Шифрование
```typescript
import { encrypt, decrypt } from '@/lib/moysklad-direct/encryption';

const encrypted = encrypt('my-api-token');
const decrypted = decrypt(encrypted);
```

## 🔄 Что в процессе

### Sync Service (следующий шаг)
```typescript
// src/lib/moysklad-direct/sync-service.ts
import { MoySkladSyncService } from '@/lib/moysklad-direct/sync-service';

const syncService = new MoySkladSyncService();

// Синхронизация начисления в МойСклад
await syncService.syncBonusAccrualToMoySklad(
  userId,
  amount,
  'online_purchase'
);

// Синхронизация из МойСклад в нашу систему
await syncService.syncFromMoySklad(
  integrationId,
  bonusTransaction
);

// Проверка баланса
const result = await syncService.checkAndSyncBalance(userId);
// result: { ourBalance, moySkladBalance, synced }
```

## 📋 Следующие шаги

1. **Применить миграцию БД:**
   ```bash
   npx prisma migrate dev --name add_moysklad_direct_integration
   npx prisma generate
   ```

2. **Реализовать Sync Service** (2 дня)
   - Синхронизация онлайн → МойСклад
   - Синхронизация офлайн → наша система
   - Проверка и сверка балансов

3. **Создать Webhook Handler** (2 дня)
   - Endpoint для получения событий от МойСклад
   - Обработка бонусных транзакций
   - Валидация webhook secret

4. **Создать UI** (2 дня)
   - Страница настройки интеграции
   - Форма подключения
   - История синхронизации
   - Тест подключения

5. **Интегрировать с Telegram Bot** (1 день)
   - Команда `/balance` с балансом из МойСклад
   - Уведомления об офлайн покупках

## 🎯 Как это будет работать

### Онлайн покупка (Tilda → Наша система → МойСклад)
```
1. Webhook от Tilda
2. Начисляем бонусы в нашей БД
3. Вызываем syncService.syncBonusAccrualToMoySklad()
4. МойСклад синхронизирует баланс
```

### Офлайн покупка (МойСклад → Наша система)
```
1. Кассир пробивает чек в МойСклад
2. МойСклад начисляет бонусы
3. Webhook → наш endpoint
4. Вызываем syncService.syncFromMoySklad()
5. Начисляем бонусы в нашей БД
6. Отправляем уведомление в Telegram
```

### Проверка баланса (Telegram Bot)
```
1. Клиент: /balance
2. Запрашиваем баланс из МойСклад API
3. Сравниваем с нашей БД
4. При расхождении - автосинхронизация
5. Показываем результат
```

## 📚 Документация

- **Полная документация:** `docs/moysklad-direct-api-integration.md`
- **План реализации:** `MOYSKLAD_DIRECT_INTEGRATION_PLAN.md`
- **Старая реализация:** `docs/moysklad-integration.md` (LoyaltyAPI)

## 🔗 Полезные ссылки

- [МойСклад JSON API](https://dev.moysklad.ru/doc/api/remap/1.2/)
- [Бонусные операции](https://dev.moysklad.ru/doc/api/remap/1.2/#suschnosti-bonusnaq-operaciq)
- [Webhook](https://dev.moysklad.ru/doc/api/remap/1.2/dictionaries/#suschnosti-vebhuki)

## 💡 Ключевые отличия от LoyaltyAPI

| Аспект | LoyaltyAPI (старый) | Direct API (новый) |
|--------|---------------------|-------------------|
| Стоимость | Платное размещение | Бесплатно ✅ |
| Сложность | 9 endpoints | 4 метода API ✅ |
| Контроль | Ограниченный | Полный ✅ |
| Время разработки | 15-20 дней | 9-16 дней ✅ |

## ⏱️ Прогресс

```
[████████░░░░░░░░░░░░] 20% (3 дня из 16)

✅ База данных
✅ API Client
✅ Типы и шифрование
🔄 Sync Service (в процессе)
⏳ Webhook Handler
⏳ UI Components
⏳ Telegram Bot
⏳ Тестирование
```

## 🚀 Готово к использованию

После завершения разработки интеграция будет доступна в:
- Dashboard: `/dashboard/projects/[id]/integrations/moysklad-direct`
- API: `/api/projects/[id]/integrations/moysklad-direct`
- Webhook: `/api/webhook/moysklad-direct/[projectId]`
