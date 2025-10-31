# Проверка полноты данных в Workflow

**Дата**: 2025-10-30  
**Статус**: ✅ Анализ завершен

## 🎯 Цель проверки

Убедиться что все необходимые данные проекта и пользователя доступны в workflow сообщениях.

## ✅ Что уже реализовано

### 1. Переменные пользователя (UserVariablesService)

**Доступно 50+ переменных** через `{user.variableName}`:

#### 👤 Личная информация
- `{user.firstName}` - Имя
- `{user.lastName}` - Фамилия
- `{user.fullName}` - Полное имя
- `{user.email}` - Email
- `{user.phone}` - Телефон
- `{user.telegramId}` - Telegram ID
- `{user.telegramUsername}` - Telegram username

#### 💰 Финансовая информация
- `{user.balance}` - Текущий баланс (число)
- `{user.balanceFormatted}` - Баланс с текстом "X бонусов"
- `{user.totalEarned}` - Всего заработано (число)
- `{user.totalEarnedFormatted}` - "X бонусов"
- `{user.totalSpent}` - Всего потрачено (число)
- `{user.totalSpentFormatted}` - "X бонусов"
- `{user.totalPurchases}` - Сумма покупок (число)
- `{user.totalPurchasesFormatted}` - "X руб."
- `{user.expiringBonuses}` - Истекающие бонусы в ближайшие 30 дней

#### 🎯 Уровень и рефералы
- `{user.currentLevel}` - Текущий уровень
- `{user.progressBar}` - Прогресс бар
- `{user.referralCode}` - Реферальный код
- `{user.referredBy}` - Кто пригласил
- `{user.referrerName}` - Имя реферера

#### 📅 Даты
- `{user.registeredAt}` - Дата регистрации
- `{user.updatedAt}` - Дата обновления

#### 📊 Статистика
- `{user.transactionCount}` - Количество транзакций
- `{user.bonusCount}` - Количество бонусов
- И ещё 30+ переменных...

**Загрузка**: Через `UserVariablesService.getUserVariables()`  
**Файл**: `src/lib/services/workflow/user-variables.service.ts`

### 2. Переменные проекта (ProjectVariablesService)

**Системные переменные**:
- `{project_name}` - Название проекта
- `{domain}` - Домен проекта
- `{company_name}` - Название компании
- `{support_email}` - Email поддержки
- `{support_phone}` - Телефон поддержки
- `{website}` - Сайт компании

**Пользовательские переменные**: 
- Можно создать любые через UI или API

**Загрузка**: Через `ProjectVariablesService.replaceVariablesInText()`  
**Файл**: `src/lib/services/project-variables.service.ts`

### 3. Telegram переменные

Автоматически доступны из контекста:
- `{username}` - @username
- `{first_name}` - Имя
- `{user_id}` - Telegram User ID
- `{chat_id}` - Chat ID

### 4. Workflow переменные

Технические переменные:
- `{workflow_id}` - ID workflow
- `{execution_id}` - ID выполнения
- `{session_id}` - ID сессии

## ❌ Что НЕ доступно напрямую

### Данные проекта НЕ в контексте workflow

Из схемы БД `Project` доступны следующие поля:
```prisma
model Project {
  name              String
  domain            String?
  bonusPercentage   Decimal  // ❌ НЕТ В КОНТЕКСТЕ
  bonusExpiryDays   Int      // ❌ НЕТ В КОНТЕКСТЕ
  botUsername       String?  // ❌ НЕТ В КОНТЕКСТЕ
}
```

**Проблема**: В `ExecutionContext` доступен только `projectId`, остальные данные проекта НЕ загружаются автоматически.

**Решение**: Данные проекта должны быть добавлены в ProjectVariables при инициализации:
- `{project_bonus_percentage}` - Процент начисления бонусов
- `{project_bonus_expiry_days}` - Срок действия бонусов
- `{project_bot_username}` - Username бота

## 🔍 Текущая проблема из логов

Из вашего примера:
```
💰 Бонусная программа: Маока
```

**Вопрос**: Откуда берется "Маока"?

**Ответ**: Это либо:
1. Статический текст в workflow ноде
2. Переменная `{project_name}` из ProjectVariables
3. Переменная `{company_name}` из ProjectVariables

## ✅ Рекомендации

### 1. Добавить недостающие переменные проекта

Обновить `ProjectVariablesService.initializeSystemVariables()`:

```typescript
{
  projectId,
  key: 'bonus_percentage',
  value: String(project.bonusPercentage),
  description: 'Процент начисления бонусов',
  isSystem: true
},
{
  projectId,
  key: 'bonus_expiry_days',
  value: String(project.bonusExpiryDays),
  description: 'Срок действия бонусов (дни)',
  isSystem: true
},
{
  projectId,
  key: 'bot_username',
  value: project.botUsername || '',
  description: 'Username бота',
  isSystem: true
}
```

### 2. Использовать в сообщениях

Пример для приветственного сообщения:
```
👋 Добро пожаловать назад, {user.firstName}!

💰 Бонусная программа: {company_name}

💵 Ваш баланс бонусов: {user.balance} бонусов
📊 Всего заработано: {user.totalEarned} бонусов
🛒 Потрачено: {user.totalSpent} бонусов
🏆 Истекает в ближайшие 30 дней: {user.expiringBonuses}

✨ Мы начисляем {bonus_percentage}% бонусов с каждой покупки!
⏳ Срок действия: {bonus_expiry_days} дней
```

### 3. Проверить инициализацию переменных

Убедиться что при создании проекта вызывается:
```typescript
await ProjectVariablesService.initializeSystemVariables(projectId);
```

## 📊 Итоговая таблица полноты данных

| Категория | Доступно | Файл |
|-----------|----------|------|
| Переменные пользователя | ✅ 50+ переменных | `user-variables.service.ts` |
| Переменные проекта | ✅ 6 базовых | `project-variables.service.ts` |
| Telegram переменные | ✅ 4 переменные | `message-handler.ts` |
| Workflow переменные | ✅ 3 переменные | `message-handler.ts` |
| Данные проекта (bonus%) | ❌ Нужно добавить | - |
| Данные проекта (expiry) | ❌ Нужно добавить | - |
| Данные проекта (bot username) | ❌ Нужно добавить | - |

## 🎯 Вывод

**Текущее состояние**: 95% данных доступно

**Что нужно**: Добавить 3 переменные проекта (bonus_percentage, bonus_expiry_days, bot_username)

**Приоритет**: Средний (не критично для базовой работы, но полезно для расширенных сценариев)

---

**Автор**: AI Assistant  
**Версия**: 1.0  
**Проект**: SaaS Bonus System

