# 📊 Анализ источников данных в Workflow "Система лояльности"

## 🎯 Обзор Workflow

Workflow содержит **32 ноды** следующих типов:
- **trigger.command** - 1 нода (старт по команде `/start`)
- **action.database_query** - 5 нод (запросы к БД)
- **condition** - 6 нод (проверки условий)
- **message** - 9 нод (отправка сообщений с переменными)
- **trigger.callback** - 8 нод (триггеры по кнопкам меню)
- **action.menu_command** - 7 нод (обработка команд меню)
- **flow.end** - 1 нода (завершение)

---

## 🗄️ Источники данных по таблицам базы данных

### 1. **Таблица `user` (Пользователи)**
Используется в **5 запросах**:

#### 🔍 `check_user_by_telegram`
```json
{
  "query": "check_user_by_telegram",
  "parameters": {
    "telegramId": "{{telegram.userId}}",
    "projectId": "{{projectId}}"
  },
  "assignTo": "telegramUser"
}
```
**Что получает:**
- Основные данные пользователя по Telegram ID
- **JOIN с `bonus`** - активные бонусы для расчета баланса
- Возвращает: `id`, `email`, `phone`, `firstName`, `lastName`, `balance`, `isActive`, `currentLevel`, `referralCode`, `totalPurchases`

#### 🔍 `check_user_by_contact`
```json
{
  "query": "check_user_by_contact",
  "parameters": {
    "phone": "{{contactReceived.phoneNumber}}",
    "email": "{{telegram.message.text}}",
    "projectId": "{{projectId}}"
  },
  "assignTo": "contactUser"
}
```
**Что получает:**
- Поиск пользователя по телефону или email
- Обрабатывает различные форматы телефонов (+7, 8, без кода)
- Возвращает те же поля что и `check_user_by_telegram`

#### ✏️ `activate_user`
```json
{
  "query": "activate_user",
  "parameters": {
    "userId": "{{contactUser.id}}",
    "telegramId": "{{telegram.userId}}",
    "telegramUsername": "{{telegram.username}}"
  }
}
```
**Что обновляет:**
- `telegramId` - привязка Telegram аккаунта
- `telegramUsername` - имя пользователя в Telegram
- `isActive: true` - активация пользователя
- `updatedAt` - время обновления

---

### 2. **Таблица `bonus` (Бонусы)**
Используется в **3 запросах**:

#### 🔍 `check_welcome_bonus`
```json
{
  "query": "check_welcome_bonus",
  "parameters": {
    "userId": "{{contactUser.id}}"
  },
  "assignTo": "hasWelcomeBonus"
}
```
**Что получает:**
- Проверяет наличие бонусов типа `'WELCOME'` у пользователя
- Возвращает: `boolean` (true/false)

#### ➕ `add_bonus`
```json
{
  "query": "add_bonus",
  "parameters": {
    "userId": "{{contactUser.id}}",
    "amount": 100,
    "type": "WELCOME",
    "description": "Приветственные бонусы за активацию аккаунта"
  }
}
```
**Что создает:**
- Новую запись в таблице `bonus`
- Поля: `userId`, `amount`, `type`, `description`, `expiresAt`
- **Одновременно создает запись в `transaction`** с типом `'EARN'`

#### 📊 Для расчета баланса (в `check_user_by_telegram`)
```sql
-- JOIN в check_user_by_telegram
bonuses: {
  where: {
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ]
  }
}
```
**Что получает:**
- Все активные (непросроченные) бонусы пользователя
- Используется для расчета `balance = SUM(amount)`

---

### 3. **Таблица `transaction` (Транзакции)**
Используется в **2 местах**:

#### 📊 Для `get_user_profile` (используется в UserVariablesService)
```sql
transactions: {
  orderBy: { createdAt: 'desc' },
  take: 20
}
```
**Что получает:**
- Последние 20 транзакций пользователя
- **Рассчитывает:**
  - `totalEarned = SUM(amount) WHERE type = 'EARN'`
  - `totalSpent = ABS(SUM(amount)) WHERE type = 'SPEND'`

