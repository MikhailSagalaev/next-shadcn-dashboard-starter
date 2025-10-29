# Исправление повторного начисления приветственных бонусов

## 🎯 Дата: 2025-10-28

---

## 🐛 Проблема

При повторном выполнении `/start` + отправке контакта **уже активным пользователем** происходило:

1. ✅ Система находила пользователя по контакту
2. ❌ Повторно активировала его (обновляла `telegram_id`, хотя он уже был привязан)
3. ❌ **Начисляла приветственные бонусы ПОВТОРНО**

**Результат**: Баланс пользователя рос с каждым `/start` + контакт:
- Первый раз: 100 бонусов ✅
- Второй раз: 200 бонусов ❌
- Третий раз: 300 бонусов ❌
- И т.д.

---

## 🔍 Причины

### 1. Ошибка в `query-executor.ts`

**Строка 728** (до исправления):
```typescript
check_welcome_bonus: async (db: PrismaClient, params: { userId: string }) => {
  const welcomeBonus = await db.bonus.findFirst({
    where: {
      userId: params.userId,
      type: 'PURCHASE', // ❌ НЕПРАВИЛЬНО! Должен быть 'WELCOME'
      description: {
        contains: 'приветственн'
      }
    }
  });

  return !!welcomeBonus;
}
```

**Проблема**: Запрашивал тип `PURCHASE` вместо `WELCOME`, поэтому **НИКОГДА не находил** существующие приветственные бонусы.

**Исправление**:
```typescript
check_welcome_bonus: async (db: PrismaClient, params: { userId: string }) => {
  const welcomeBonus = await db.bonus.findFirst({
    where: {
      userId: params.userId,
      type: 'WELCOME' // ✅ ПРАВИЛЬНО!
    }
  });

  return !!welcomeBonus;
}
```

---

### 2. Ошибка в логике сценария "Система лояльности"

**Старый флоу**:
```
check-contact-found → (TRUE) → activate-user → check-welcome-bonus → ...
```

**Проблема**: `activate-user` выполнялся **БЕЗ проверки**, что Telegram ID уже привязан к пользователю.

**Новый флоу** (исправленный):
```
check-contact-found → (TRUE) → check-telegram-already-linked
                                        ↓ TRUE (уже привязан)
                                already-active-message → END
                                        ↓ FALSE (не привязан)
                                activate-user → check-welcome-bonus → ...
```

---

## ✅ Решение

### 1. Исправлен `query-executor.ts`

**Файл**: `src/lib/services/workflow/query-executor.ts`

**Изменения**:
- Строка 728: `type: 'PURCHASE'` → `type: 'WELCOME'`
- Убрана избыточная проверка `description: { contains: 'приветственн' }`

---

### 2. Исправлен сценарий "Система лояльности"

**Файл**: `Система лояльности (исправленная).json`

#### Добавлены новые ноды:

**1. `check-telegram-already-linked`**:
```json
{
  "id": "check-telegram-already-linked",
  "type": "condition",
  "data": {
    "label": "Telegram уже привязан?",
    "config": {
      "condition": {
        "variable": "contactUser.telegramId",
        "operator": "equals",
        "value": "{{telegram.userId}}"
      }
    }
  }
}
```

**Логика**: Проверяет, совпадает ли `telegram_id` пользователя в БД с текущим `telegram.userId`.
- **TRUE** → Telegram уже привязан → показать "already-active-message"
- **FALSE** → Telegram не привязан → выполнить `activate-user`

---

**2. `already-active-message`**:
```json
{
  "id": "already-active-message",
  "type": "message",
  "data": {
    "label": "Уже активирован",
    "config": {
      "message": {
        "text": "✅ Ваш аккаунт уже активирован!\n\n💰 Текущий баланс: {user.balanceFormatted}\n📊 Уровень: {user.currentLevel}\n🎁 Реферальный код: {user.referralCode}\n\n🛍️ Продолжайте делать покупки и копить бонусы!"
      }
    }
  }
}
```

**Назначение**: Информирует пользователя, что он уже активирован, и показывает текущий баланс **БЕЗ** повторного начисления бонусов.

