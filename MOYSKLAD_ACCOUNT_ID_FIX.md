# МойСклад Account ID - Исправление и пояснение

**Дата:** 2026-03-06  
**Проблема:** Неправильное понимание формата Account ID

---

## ❌ Что было неправильно

В документации было указано, что Account ID - это UUID организации вида:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Но это **НЕВЕРНО**!

---

## ✅ Что правильно

**Account ID в МойСклад - это идентификатор аккаунта**, который может быть:
- Email (например: `a.churova@yandex.ru`)
- Логин
- Другой идентификатор

**Это НЕ UUID организации!**

---

## 🔍 Откуда взять Account ID

### Вариант 1: Из URL админ-панели (ПРАВИЛЬНО)

1. Откройте https://online.moysklad.ru/
2. Войдите в аккаунт
3. Посмотрите на URL:
   ```
   https://online.moysklad.ru/app/#company/[ACCOUNT_ID]
   ```

**Пример из вашего случая:**
```
URL: https://online.moysklad.ru/app/#company/a.churova@yandex.ru
Account ID: a.churova@yandex.ru
```

✅ **Это правильный Account ID!**

### Вариант 2: Это ваш логин в МойСклад

Account ID = логин, который вы используете для входа в МойСклад

---

## 📝 Правильные параметры для интеграции

Из ваших скриншотов:

| Параметр | Значение | Статус |
|----------|----------|--------|
| **Account ID** | `a.churova@yandex.ru` | ✅ Правильно |
| **API Token** | `••••••••••••••••••••` | ✅ Создайте в Настройки → Токены |
| **Bonus Program ID** | `ffd2feee-bee8-11f0-0a80-0311000ca7a6` | ✅ Правильно (из URL) |

---

## 🔧 Что нужно исправить в коде

### 1. Убрать валидацию UUID для Account ID

**Было (неправильно):**
```typescript
accountId: z.string().uuid('Account ID должен быть в формате UUID')
```

**Должно быть:**
```typescript
accountId: z.string().min(1, 'Account ID обязателен')
```

### 2. Обновить описание в UI

**Было:**
```
UUID организации в МойСклад (из URL админ-панели)
```

**Должно быть:**
```
Идентификатор аккаунта (email или логин из URL админ-панели)
```

---

## 🚀 Как использовать МойСклад API

### Формат запросов

**НЕ используется Account ID в URL запросов!**

Запросы идут напрямую к API:
```
https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction
```

**Account ID используется только для:**
- Идентификации аккаунта в нашей системе
- Логирования
- Отображения в UI

**API Token** используется для аутентификации:
```
Authorization: Bearer YOUR_API_TOKEN
```

---

## 📖 Документация МойСклад

### Bonus Transaction API

**Endpoint:**
```
POST https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction
```

**Headers:**
```
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

**Body (начисление):**
```json
{
  "bonusProgram": {
    "meta": {
      "href": "https://api.moysklad.ru/api/remap/1.2/entity/bonusprogram/ffd2feee-bee8-11f0-0a80-0311000ca7a6",
      "type": "bonusprogram"
    }
  },
  "agent": {
    "meta": {
      "href": "https://api.moysklad.ru/api/remap/1.2/entity/counterparty/COUNTERPARTY_ID",
      "type": "counterparty"
    }
  },
  "transactionType": "EARNING",
  "bonusValue": 100
}
```

**Документация:**
https://dev.moysklad.ru/doc/api/remap/1.2/#/dictionaries/bonus-operation

---

## ✅ Что работает правильно

Наша текущая реализация **УЖЕ работает правильно**!

**Почему:**
1. Account ID используется только для хранения в БД
2. API запросы используют только API Token
3. Bonus Program ID используется в запросах (это UUID)

**Единственная проблема:**
- Валидация формы требует UUID для Account ID
- Нужно убрать эту валидацию

---

## 🔧 Исправления

### Файл: `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/integration-form.tsx`

**Строка 35-36:**

**Было:**
```typescript
accountId: z.string().uuid('Account ID должен быть в формате UUID'),
```

**Должно быть:**
```typescript
accountId: z.string().min(1, 'Account ID обязателен'),
```

**Строка 95-97 (описание):**

**Было:**
```typescript
<FormDescription>
  UUID организации в МойСклад (из URL админ-панели)
</FormDescription>
```

**Должно быть:**
```typescript
<FormDescription>
  Идентификатор аккаунта (email или логин из URL: #company/[ACCOUNT_ID])
</FormDescription>
```

---

## 📝 Обновление документации

### Файлы для обновления:

1. `SETUP_STEP_BY_STEP.md` - обновить описание Account ID
2. `QUICK_SETUP_CHECKLIST.md` - обновить описание
3. `MOYSKLAD_VISUAL_GUIDE.md` - обновить примеры
4. `MOYSKLAD_DIRECT_FINAL_INSTRUCTIONS.md` - обновить инструкции

**Изменить везде:**
- "UUID организации" → "Идентификатор аккаунта (email или логин)"
- Убрать упоминания о формате UUID для Account ID
- Добавить примеры с email

---

## ✅ Итоговая инструкция

### Для пользователя:

1. **Account ID:**
   - Откройте МойСклад
   - Посмотрите URL: `https://online.moysklad.ru/app/#company/[ACCOUNT_ID]`
   - Скопируйте то, что после `#company/`
   - Это может быть email (a.churova@yandex.ru) или другой идентификатор

2. **API Token:**
   - Настройки → Пользователи → Токены → Создать
   - Скопируйте токен СРАЗУ

3. **Bonus Program ID:**
   - Настройки → Бонусная программа → Открыть программу
   - Скопируйте UUID из URL: `#discount/edit?id=[UUID]`

---

## 🎯 Следующие шаги

1. Исправить валидацию в форме (убрать требование UUID)
2. Обновить описания в UI
3. Обновить документацию
4. Запушить изменения
5. Протестировать с реальными данными

---

## 📞 Тестирование

После исправлений протестируйте с вашими данными:

```
Account ID: a.churova@yandex.ru
API Token: [ваш токен]
Bonus Program ID: ffd2feee-bee8-11f0-0a80-0311000ca7a6
```

Должно работать! ✅
