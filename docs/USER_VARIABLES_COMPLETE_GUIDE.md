# Полный гайд по переменным пользователя в Workflow

## 📋 Оглавление

1. [Основные переменные](#основные-переменные)
2. [Финансовые переменные](#финансовые-переменные)
3. [Переменные уровня и прогресса](#переменные-уровня-и-прогресса)
4. [Реферальные переменные](#реферальные-переменные)
5. [История и транзакции](#история-и-транзакции)
6. [Новые переменные (2025-10-29)](#новые-переменные-2025-10-29)

---

## Основные переменные

### Личная информация

```typescript
{user.id}                    // ID пользователя в системе
{user.firstName}             // Имя пользователя
{user.lastName}              // Фамилия пользователя
{user.fullName}              // Полное имя (Имя + Фамилия)
{user.email}                 // Email пользователя
{user.phone}                 // Телефон пользователя
{user.telegramId}            // Telegram ID
{user.telegramUsername}      // Telegram username (@username)
```

**Пример использования**:
```
👋 Привет, {user.firstName}!

📧 Email: {user.email}
📞 Телефон: {user.phone}
👤 Telegram: @{user.telegramUsername}
```

---

## Финансовые переменные

### Баланс и статистика

```typescript
{user.balance}               // Баланс (число)
{user.balanceFormatted}      // "400 бонусов"
{user.totalEarned}           // Всего заработано (число)
{user.totalEarnedFormatted}  // "1500 бонусов"
{user.totalSpent}            // Всего потрачено (число)
{user.totalSpentFormatted}   // "800 бонусов"
{user.totalPurchases}        // Сумма покупок (число)
{user.totalPurchasesFormatted} // "5000 руб."
```

**Пример использования**:
```
💰 Ваш баланс: {user.balanceFormatted}

📊 Статистика:
✅ Заработано: {user.totalEarnedFormatted}
💸 Потрачено: {user.totalSpentFormatted}
🛒 Покупок на: {user.totalPurchasesFormatted}
```

### ✨ НОВОЕ: Истекающие бонусы

```typescript
{user.expiringBonuses}       // Бонусы, истекающие в ближайшие 30 дней (число)
```

**Пример использования**:
```
⚠️ Истекает в ближайшие 30 дней: {user.expiringBonuses}₽

Поторопитесь использовать их!
```

---

## Переменные уровня и прогресса

### Уровень пользователя

```typescript
{user.currentLevel}          // "Базовый", "Серебряный", "Золотой", "Платиновый"
```

### ✨ НОВОЕ: Прогресс-бар уровня

```typescript
{user.progressBar}           // Визуальный прогресс-бар
```

**Варианты отображения**:
- `▰▱▱▱ (25%)` — Базовый уровень
- `▰▰▱▱ (50%)` — Серебряный уровень
- `▰▰▰▱ (75%)` — Золотой уровень
- `▰▰▰▰ (100%)` — Платиновый уровень

**Пример использования**:
```
🏆 Ваш уровень: {user.currentLevel}

Прогресс: {user.progressBar}

Продолжайте делать покупки для повышения уровня!
```

---

## Реферальные переменные

### Реферальная информация

```typescript
{user.referralCode}          // Реферальный код пользователя
{user.referralCodeShort}     // Краткий код
{user.hasReferralCode}       // "Да" или "Нет"
{user.referredBy}            // ID реферера
{user.referrerName}          // Имя реферера
```

### ✨ ИСПРАВЛЕНО: Реферальная ссылка

```typescript
{user.referralLink}          // https://t.me/botusername?start=ref_CODE
```

**Раньше показывало**: "Недоступно"  
**Теперь показывает**: Реальную ссылку на бота!

**Пример использования**:
```
🔗 Ваша реферальная ссылка:

{user.referralLink}

📝 Или используйте код: {user.referralCode}

💡 Поделитесь ей с друзьями:
✅ За каждого друга вы получите 10% с его покупок
✅ Ваш друг получит 10% бонусов при регистрации
```

---

## История и транзакции

### Счётчики

```typescript
{user.transactionCount}      // Количество транзакций
{user.bonusCount}            // Количество активных бонусов
{user.hasTransactions}       // "Да" или "Нет"
{user.hasBonuses}            // "Да" или "Нет"
{user.isNewUser}             // "Да" или "Нет"
```

### История транзакций (простая)

```typescript
{user.transactionHistory}    // Последние 5 транзакций (базовое форматирование)
{user.activeBonuses}         // Активные бонусы (первые 3)
```

**Пример вывода `transactionHistory`**:
```
+400 бонусов - Начисление за покупку (28 октября 2025 г., 12:30)
-200 бонусов - Списание бонусов (25 октября 2025 г., 15:45)
+100 бонусов - Приветственный бонус (23 октября 2025 г., 09:10)
```

### ✨ НОВОЕ: История транзакций (детальная)

```typescript
{transactions.formatted}     // Красиво отформатированная история с иконками
```

**Пример вывода `transactions.formatted`**:
```
1. 💚 +400 ₽ • Начисление за покупку
   📅 28.10, 12:30

2. 💸 -200 ₽ • Списание бонусов
   📅 25.10, 15:45

3. 💚 +100 ₽ • Приветственный бонус
   📅 23.10, 09:10
```

**Пример использования**:
```
📜 История операций (последние 10):

{transactions.formatted}
```

---

## Новые переменные (2025-10-29)

### Сводная таблица

| Переменная | Тип | Описание | Пример вывода |
|-----------|-----|----------|---------------|
| `{user.expiringBonuses}` | число | Бонусы, истекающие в ближайшие 30 дней | `350` |
| `{user.progressBar}` | строка | Визуальный прогресс-бар уровня | `▰▰▱▱ (50%)` |
| `{transactions.formatted}` | строка | Детальная история с иконками | См. выше |
| `{user.referralLink}` | строка | **ИСПРАВЛЕНО**: Реальная ссылка на бота | `https://t.me/gupilbot?start=ref_ABC123` |

---

## Практические примеры

### Пример 1: Профиль активного пользователя

```
👋 Добро пожаловать назад, {user.firstName}!

💰 Бонусная программа: {user.projectName}

💵 Ваш баланс бонусов: {user.balanceFormatted}
📊 Всего заработано: {user.totalEarnedFormatted}
🛒 Потрачено: {user.totalSpentFormatted}
🏆 Истекает в ближайшие 30 дней: {user.expiringBonuses}₽

🏅 Текущий уровень: {user.currentLevel}
Прогресс: {user.progressBar}
```

### Пример 2: Детальная информация о балансе

```
💰 Подробная информация о балансе

💵 Текущий баланс: {user.balanceFormatted}
💚 Всего заработано: {user.totalEarnedFormatted}
💸 Всего потрачено: {user.totalSpentFormatted}

⏰ Истекает в ближайшие 30 дней:
{user.expiringBonuses}₽

📜 Активные бонусы:
{user.activeBonuses}
```

### Пример 3: История операций

```
📜 История ваших операций

{transactions.formatted}

📊 Всего операций: {user.transactionCount}
```

### Пример 4: Информация об уровне

```
🏆 Ваш уровень в программе лояльности

🎖️ Текущий уровень: {user.currentLevel}

Прогресс: {user.progressBar}

📈 Уровни программы:
• Базовый: Кэшбэк 5%
• Серебряный: Кэшбэк 7%
• Золотой: Кэшбэк 10%
• Платиновый: Кэшбэк 15%

💡 Делайте покупки, чтобы повысить уровень!
```

### Пример 5: Реферальная программа

```
🔗 Ваша реферальная ссылка

{user.referralLink}

📝 Или используйте код: {user.referralCode}

💡 Поделитесь ей с друзьями:
✅ За каждого друга вы получите 10% с его покупок
✅ Ваш друг получит 10% бонусов при регистрации

👥 Пригласил друзей: {user.referredBy}
```

---

## Логика работы

### Как резолвятся переменные?

1. **Message Handler** (`message-handler.ts`) вызывает `UserVariablesService.getUserVariables()`
2. **User Variables Service** (`user-variables.service.ts`) запрашивает:
   - `QueryExecutor.execute('get_user_profile')` → полный профиль
   - `QueryExecutor.execute('get_referral_link')` → реферальная ссылка
3. **Query Executor** (`query-executor.ts`) выполняет запросы к БД через Prisma
4. **Форматтеры** обрабатывают данные:
   - `formatDate()` — форматирование дат
   - `formatTransactionHistory()` — базовая история
   - `formatTransactionsDetailed()` — детальная история с иконками ✨
   - `generateProgressBar()` — прогресс-бар уровня ✨
5. **Project Variables Service** заменяет переменные в тексте

### Где хранятся данные?

```sql
-- Основные данные пользователя
users {
  id, firstName, lastName, email, phone,
  telegramId, telegramUsername, isActive,
  currentLevel, referralCode, referredBy
}

-- Бонусы
bonuses {
  userId, amount, type, description,
  expiresAt, createdAt
}

-- Транзакции
transactions {
  userId, amount, type, description,
  createdAt, isReferralBonus
}

-- Настройки бота (для реферальной ссылки)
bot_settings {
  projectId, botUsername
}
```

---

## Troubleshooting

### Переменная показывается как `{user.variable}`?

**Причина**: Переменная не резолвится  
**Решение**:
1. Проверьте, что `userId` доступен в контексте
2. Убедитесь, что переменная существует в `user-variables.service.ts`
3. Перезапустите dev сервер (Ctrl+C → `pnpm dev`)

### Реферальная ссылка показывает "Недоступно"?

**Причина**: У пользователя нет `referralCode` или не настроен `botUsername`  
**Решение**:
1. Убедитесь, что в `bot_settings` указан `botUsername`
2. Проверьте, что у пользователя сгенерирован `referralCode`

### История транзакций пустая?

**Причина**: У пользователя нет транзакций  
**Решение**: Это нормально для новых пользователей. После первой транзакции история появится.

---

**Дата последнего обновления**: 2025-10-29  
**Версия**: 3.0 (добавлены `expiringBonuses`, `progressBar`, `transactions.formatted`, исправлена `referralLink`)

