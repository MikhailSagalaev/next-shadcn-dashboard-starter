# 💬 Примеры сообщений с переменными пользователя

## 🎯 Готовые шаблоны для копирования

### 1. Приветствие нового пользователя
```text
🎉 Добро пожаловать, {user.firstName}!

Ваш профиль создан успешно:
• Имя: {user.fullName}
• Email: {user.email}
• Телефон: {user.phone}
• Telegram: @{user.telegramUsername}

💰 Вам начислено 100 приветственных бонусов!
• Текущий баланс: {user.balanceFormatted}
• Уровень: {user.currentLevel}

🎁 Реферальная программа:
• Ваш код: {user.referralCode}
• Ссылка: {user.referralLink}

Дата регистрации: {user.registeredAt}
```

### 2. Информация о балансе
```text
💰 Ваш баланс: {user.balanceFormatted}

📊 Статистика:
• Заработано: {user.totalEarnedFormatted}
• Потрачено: {user.totalSpentFormatted}
• Покупок на сумму: {user.totalPurchasesFormatted}
• Всего операций: {user.transactionCount}

🎯 Текущий уровень: {user.currentLevel}
```

### 3. Реферальная программа
```text
🎁 Пригласите друзей и получите бонусы!

Ваш реферальный код: {user.referralCode}
Ссылка для приглашения: {user.referralLink}

{user.referrerName} - Вас пригласил: {user.referrerName}

Как это работает:
1. Поделитесь ссылкой с друзьями
2. Они регистрируются по вашей ссылке
3. Вы получаете бонусы за каждого друга!
```

### 4. История транзакций
```text
📋 Последние операции:

{user.transactionHistory}

Всего операций: {user.transactionCount}
```

### 5. Активные бонусы
```text
🎁 Ваши активные бонусы:

{user.activeBonuses}

Всего бонусов: {user.bonusCount}
```

### 6. Полная информация о профиле
```text
👤 Ваш профиль

Личная информация:
• Имя: {user.fullName}
• Email: {user.email}
• Телефон: {user.phone}
• Telegram: @{user.telegramUsername}

Финансы:
• Баланс: {user.balanceFormatted}
• Заработано: {user.totalEarnedFormatted}
• Потрачено: {user.totalSpentFormatted}
• Покупки: {user.totalPurchasesFormatted}

Статус:
• Уровень: {user.currentLevel}
• Регистрация: {user.registeredAt}
• Операций: {user.transactionCount}

Рефералы:
• Код: {user.referralCode}
• Ссылка: {user.referralLink}
{user.referrerName} - Пригласил: {user.referrerName}
```

### 7. Краткая информация
```text
Привет, {user.firstName}! 
Баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}
```

### 8. Уведомление о начислении бонусов
```text
🎉 Вам начислены бонусы!

Новый баланс: {user.balanceFormatted}
Заработано всего: {user.totalEarnedFormatted}

Продолжайте делать покупки и копить бонусы!
```

### 9. Уведомление о списании бонусов
```text
💳 Бонусы списаны

Текущий баланс: {user.balanceFormatted}
Потрачено всего: {user.totalSpentFormatted}

Спасибо за использование бонусов!
```

### 10. Реферальное уведомление
```text
🎁 Реферальный бонус!

Вы получили бонусы за приглашение друга!

Текущий баланс: {user.balanceFormatted}
Заработано всего: {user.totalEarnedFormatted}

Приглашайте больше друзей и получайте бонусы!
```

## 🔧 Технические примеры

### Условное отображение
```text
{user.hasReferralCode} - Ваш реферальный код: {user.referralCode}
{user.hasTransactions} - История операций: {user.transactionHistory}
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

## 📱 Примеры для разных сценариев

### После покупки
```text
🛍️ Спасибо за покупку!

Вам начислено бонусов: {user.balanceFormatted}
Новый баланс: {user.balanceFormatted}

{user.hasReferralCode} - Поделитесь с друзьями: {user.referralLink}
```

### После регистрации по реферальной ссылке
```text
🎉 Добро пожаловать!

Вы зарегистрированы по приглашению от {user.referrerName}

Ваш баланс: {user.balanceFormatted}
Ваш реферальный код: {user.referralCode}

Приглашайте друзей и получайте бонусы!
```

### Напоминание о неиспользованных бонусах
```text
💡 У вас есть неиспользованные бонусы!

Баланс: {user.balanceFormatted}
{user.activeBonuses}

Используйте их для покупок или поделитесь с друзьями!
```

### Уведомление об истечении бонусов
```text
⚠️ Внимание!

У вас есть бонусы, которые скоро истекают:

{user.activeBonuses}

Используйте их до истечения срока!
```

## 🎨 Стилизация сообщений

### С эмодзи
```text
👤 Профиль: {user.fullName}
💰 Баланс: {user.balanceFormatted}
🎯 Уровень: {user.currentLevel}
📅 Регистрация: {user.registeredAt}
```

### С разделителями
```text
═══════════════════════════
👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
═══════════════════════════

Имя: {user.fullName}
Баланс: {user.balanceFormatted}
Уровень: {user.currentLevel}

═══════════════════════════
```

### Компактный формат
```text
{user.firstName} | {user.balanceFormatted} | {user.currentLevel}
```

## 📊 Статистические сообщения

### Еженедельная статистика
```text
📊 Ваша статистика за неделю:

Баланс: {user.balanceFormatted}
Операций: {user.transactionCount}
Бонусов: {user.bonusCount}

{user.hasReferralCode} - Реферальный код: {user.referralCode}
```

### Месячная статистика
```text
📈 Статистика за месяц:

Заработано: {user.totalEarnedFormatted}
Потрачено: {user.totalSpentFormatted}
Покупки: {user.totalPurchasesFormatted}

Продолжайте в том же духе! 🚀
```

---

**Примечание**: Все переменные автоматически заменяются на актуальные данные пользователя при отправке сообщения.
