# Widget Settings Refactoring

**Дата:** 2026-01-11  
**Статус:** ✅ Завершено

## Проблема

Настройки виджета хранились в `BotSettings.functionalSettings.widgetSettings` (JSON поле), что нарушало принцип разделения ответственности и создавало архитектурные проблемы:

1. Смешивание настроек бота и виджета в одной таблице
2. Два отдельных endpoint'а для загрузки данных виджета (`/bot` + `/max-bonus-percent`)
3. Сложная логика загрузки и сохранения настроек
4. Проблемы с типизацией JSON полей

## Решение

Создана отдельная таблица `WidgetSettings` с выделенным API endpoint `/api/projects/[id]/widget`.

### Архитектура

```
До рефакторинга:
┌─────────────┐
│ BotSettings │
│  ├─ botToken│
│  └─ functionalSettings (JSON)
│      └─ widgetSettings {...}
└─────────────┘

После рефакторинга:
┌─────────────┐     ┌────────────────┐
│ BotSettings │     │ WidgetSettings │
│  ├─ botToken│     │  ├─ registrationTitle
│  └─ ...     │     │  ├─ productBadgeBonusPercent
└─────────────┘     │  └─ ... (50+ полей)
                    └────────────────┘
```

### API Endpoints

**До:**
- `GET /api/projects/[id]/bot` (требовал аутентификацию)
- `GET /api/projects/[id]/max-bonus-percent` (публичный)

**После:**
- `GET /api/projects/[id]/widget` (публичный, возвращает все настройки)
- `PUT /api/projects/[id]/widget` (требует аутентификацию)

## Изменённые файлы

### База данных
- `prisma/schema.prisma` — добавлена модель `WidgetSettings`
- `prisma/migrations/20260111232432_add_widget_settings/` — миграция
- `scripts/migrate-widget-settings.ts` — скрипт миграции данных

### Backend
- `src/app/api/projects/[id]/widget/route.ts` — новый endpoint
- `src/middleware.ts` — добавлен публичный доступ к `/widget`
- ~~`src/app/api/projects/[id]/max-bonus-percent/route.ts`~~ — удалён

### Frontend
- `src/features/projects/components/tilda-integration-view.tsx`:
  - Загрузка: `GET /widget` вместо `GET /bot`
  - Сохранение: `PUT /widget` вместо `PUT /bot`
  - Версия виджета: v27

### Widget
- `public/tilda-bonus-widget.js`:
  - `loadProjectSettingsSimple()` — использует `/widget`
  - `loadProjectSettings()` — использует `/widget`

## Миграция данных

Скрипт `scripts/migrate-widget-settings.ts` автоматически переносит данные из `BotSettings.functionalSettings.widgetSettings` в новую таблицу `WidgetSettings`.

**Запуск:**
```powershell
npx tsx scripts/migrate-widget-settings.ts
```

**Результат:** 0 записей мигрировано (данные ещё не были созданы в старой структуре)

## Преимущества

1. ✅ **Разделение ответственности** — настройки бота и виджета в разных таблицах
2. ✅ **Упрощённая загрузка** — один endpoint вместо двух
3. ✅ **Лучшая типизация** — отдельная Prisma модель с типами
4. ✅ **Производительность** — меньше запросов к API
5. ✅ **Масштабируемость** — легче добавлять новые поля виджета

## Обратная совместимость

⚠️ **Breaking change:** Старые endpoint'ы больше не используются.

Если у вас есть кастомные интеграции, обновите их:
- `GET /api/projects/[id]/bot` → `GET /api/projects/[id]/widget`
- `GET /api/projects/[id]/max-bonus-percent` → `GET /api/projects/[id]/widget`

## Тестирование

```powershell
# Проверка TypeScript
npx tsc --noEmit

# Проверка Prisma
npx prisma validate
npx prisma generate

# Проверка API
curl http://localhost:3000/api/projects/YOUR_PROJECT_ID/widget
```

## Следующие шаги

- [ ] Удалить старые данные из `BotSettings.functionalSettings.widgetSettings` (опционально)
- [ ] Обновить документацию API
- [ ] Добавить unit тесты для нового endpoint
