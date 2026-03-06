# МойСклад Direct - Исправление ошибки Server Action

**Дата:** 2026-03-06  
**Проблема:** `Error: Failed to find Server Action "x"`

---

## 🔍 Причина ошибки

Ошибка возникает из-за:
1. Неполного билда Next.js после деплоя
2. Кеширования старых Server Actions
3. Несоответствия между клиентом и сервером

---

## ✅ Решение (на сервере)

### Шаг 1: Очистить кеш и билд

```bash
# SSH на сервер
ssh user@your-server.com
cd /path/to/your/project

# Остановить приложение
pm2 stop all
# или: sudo systemctl stop your-app-name

# Удалить старый билд и кеш
rm -rf .next
rm -rf node_modules/.cache

# Опционально: переустановить зависимости
rm -rf node_modules
yarn install
```

### Шаг 2: Пересобрать проект

```bash
# Сгенерировать Prisma Client
npx prisma generate

# Собрать Next.js приложение
yarn build

# Проверить, что билд прошел успешно
# Должно быть: "Compiled successfully"
```

### Шаг 3: Перезапустить приложение

```bash
# PM2
pm2 restart all
pm2 logs your-app-name --lines 50

# systemd
sudo systemctl restart your-app-name
sudo systemctl status your-app-name

# Docker
docker-compose down
docker-compose up -d --build
```

### Шаг 4: Проверить работоспособность

```bash
# Проверить health endpoint
curl https://gupil.ru/api/health

# Проверить страницу интеграции
# Откройте в браузере:
https://gupil.ru/dashboard/projects/[PROJECT_ID]/integrations/moysklad-direct
```

---

## 🔧 Альтернативное решение (если первое не помогло)

### Вариант 1: Полная переустановка

```bash
# Остановить приложение
pm2 stop all

# Удалить все
rm -rf .next node_modules yarn.lock

# Переустановить
yarn install
npx prisma generate
yarn build

# Запустить
pm2 restart all
```

### Вариант 2: Проверить версии

```bash
# Проверить версию Node.js (должна быть >= 18.17)
node --version

# Проверить версию Next.js
cat package.json | grep next

# Если Next.js < 15, обновить:
yarn add next@latest react@latest react-dom@latest
```

### Вариант 3: Отключить кеширование (временно)

Добавьте в `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... существующие настройки
  
  // Временно отключить кеширование
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  
  // Отключить статическую оптимизацию для этой страницы
  async headers() {
    return [
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

Затем пересобрать:
```bash
yarn build
pm2 restart all
```

---

## 🐛 Отладка

### Проверить логи

```bash
# PM2
pm2 logs your-app-name --lines 100 | grep -i "server action"

# systemd
sudo journalctl -u your-app-name -n 100 | grep -i "server action"

# Docker
docker-compose logs --tail=100 | grep -i "server action"
```

### Проверить билд

```bash
# Проверить, что .next существует
ls -la .next/

# Проверить server actions
ls -la .next/server/app/

# Должны быть файлы вида:
# - page.js
# - route.js
# - action-*.js
```

### Проверить переменные окружения

```bash
# Проверить NODE_ENV
echo $NODE_ENV
# Должно быть: production

# Проверить NEXT_PUBLIC_* переменные
env | grep NEXT_PUBLIC
```

---

## 📊 Проверка после исправления

### 1. Открыть страницу интеграции

```
https://gupil.ru/dashboard/projects/cmmf0rf0j00049eh2d926hx3t/integrations/moysklad-direct
```

**Ожидаемый результат:**
- ✅ Страница загружается без ошибок
- ✅ Форма отображается корректно
- ✅ Кнопки работают

### 2. Проверить консоль браузера

Откройте DevTools (F12) → Console

**Не должно быть:**
- ❌ `Failed to find Server Action`
- ❌ `Application error`

### 3. Проверить Network

DevTools → Network → Фильтр: Fetch/XHR

**Должны быть успешные запросы:**
- ✅ GET `/dashboard/projects/[id]/integrations/moysklad-direct` → 200
- ✅ POST `/api/projects/[id]/integrations/moysklad-direct` → 200 (при сохранении)

---

## 🎯 Быстрое решение (одна команда)

```bash
pm2 stop all && \
rm -rf .next node_modules/.cache && \
npx prisma generate && \
yarn build && \
pm2 restart all && \
pm2 logs your-app-name --lines 50
```

---

## 📝 Если проблема сохраняется

### Проверить код компонентов

Убедитесь, что все Client Components помечены `'use client'`:

```typescript
// ✅ Правильно
'use client';

import { useState } from 'react';

export function MyComponent() {
  const [state, setState] = useState();
  // ...
}
```

### Проверить импорты

```typescript
// ❌ Неправильно - импорт Server Component в Client Component
'use client';
import { ServerComponent } from './server-component';

// ✅ Правильно - использовать children
'use client';
export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

---

## 🔗 Полезные ссылки

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Troubleshooting Next.js](https://nextjs.org/docs/messages/failed-to-find-server-action)

---

## ✅ Финальный чеклист

После выполнения всех шагов:

- [ ] Кеш очищен (`.next` удален)
- [ ] Проект пересобран (`yarn build` успешно)
- [ ] Приложение перезапущено
- [ ] Страница загружается без ошибок
- [ ] Форма работает корректно
- [ ] Кнопки реагируют на клики
- [ ] Нет ошибок в консоли браузера
- [ ] Нет ошибок в логах сервера

---

## 🎉 Готово!

После выполнения этих шагов ошибка `Failed to find Server Action` должна исчезнуть.

Если проблема сохраняется, проверьте:
1. Версию Node.js (>= 18.17)
2. Версию Next.js (>= 15.0)
3. Права доступа к файлам
4. Наличие всех зависимостей
