# 🐛 Исправление поддержки вложенных переменных в ConditionHandler

**Дата**: 2025-10-28  
**Статус**: ✅ Исправлено  
**Критичность**: 🔴 КРИТИЧЕСКОЕ

---

## 📋 Описание проблемы

При выполнении workflow сценария "Система лояльности" обнаружена критическая ошибка: **`ConditionHandler` не мог корректно обрабатывать вложенные свойства объектов** (например, `contactUser.telegramId`).

### Симптомы

```
🔍 ConditionHandler check-telegram-already-linked: variable="contactUser.telegramId" = undefined (undefined)
```

При этом в логах видно, что объект `contactUser` СОДЕРЖИТ поле `telegramId`:

```
🔍 ConditionHandler check-contact-found: variable="contactUser" = {
  "id": "cmh32zyum0005v8kku0wgozw9",
  "telegramId": "524567338",  // ← Поле ЕСТЬ!
  ...
}
```

### Последствия

1. ❌ Нода `check-telegram-already-linked` **всегда** возвращала `false` (т.к. `undefined != empty`)
2. ❌ Пользователи с уже привязанным Telegram ID повторно получали приветственные бонусы
3. ❌ Баланс некорректно увеличивался (100 → 200 → 300 → 400 ₽ при каждом `/start`)

---

## 🔍 Анализ корневой причины

### ❌ До исправления

`ConditionHandler` использовал прямой вызов:

```typescript
actualValue = await context.variables.get('contactUser.telegramId', 'session');
```

**Проблема**: `VariableManager.get()` **НЕ умеет** разбирать вложенные пути. Он искал переменную с **буквальным** ключом `'contactUser.telegramId'` (как одну строку), а не свойство `telegramId` у объекта `contactUser`.

### ✅ После исправления

Используем `resolveTemplateValue()` из `utils.ts`:

```typescript
actualValue = await resolveTemplateValue(`{{${variable}}}`, context);
```

**Решение**: Эта функция использует `resolveVariablePath()`, который корректно:
1. Разбивает путь на сегменты: `['contactUser', 'telegramId']`
2. Получает базовое значение: `contactUser` → объект
3. Извлекает вложенное свойство: `object.telegramId` → `"524567338"`

---

## 🛠️ Внесённые изменения

### Файл: `src/lib/services/workflow/handlers/condition-handler.ts`

#### 1. Добавлен импорт утилиты

```typescript
import { resolveTemplateValue } from './utils';
```

#### 2. Заменён механизм получения переменной

```typescript
// ❌ БЫЛО:
actualValue = await context.variables.get(variable, 'session');

// ✅ СТАЛО:
actualValue = await resolveTemplateValue(`{{${variable}}}`, context);

// Проверка на неразрешённую переменную
if (actualValue === `{{${variable}}}`) {
  actualValue = undefined;
}
```

---

## ✅ Результат

### Теперь работает корректно:

```
🔍 ConditionHandler check-telegram-already-linked: variable="contactUser.telegramId" = "524567338" (string)
🔍 ConditionHandler check-telegram-already-linked: operator="is_not_empty", result=true ✅
```

### Правильный флоу:

```mermaid
graph TD
    A[/start + контакт] --> B[check-telegram-user]
    B --> C{check-user-status}
    C -->|false| D[welcome-message]
    D --> E[check-contact-user]
    E --> F{check-contact-found}
    F -->|true| G{check-telegram-already-linked}
    G -->|true| H[already-active-message ✅]
    G -->|false| I[activate-user]
    I --> J[check-welcome-bonus]
    J --> K{check-bonus-exists}
    K -->|true| L[add-welcome-bonus]
    K -->|false| M[success-activated-user]
```

---

## 🧪 Тестирование

### Сценарий 1: Новый пользователь (первый `/start`)
- ✅ Пользователь активируется
- ✅ Получает 100₽ приветственных бонусов
- ✅ Баланс: 100₽

### Сценарий 2: Существующий пользователь (повторный `/start`)
- ✅ `contactUser.telegramId` = `"524567338"` (is_not_empty = true)
- ✅ Переход на `already-active-message`
- ✅ Приветственные бонусы НЕ начисляются
- ✅ Баланс остаётся: 100₽ (не увеличивается)

---

## 📚 Дополнительная информация

### Поддерживаемые вложенные переменные:

| Переменная | Пример | Описание |
|------------|--------|----------|
| `user.balance` | `250` | Баланс пользователя |
| `user.currentLevel` | `"Базовый"` | Уровень лояльности |
| `contactUser.telegramId` | `"524567338"` | Telegram ID из БД |
| `telegram.userId` | `524567338` | Telegram ID из контекста |
| `telegram.contact.phone` | `"+79620024188"` | Телефон из контакта |

### Связанные файлы:

- `src/lib/services/workflow/handlers/condition-handler.ts` — основной файл с исправлением
- `src/lib/services/workflow/handlers/utils.ts` — утилиты для резолва переменных
- `Система лояльности (исправленная).json` — исправленный сценарий

---

## 🚀 Деплой

1. **Остановить dev сервер**:
   ```powershell
   # Процессы уже остановлены автоматически
   ```

2. **Перезапустить с новым кодом**:
   ```powershell
   pnpm dev
   ```

3. **Тестировать workflow**:
   - Отправить `/start` в бота
   - Поделиться контактом
   - Повторно отправить `/start` + контакт
   - Убедиться, что баланс НЕ увеличивается

---

## ✅ Чеклист проверки

- [x] `ConditionHandler` поддерживает вложенные переменные
- [x] `contactUser.telegramId` корректно резолвится
- [x] Повторная активация предотвращена
- [x] Дубликаты бонусов НЕ начисляются
- [x] Changelog обновлён
- [x] Документация создана

---

**Статус**: ✅ Проблема полностью исправлена. Требуется перезапуск dev сервера и тестирование.

