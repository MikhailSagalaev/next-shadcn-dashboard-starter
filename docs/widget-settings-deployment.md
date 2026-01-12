# Инструкция по деплою исправления настроек виджета

## Проблема
API пытался сохранять поля стилей виджета как отдельные поля модели, но в Prisma схеме они должны храниться в JSON полях (`registrationStyles`, `productBadgeStyles`, `widgetStyles`).

## Что исправлено
- Логика сохранения настроек виджета в `src/app/api/projects/[id]/widget/route.ts`
- Группировка стилей в соответствующие JSON поля
- Правильное разворачивание стилей при чтении из БД

## Действия на сервере

### 1. Обновить код
```bash
cd /var/www/bonus-app
git pull origin main
```

### 2. Установить зависимости (если были изменения)
```bash
yarn install
```

### 3. Пересобрать приложение
```bash
yarn build
```

### 4. Перезапустить PM2
```bash
pm2 restart bonus-app
```

### 5. Проверить логи
```bash
pm2 logs bonus-app --lines 50
```

## Миграция существующих данных (если нужно)

Если в БД уже есть записи `WidgetSettings` с неправильной структурой, их нужно мигрировать:

```bash
# Запустить скрипт миграции (если он был создан ранее)
npx tsx scripts/migrate-widget-settings.ts
```

Или выполнить SQL напрямую:
```sql
-- Проверить текущие данные
SELECT id, project_id, registration_styles, product_badge_styles, widget_styles 
FROM widget_settings;

-- Если JSON поля пустые, но есть старые данные - нужна миграция
-- Скрипт миграции должен перенести данные в JSON поля
```

## Проверка работоспособности

### 1. Проверить API
```bash
curl -X GET "https://bonus.deepcare.ru/api/projects/YOUR_PROJECT_ID/widget"
```

### 2. Попробовать сохранить настройки
Зайти в админку → Проект → Интеграция с Tilda → Настройки виджета → Сохранить

### 3. Проверить логи на ошибки Prisma
```bash
pm2 logs bonus-app | grep "prisma:error"
```

## Откат (если что-то пошло не так)

```bash
cd /var/www/bonus-app
git reset --hard HEAD~1
yarn build
pm2 restart bonus-app
```

## Дата деплоя
2026-01-12

## Автор
AI Assistant + User
