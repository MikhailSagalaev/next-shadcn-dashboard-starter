# 🎁 Исправление: Приветственные бонусы теперь начисляются автоматически

## Проблема

У вас было 2 зарегистрированных пользователя, но **0 активных бонусов**. Приветственные бонусы не начислялись при регистрации.

## Решение

Добавлена автоматическая логика начисления приветственных бонусов в `UserService.createUser`.

## Что изменилось

### До исправления ❌
```typescript
// UserService.createUser
const user = await db.user.create({ ... });
return user; // Бонусы НЕ начислялись
```

### После исправления ✅
```typescript
// UserService.createUser
const user = await db.user.create({ ... });

// Автоматическое начисление приветственных бонусов
if (welcomeRewardType === 'BONUS' && welcomeBonus > 0) {
  await BonusService.awardBonus({
    userId: user.id,
    amount: welcomeBonus,
    type: 'WELCOME',
    description: 'Приветственный бонус'
  });
}

return user;
```

## Как это работает сейчас

### 1. Регистрация через webhook

```javascript
// Отправка данных в webhook
POST /api/webhook/{webhookSecret}
{
  "name": "Анастасия",
  "email": "ana_heroes@mail.ru",
  "formid": "form1978756361",
  "tranid": "16345256:8208247673"
}
```

### 2. Автоматическое создание пользователя

```
Webhook → OrderProcessingService → UserService.createUser
```

### 3. Автоматическое начисление бонусов

```typescript
// Проверка настроек проекта
const welcomeBonus = 500; // Из настроек проекта
const welcomeRewardType = 'BONUS';

// Начисление
if (welcomeRewardType === 'BONUS' && welcomeBonus > 0) {
  // Создается бонус типа WELCOME
  // Создается транзакция типа EARN
  // Пользователь получает 500 бонусов
}
```

## Настройки в вашем проекте

Судя по скриншоту, у вас настроено:
- ✅ **Сумма приветственных бонусов**: 500
- ✅ **Тип вознаграждения**: Бонусы (не скидка)
- ✅ **Режим работы**: WITH_BOT (бонусы доступны после активации)

## Что делать с существующими пользователями

### Вариант 1: Начислить бонусы вручную

1. Перейдите в раздел "Пользователи"
2. Найдите пользователя (ana_heroes@mail.ru или anastasyia.pupkova@gmail.com)
3. Нажмите "Начислить бонусы"
4. Укажите сумму: 500
5. Тип: WELCOME
6. Описание: "Приветственный бонус"

### Вариант 2: Использовать скрипт

```bash
# Создайте скрипт для массового начисления
npx tsx scripts/award-welcome-bonus-to-existing.ts
```

Пример скрипта:
```typescript
// scripts/award-welcome-bonus-to-existing.ts
import { db } from '@/lib/db';
import { BonusService } from '@/lib/services/user.service';

async function awardWelcomeBonusToExisting() {
  const projectId = 'cmlzch7zi8l4p9e1m1ipxjub3'; // Ваш проект
  
  // Найти пользователей без приветственных бонусов
  const users = await db.user.findMany({
    where: {
      projectId,
      bonuses: {
        none: { type: 'WELCOME' }
      }
    }
  });
  
  console.log(`Найдено пользователей без приветственных бонусов: ${users.length}`);
  
  for (const user of users) {
    await BonusService.awardBonus({
      userId: user.id,
      amount: 500,
      type: 'WELCOME',
      description: 'Приветственный бонус (ретроактивно)'
    });
    
    console.log(`✅ Начислено ${user.email || user.phone}`);
  }
  
  console.log('Готово!');
}

awardWelcomeBonusToExisting();
```

## Проверка работы

### Тестовый скрипт

```bash
npx tsx scripts/test-welcome-bonus.ts
```

Этот скрипт:
1. Найдет ваш проект
2. Создаст тестового пользователя
3. Проверит начисление приветственных бонусов
4. Покажет детальный отчет
5. Удалит тестовые данные

### Ручная проверка

1. Отправьте тестовый webhook с новым email
2. Проверьте в админ панели → Пользователи
3. Найдите нового пользователя
4. Откройте детали → вкладка "Бонусы"
5. Должен быть бонус типа WELCOME на сумму 500

## Режимы работы

### WITH_BOT (текущий режим)

```
Регистрация → Пользователь создан (isActive: false)
           → Бонусы начислены (500)
           → Бонусы НЕДОСТУПНЫ для использования
           
Привязка Telegram → Пользователь активирован (isActive: true)
                  → Бонусы ДОСТУПНЫ для использования
```

### WITHOUT_BOT (альтернатива)

```
Регистрация → Пользователь создан (isActive: true)
           → Бонусы начислены (500)
           → Бонусы СРАЗУ ДОСТУПНЫ для использования
```

Чтобы переключить режим:
1. Настройки проекта → Режим работы
2. Выберите "Без бота"
3. Сохраните

## Документация

- 📚 [Руководство по приветственным бонусам](./docs/welcome-bonus-guide.md)
- 🔗 [Webhook Integration Guide](./docs/webhook-integration.md)
- 🤖 [Telegram Bot Setup](./docs/telegram-bots.md)

## Changelog

См. [docs/changelog.md](./docs/changelog.md) - запись от 2026-03-02

---

**Статус**: ✅ Исправлено  
**Дата**: 2026-03-02  
**Версия**: 1.0
