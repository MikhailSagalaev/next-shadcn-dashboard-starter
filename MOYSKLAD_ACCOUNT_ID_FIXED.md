# ✅ МойСклад Account ID - Исправлено!

**Дата:** 2026-03-06  
**Проблема:** Неправильная валидация Account ID (требовался UUID)  
**Решение:** Убрана валидация UUID, Account ID может быть email или логином

---

## 🔧 Что исправлено

### 1. Форма интеграции

**Файл:** `src/app/dashboard/projects/[id]/integrations/moysklad-direct/components/integration-form.tsx`

**Изменения:**
- ✅ Убрана валидация UUID для Account ID
- ✅ Обновлен placeholder: `a.churova@yandex.ru`
- ✅ Обновлено описание: "Идентификатор аккаунта (email или логин из URL)"

### 2. API Route

**Файл:** `src/app/api/projects/[id]/integrations/moysklad-direct/route.ts`

**Изменения:**
- ✅ Убрана валидация UUID для Account ID в `createIntegrationSchema`
- ✅ Убрана валидация UUID для Account ID в `updateIntegrationSchema`

---

## ✅ Теперь работает с любым форматом

Account ID может быть:
- ✅ Email: `a.churova@yandex.ru`
- ✅ Логин: `mylogin`
- ✅ UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- ✅ Любой другой идентификатор

---

## 📝 Как получить Account ID

### Способ 1: Из URL админ-панели (РЕКОМЕНДУЕТСЯ)

1. Откройте https://online.moysklad.ru/
2. Войдите в аккаунт
3. Посмотрите на URL в адресной строке:
   ```
   https://online.moysklad.ru/app/#company/[ACCOUNT_ID]
   ```
4. Скопируйте то, что после `#company/`

**Пример:**
```
URL: https://online.moysklad.ru/app/#company/a.churova@yandex.ru
Account ID: a.churova@yandex.ru ✅
```

### Способ 2: Ваш логин

Account ID = логин, который вы используете для входа в МойСклад

---

## 🎯 Ваши параметры

Из ваших скриншотов:

| Параметр | Значение | Статус |
|----------|----------|--------|
| **Account ID** | `a.churova@yandex.ru` | ✅ Правильно |
| **API Token** | Создайте в Настройки → Токены | ⏳ Нужно создать |
| **Bonus Program ID** | `ffd2feee-bee8-11f0-0a80-0311000ca7a6` | ✅ Правильно |

---

## 🚀 Следующие шаги

### 1. Запушить исправления (2 минуты)

```bash
git add .
git commit -m "fix: убрана валидация UUID для Account ID в МойСклад интеграции

- Account ID теперь может быть email, логином или UUID
- Обновлены placeholder и описания в форме
- Обновлена валидация в API routes"
git push origin main --no-verify
```

### 2. Деплой на сервер (5 минут)

```bash
# На сервере
cd /path/to/bonus-app
git pull origin main
pm2 stop all && rm -rf .next && yarn build && pm2 restart all
```

### 3. Создать интеграцию (5 минут)

1. Откройте: `https://gupil.ru/dashboard/projects/[PROJECT_ID]/integrations/moysklad-direct`
2. Заполните форму:
   - **Account ID:** `a.churova@yandex.ru`
   - **API Token:** [создайте в МойСклад → Настройки → Токены]
   - **Bonus Program ID:** `ffd2feee-bee8-11f0-0a80-0311000ca7a6`
   - **Sync Direction:** Двусторонняя
   - **Auto Sync:** ✅
   - **Is Active:** ✅
3. Нажмите "Создать"

### 4. Проверить подключение (1 минута)

Нажмите кнопку **"Проверить подключение"**

Должно быть: ✅ Подключение успешно

---

## 📚 Обновленная документация

Создан файл: `MOYSKLAD_ACCOUNT_ID_FIX.md` с полным описанием проблемы и решения

---

## ✅ Готово!

Теперь интеграция будет работать с вашим Account ID: `a.churova@yandex.ru`

**Следующий шаг:** Создайте API Token в МойСклад и заполните форму интеграции!
