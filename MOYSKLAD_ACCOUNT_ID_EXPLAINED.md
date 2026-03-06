# 🔑 МойСклад Account ID - Объяснение

## ✅ ВАЖНО: Account ID НЕ нужен для API!

Согласно [официальной документации МойСклад](https://dev.moysklad.ru/doc/api/remap/1.2/), для доступа к API нужен **ТОЛЬКО Bearer Token**:

```bash
Authorization: Bearer <YOUR_TOKEN>
```

## 🤔 Зачем тогда Account ID?

Account ID в нашей системе используется **ТОЛЬКО для:**

1. **Отображения в UI** - чтобы вы видели, какой аккаунт подключен
2. **Логирования** - для отладки и мониторинга
3. **Идентификации** - чтобы различать разные аккаунты МойСклад

**Account ID НЕ используется в API запросах!**

## 📝 Что указывать в поле Account ID?

Укажите **любой идентификатор вашего аккаунта МойСклад**:

### Вариант 1: Email для входа (РЕКОМЕНДУЕТСЯ)
```
a.churova@yandex.ru
```

### Вариант 2: Название компании
```
ООО "Моя Компания"
```

### Вариант 3: Любой текст
```
Мой МойСклад аккаунт
```

**Это просто метка для вашего удобства!**

## 🔐 Что действительно важно?

### 1. API Token (ОБЯЗАТЕЛЬНО)

**Где взять:**
1. Откройте: https://online.moysklad.ru/app/#company/edit
2. Перейдите: Настройки → Токены
3. Создайте новый токен с правами на чтение/запись
4. Скопируйте Bearer токен

**Пример:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 2. Bonus Program ID (ОБЯЗАТЕЛЬНО)

**Где взять:**
1. Откройте: https://online.moysklad.ru/app/#discount
2. Найдите вашу бонусную программу
3. Скопируйте UUID из URL: `#discount/edit?id=[UUID]`

**Пример:**
```
ffd2feee-bee8-11f0-0a80-0311000ca7a6
```

## 📊 Как это работает в коде?

```typescript
// Account ID используется только для логов и UI
const config = {
  accountId: 'a.churova@yandex.ru', // Только для отображения
  apiToken: 'encrypted_token',       // Используется в API
  bonusProgramId: 'uuid-here'        // Используется в API
};

// API запрос использует ТОЛЬКО токен
const response = await fetch('https://api.moysklad.ru/api/remap/1.2/entity/counterparty', {
  headers: {
    Authorization: `Bearer ${apiToken}` // Account ID НЕ используется!
  }
});
```

## ✅ Итог

**Для работы интеграции нужны:**
1. ✅ **API Token** - для доступа к API (ОБЯЗАТЕЛЬНО)
2. ✅ **Bonus Program ID** - UUID бонусной программы (ОБЯЗАТЕЛЬНО)
3. ℹ️ **Account ID** - любой текст для вашего удобства (опционально)

**Account ID можно указать любой - это просто метка!**

---

**Дата:** 2026-03-06  
**Источник:** [МойСклад API Documentation](https://dev.moysklad.ru/doc/api/remap/1.2/)
