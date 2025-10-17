# 📊 Руководство по переменным пользователя в Workflow

## Обзор

В системе workflow доступны переменные пользователя, которые можно использовать в сообщениях с синтаксисом `{variable_name}`. Эти переменные автоматически заменяются на актуальные данные пользователя.

## 🎯 Основные переменные

### Личная информация
```text
{user.firstName}          - Имя пользователя
{user.lastName}           - Фамилия пользователя  
{user.fullName}           - Полное имя (имя + фамилия)
{user.email}              - Email пользователя
{user.phone}              - Номер телефона
{user.telegramId}         - Telegram ID
{user.telegramUsername}   - Telegram username
```

### Финансовая информация
```text
{user.balance}            - Текущий баланс (число)
{user.balanceFormatted}   - Баланс с текстом "X бонусов"
{user.totalEarned}        - Всего заработано (число)
{user.totalEarnedFormatted} - Заработано с текстом "X бонусов"
{user.totalSpent}         - Всего потрачено (число)
{user.totalSpentFormatted} - Потрачено с текстом "X бонусов"
{user.totalPurchases}     - Общая сумма покупок (число)
{user.totalPurchasesFormatted} - Покупки с текстом "X руб."
```

### Уровень и рефералы
```text
{user.currentLevel}       - Текущий уровень пользователя
{user.referralCode}       - Реферальный код
{user.referralLink}       - Полная реферальная ссылка
{user.referralCodeShort}  - Короткий реферальный код
{user.referredBy}         - ID того, кто пригласил
{user.referrerName}       - Имя того, кто пригласил
{user.projectName}        - Название проекта
```

### Даты
```text
{user.registeredAt}       - Дата регистрации (форматированная)
{user.updatedAt}          - Дата последнего обновления
```

### Статистика
```text
{user.transactionCount}   - Количество транзакций
{user.bonusCount}         - Количество активных бонусов
{user.hasReferralCode}    - Есть ли реферальный код (Да/Нет)
{user.hasTransactions}    - Есть ли транзакции (Да/Нет)
{user.hasBonuses}         - Есть ли бонусы (Да/Нет)
{user.isNewUser}          - Новый ли пользователь (Да/Нет)
```

## 📋 История и детали

### История транзакций
```text
{user.transactionHistory} - Последние 5 транзакций (форматированные)
{user.lastTransaction}    - Последняя транзакция
```

### Активные бонусы
```text
{user.activeBonuses}      - Активные бонусы (форматированные)
```

## 💡 Примеры использования

### Приветственное сообщение
```text
Привет, {user.firstName}! 👋

Ваш текущий баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}
Дата регистрации: {user.registeredAt}

{user.hasReferralCode} - Ваш реферальный код: {user.referralCode}
```

### Информация о балансе
```text
💰 Ваш баланс: {user.balanceFormatted}

📊 Статистика:
• Заработано: {user.totalEarnedFormatted}
• Потрачено: {user.totalSpentFormatted}
• Покупок на сумму: {user.totalPurchasesFormatted}
• Транзакций: {user.transactionCount}
```

### Реферальная информация
```text
🎁 Пригласите друзей и получите бонусы!

Ваш реферальный код: {user.referralCode}
Ссылка для приглашения: {user.referralLink}

{user.referrerName} - Вас пригласил: {user.referrerName}
```

### История транзакций
```text
📋 Последние операции:

{user.transactionHistory}

Всего операций: {user.transactionCount}
```

### Активные бонусы
```text
🎁 Ваши активные бонусы:

{user.activeBonuses}

Всего бонусов: {user.bonusCount}
```

## 🔧 Технические детали

### Как это работает

1. **Автоматическая загрузка**: При отправке сообщения система автоматически загружает данные пользователя
2. **Кэширование**: Данные кэшируются в рамках одного workflow execution
3. **Безопасность**: Все запросы проходят через whitelist безопасных запросов
4. **Форматирование**: Даты и числа автоматически форматируются для удобного отображения

### Поддерживаемые типы данных

- **Строки**: Имена, email, телефоны
- **Числа**: Балансы, суммы, количества
- **Даты**: Автоматически форматируются в русском формате
- **Булевы**: Преобразуются в "Да"/"Нет"
- **Массивы**: Форматируются в читаемый текст

### Обработка ошибок

Если данные пользователя недоступны:
- Переменные заменяются на "Не указано" или "Недоступно"
- Workflow продолжает выполнение
- Ошибки логируются для отладки

## 🚀 Расширенные возможности

### Условное отображение

```text
{user.hasReferralCode} - Ваш код: {user.referralCode}
{user.hasTransactions} - История: {user.transactionHistory}
{user.isNewUser} - Добро пожаловать в нашу программу лояльности!
```

### Форматирование чисел

```text
Баланс: {user.balance} бонусов
Покупки: {user.totalPurchases} рублей
Транзакций: {user.transactionCount}
```

### Работа с датами

```text
Регистрация: {user.registeredAt}
Обновлено: {user.updatedAt}
```

## 📝 Примеры шаблонов сообщений

### Полная информация о пользователе
```text
👤 Профиль пользователя

Имя: {user.fullName}
Email: {user.email}
Телефон: {user.phone}
Telegram: @{user.telegramUsername}

💰 Финансы:
Баланс: {user.balanceFormatted}
Заработано: {user.totalEarnedFormatted}
Потрачено: {user.totalSpentFormatted}
Покупки: {user.totalPurchasesFormatted}

🎯 Уровень: {user.currentLevel}
📅 Регистрация: {user.registeredAt}

{user.hasReferralCode} - Реферальный код: {user.referralCode}
```

### Краткая информация
```text
Привет, {user.firstName}! 
Баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}
```

### Реферальная программа
```text
🎁 Реферальная программа

Пригласите друзей и получите бонусы!

Ваш код: {user.referralCode}
Ссылка: {user.referralLink}

{user.referrerName} - Вас пригласил: {user.referrerName}
```

---

**Примечание**: Все переменные автоматически обновляются при каждом выполнении workflow, поэтому данные всегда актуальны.