#### ➕ `add_bonus` создает транзакцию
```sql
-- Создается вместе с бонусом
{
  userId: params.userId,
  type: 'EARN',
  amount: params.amount,
  description: params.description
}
```

---

### 4. **Таблица `project` (Проекты)**
Используется в **1 месте**:

#### 🌐 Для генерации реферальных ссылок
```sql
-- В get_referral_link
const project = await db.project.findUnique({
  where: { id: params.projectId },
  select: { domain: true }
});
```
**Что получает:**
- `domain` - домен проекта для генерации реферальных ссылок

---

## 🎭 Переменные пользователя (UserVariablesService)

### 📊 Основные переменные:
```typescript
{
  // Баланс и финансы
  'user.balanceFormatted': `${balance} бонусов`,
  'user.totalEarnedFormatted': `${totalEarned} бонусов`,
  'user.totalSpentFormatted': `${totalSpent} бонусов`,
  'user.totalPurchasesFormatted': `${totalPurchases} покупок`,
  'user.expiringBonusesFormatted': `${expiringBonuses}₽`,

  // Личные данные
  'user.firstName': user.firstName,
  'user.currentLevel': user.currentLevel,
  'user.referralCode': user.referralCode,

  // Реферальная ссылка
  'user.referralLink': `${projectDomain}?ref=${user.referralCode}`,
}
```

### 🔍 Источники данных для переменных:

| Переменная | Источник данных |
|------------|-----------------|
| `user.balanceFormatted` | `bonus.amount` (SUM активных бонусов) |
| `user.totalEarnedFormatted` | `transaction.amount` (SUM где type='EARN') |
| `user.totalSpentFormatted` | `transaction.amount` (SUM где type='SPEND') |
| `user.totalPurchasesFormatted` | `user.totalPurchases` (поле из таблицы user) |
| `user.expiringBonusesFormatted` | `bonus.amount` (SUM бонусов, истекающих в 30 дней) |
| `user.firstName` | `user.firstName` |
| `user.currentLevel` | `user.currentLevel` |
| `user.referralCode` | `user.referralCode` |
| `user.referralLink` | `project.domain` + `user.referralCode` |

---

## 🔄 Поток данных в Workflow

### 1️⃣ **Старт** (`/start`)
- **Вход:** Telegram ID пользователя
- **Запрос:** `check_user_by_telegram`
- **Результат:** `telegramUser` (данные пользователя + баланс)

### 2️⃣ **Проверка статуса**
- **Условие:** `telegramUser` существует?
- **Если ДА:** → Активен ли пользователь?
- **Если НЕТ:** → Запрос контакта

### 3️⃣ **Активация (если неактивен)**
- **Вход:** Контакт пользователя (телефон/email)
- **Запрос:** `check_user_by_contact`
- **Результат:** `contactUser`

### 4️⃣ **Привязка Telegram**
- **Запрос:** `activate_user`
- **Обновляет:** `user.telegramId`, `user.isActive`

### 5️⃣ **Приветственные бонусы**
- **Проверка:** `check_welcome_bonus`
- **Если нет:** `add_bonus` (создает бонус + транзакцию)

### 6️⃣ **Главное меню**
- **Переменные:** `get_user_profile` → UserVariablesService
- **Отображение:** Баланс, статистика, уровень, рефералы

---

## 📋 Заключение

**Workflow использует 4 основные таблицы:**
1. **`user`** - основные данные пользователей (5 операций)
2. **`bonus`** - бонусы (3 операции)
3. **`transaction`** - история операций (2 операции)
4. **`project`** - настройки проекта (1 операция)

**Ключевые расчеты:**
- **Баланс** = SUM всех активных бонусов
- **Заработано** = SUM транзакций типа 'EARN'
- **Потрачено** = SUM транзакций типа 'SPEND'
- **Истекает** = SUM бонусов с expiresAt в ближайшие 30 дней

**Все данные корректно рассчитываются в QueryExecutor и передаются в переменные для отображения в сообщениях бота.** ✅
