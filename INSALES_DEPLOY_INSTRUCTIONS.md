# InSales Integration - Deploy Instructions

**Дата:** 2026-03-05  
**Статус:** ✅ Готово к деплою

---

## 🚀 Инструкции для деплоя на production

### Шаг 1: Обновить код на сервере

```bash
# Подключиться к серверу
ssh root@89.111.174.71

# Перейти в директорию проекта
cd /opt/next-shadcn-dashboard-starter

# Обновить код
git pull

# Должно показать:
# Updating eb3b4e6..28b444e
# Fast-forward
#  src/app/api/projects/[id]/integrations/insales/route.ts | 2 +-
#  src/lib/insales/insales-service.ts                      | 1 -
#  2 files changed, 2 insertions(+), 3 deletions(-)
```

### Шаг 2: Проверить что обновилось

```bash
# Проверить последние коммиты
git log --oneline -5

# Должно показать:
# 28b444e fix: InSales build errors - remove BonusService import and fix encrypt usage
# eb3b4e6 docs: Add InSales Quick Start Guide
# 5353a87 fix: InSales integration testing - critical bugs fixed
# 6c5b4d6 feat: Add InSales Admin UI - Complete implementation
# ...
```

### Шаг 3: Собрать production build

```bash
# Собрать проект
yarn build

# Должно пройти БЕЗ ошибок
# ✓ Compiled successfully
```

### Шаг 4: Перезапустить приложение

```bash
# Перезапустить PM2
pm2 restart bonus-app

# Проверить статус
pm2 status

# Должно показать:
# │ 0  │ bonus-app  │ fork  │ online  │ ...
```

### Шаг 5: Проверить логи

```bash
# Посмотреть логи
pm2 logs bonus-app --lines 50

# Должно показать успешный запуск без ошибок
```

### Шаг 6: Проверить страницу

Открыть в браузере:
```
https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales
```

**Ожидаемый результат:**
- ✅ Страница загружается без 404
- ✅ Форма создания интеграции отображается
- ✅ Нет ошибок в консоли браузера

---

## 🔍 Troubleshooting

### Проблема: git pull показывает "Already up to date"

**Причина:** Локальный репозиторий не синхронизирован с GitHub

**Решение:**
```bash
# Проверить текущий коммит
git rev-parse HEAD

# Если не 28b444e, то:
git fetch origin
git reset --hard origin/main
```

### Проблема: yarn build падает с ошибками

**Причина:** Зависимости не установлены или устарели

**Решение:**
```bash
# Переустановить зависимости
rm -rf node_modules
yarn install

# Попробовать снова
yarn build
```

### Проблема: pm2 restart не работает

**Причина:** PM2 процесс завис

**Решение:**
```bash
# Остановить процесс
pm2 stop bonus-app

# Удалить из PM2
pm2 delete bonus-app

# Запустить заново
pm2 start ecosystem.config.cjs

# Сохранить конфигурацию
pm2 save
```

### Проблема: Страница всё еще 404

**Причина:** Приложение не перезапустилось или кеш

**Решение:**
```bash
# Жесткий перезапуск
pm2 restart bonus-app --update-env

# Очистить кеш Next.js
rm -rf .next

# Пересобрать
yarn build

# Перезапустить
pm2 restart bonus-app
```

---

## ✅ Чеклист деплоя

- [ ] SSH подключение к серверу работает
- [ ] `git pull` выполнен успешно
- [ ] Коммит `28b444e` присутствует
- [ ] `yarn build` прошел без ошибок
- [ ] `pm2 restart bonus-app` выполнен
- [ ] `pm2 status` показывает "online"
- [ ] `pm2 logs` не показывает ошибок
- [ ] Страница `/integrations/insales` открывается
- [ ] Форма отображается корректно
- [ ] Нет ошибок в консоли браузера

---

## 📊 Что изменилось

### Исправленные файлы (commit 28b444e)

1. **src/lib/insales/insales-service.ts**
   - Удален импорт несуществующего `BonusService`
   - Используется прямая работа с БД через Prisma

2. **src/app/api/projects/[id]/integrations/insales/route.ts**
   - Исправлен импорт: `encrypt` → `encryptApiToken`
   - Исправлено использование: `encrypt()` → `encryptApiToken()`

### Новые файлы (предыдущие коммиты)

- `src/app/dashboard/projects/[id]/integrations/insales/page.tsx` - главная страница
- `src/app/dashboard/projects/[id]/integrations/insales/components/*.tsx` - 4 компонента
- `src/app/api/projects/[id]/integrations/insales/route.ts` - admin API
- `src/lib/insales/insales-service.ts` - бизнес-логика
- `docs/insales-*.md` - документация
- `scripts/test-insales-integration.ts` - тесты

---

## 🎯 После деплоя

### 1. Создать тестовую интеграцию

```bash
# Открыть страницу
https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales

# Заполнить форму:
# - API Key: test_key
# - API Password: test_password
# - Shop Domain: test-shop.myinsales.ru
# - Bonus Percent: 5
# - Max Bonus Spend: 30

# Сохранить
```

### 2. Проверить что создалось

```bash
# На сервере проверить БД
cd /opt/next-shadcn-dashboard-starter

# Запустить Prisma Studio (опционально)
npx prisma studio

# Или проверить через SQL
psql -U postgres -d bonus_system -c "SELECT * FROM \"InSalesIntegration\" LIMIT 1;"
```

### 3. Проверить credentials

После создания интеграции должны отобразиться:
- ✅ Webhook URL
- ✅ Webhook Secret
- ✅ Код виджета
- ✅ Инструкции по установке

---

## 📞 Контакты

**Разработчик:** AI Assistant  
**Дата:** 2026-03-05  
**Коммит:** 28b444e

**Документация:**
- `INSALES_QUICK_START.md` - быстрый старт
- `INSALES_TESTING_SUMMARY.md` - сводка по тестированию
- `INSALES_INTEGRATION_REPORT.md` - полный отчет

**Помощь:**
- Проверить логи: `pm2 logs bonus-app`
- Перезапустить: `pm2 restart bonus-app`
- Статус: `pm2 status`

---

**Готово к деплою!** 🚀