---

#### Изменённые connections:

**Старые**:
```json
{
  "source": "check-contact-found",
  "target": "activate-user",
  "sourceHandle": "true"
}
```

**Новые**:
```json
// 1. Контакт найден → Проверить, привязан ли Telegram
{
  "source": "check-contact-found",
  "target": "check-telegram-already-linked",
  "sourceHandle": "true"
},

// 2. Telegram УЖЕ привязан → Показать сообщение "уже активирован"
{
  "source": "check-telegram-already-linked",
  "target": "already-active-message",
  "sourceHandle": "true"
},

// 3. Telegram НЕ привязан → Активировать пользователя
{
  "source": "check-telegram-already-linked",
  "target": "activate-user",
  "sourceHandle": "false"
},

// 4. "Уже активирован" → Завершить workflow
{
  "source": "already-active-message",
  "target": "end-node"
}
```

---

## 🧪 Тестирование

### Сценарий 1: Новый пользователь (НЕ в БД)
1. `/start` → Приветствие с запросом контакта
2. Отправить контакт → "Контакт не найден" → Требуется регистрация на сайте ✅

### Сценарий 2: Неактивный пользователь (в БД, но `isActive=false`)
1. `/start` → Запрос активации
2. Отправить контакт → Активация + **100 бонусов** ✅

### Сценарий 3: Активный пользователь (повторный `/start` + контакт)
1. `/start` → Профиль (уже активен) ✅
2. Повторно отправить контакт → "Ваш аккаунт уже активирован! Баланс: 100" ✅
3. **БЕЗ повторного начисления бонусов!** ✅

### Сценарий 4: Пользователь с контактом, но БЕЗ Telegram ID
1. `/start` → Telegram ID не найден
2. Отправить контакт → Найден по телефону → Telegram ID **НЕ совпадает** → Активация + 100 бонусов ✅

---

## 📊 Результаты

### ДО исправления:
```
Пользователь: Mikhail Sagalaev
/start → Контакт → Баланс: 100 ✅
/start → Контакт → Баланс: 200 ❌ (повторное начисление!)
/start → Контакт → Баланс: 300 ❌
/start → Контакт → Баланс: 400 ❌
```

### ПОСЛЕ исправления:
```
Пользователь: Mikhail Sagalaev
/start → Контакт → Баланс: 100 ✅
/start → Контакт → "Ваш аккаунт уже активирован! Баланс: 100" ✅ (БЕЗ начисления!)
/start → Контакт → "Ваш аккаунт уже активирован! Баланс: 100" ✅
```

---

## 📝 Файлы изменений

### Исправленные файлы:
1. ✅ `src/lib/services/workflow/query-executor.ts` — исправлен `check_welcome_bonus`
2. ✅ `Система лояльности (исправленная).json` — новый сценарий с проверкой Telegram ID
3. ✅ `docs/changelog.md` — добавлена запись об исправлении
4. ✅ `fix-workflow-scenario.md` — техническая документация проблемы
5. ✅ `docs/WORKFLOW_DUPLICATE_ACTIVATION_FIX.md` — этот документ

---

## 🎯 Выводы

### Причины проблемы:
1. ❌ Неправильный тип бонуса (`PURCHASE` вместо `WELCOME`) в query
2. ❌ Отсутствие проверки привязки Telegram ID перед активацией

### Решение:
1. ✅ Исправлен query для корректной проверки приветственных бонусов
2. ✅ Добавлена нода проверки привязки Telegram ID в сценарии
3. ✅ Добавлено уведомление для уже активных пользователей

### Результат:
✅ Приветственные бонусы начисляются **ТОЛЬКО ОДИН РАЗ**  
✅ Повторные `/start` + контакт **НЕ вызывают** дублирование бонусов  
✅ Пользователи видят корректное сообщение о своём статусе  

---

**Статус**: ✅ Проблема полностью решена  
**Дата исправления**: 2025-10-28  
**Приоритет**: 🔴 Критический (повторное начисление бонусов = финансовые потери)

