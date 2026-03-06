# МойСклад Direct - Исправление ошибки params

**Дата:** 2026-03-06  
**Проблема:** `PrismaClientValidationError: id: undefined`

---

## 🔍 Причина ошибки

В Next.js 15 параметры маршрута (`params`) стали **асинхронными**. 

**Было (неправильно):**
```typescript
interface PageProps {
  params: {
    id: string;
  };
}

export default async function Page({ params }: PageProps) {
  const data = await getData(params.id); // ❌ params.id = undefined
}
```

**Стало (правильно):**
```typescript
interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params; // ✅ await params
  const data = await getData(id);
}
```

---

## ✅ Что исправлено

### Файл: `src/app/dashboard/projects/[id]/integrations/moysklad-direct/page.tsx`

**Изменения:**
1. `params` теперь `Promise<{ id: string }>`
2. Добавлен `await params` для получения `id`
3. Используется `id` вместо `params.id` во всех компонентах

---

## 🚀 Деплой исправления

### Шаг 1: Закоммитить изменения

```bash
# Локально (на вашем компьютере)
git add src/app/dashboard/projects/[id]/integrations/moysklad-direct/page.tsx
git commit -m "fix: async params in МойСклад Direct integration page (Next.js 15)"
git push origin main
```

### Шаг 2: Применить на сервере

```bash
# SSH на сервер
ssh user@gupil.ru
cd /path/to/bonus-app

# Pull изменений
git pull origin main

# Пересобрать проект
pm2 stop all
rm -rf .next
yarn build
pm2 restart all
```

### Шаг 3: Проверить работоспособность

Откройте в браузере:
```
https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
```

**Ожидаемый результат:**
- ✅ Страница загружается без ошибок
- ✅ Форма отображается корректно
- ✅ Нет ошибки `id: undefined` в логах

---

## 🔧 Быстрая команда (одна строка)

```bash
git pull origin main && pm2 stop all && rm -rf .next && yarn build && pm2 restart all
```

---

## 📊 Проверка логов

```bash
# Проверить логи после перезапуска
pm2 logs bonus-app --lines 50

# Не должно быть:
# ❌ PrismaClientValidationError
# ❌ id: undefined
# ❌ Argument `where` needs at least one of `id`
```

---

## 🎯 Дополнительная информация

### Next.js 15 Breaking Changes

В Next.js 15 следующие параметры стали асинхронными:
- `params` - параметры маршрута
- `searchParams` - query параметры

**Миграция:**
```typescript
// ❌ Старый способ (Next.js 14)
export default async function Page({ params, searchParams }: Props) {
  const id = params.id;
  const query = searchParams.q;
}

// ✅ Новый способ (Next.js 15)
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { q } = await searchParams;
}
```

### Ссылки
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [Async Request APIs](https://nextjs.org/docs/messages/sync-dynamic-apis)

---

## ✅ Готово!

После выполнения этих шагов страница МойСклад Direct интеграции должна работать корректно.
