# Widget Version Feature Flag - Implementation Guide

**Status:** ✅ Implemented (2026-02-01)  
**Phase:** 6.1 - Database Migration & API Updates  
**Next Phase:** 6.2 - Super-Admin UI

---

## 🎯 Overview

Feature flag system для безопасной миграции с legacy виджета (`tilda-bonus-widget.js`) на universal архитектуру (`widget-loader.js` + `universal-widget.js`).

### Ключевые принципы
1. **Оба виджета работают параллельно** - legacy НЕ удаляется
2. **Контроль через супер-админку** - клиенты не видят настройку
3. **Прозрачная миграция** - клиенты не знают о переключении
4. **Быстрый откат** - можно вернуться на legacy в любой момент

---

## 📊 Database Schema

### Project Model
```prisma
model Project {
  // ... existing fields
  widgetVersion String @default("legacy") @map("widget_version")
  // Possible values: "legacy" | "universal"
}
```

### Migration
```sql
-- Migration: 20260201114318_add_widget_version
ALTER TABLE "projects" 
ADD COLUMN "widget_version" TEXT NOT NULL DEFAULT 'legacy';
```

**Результат:**
- Все существующие проекты: `widgetVersion = "legacy"`
- Новые проекты: `widgetVersion = "legacy"` (по умолчанию)
- Готовность к переключению через супер-админку

---

## 🔧 API Changes

### GET /api/projects/[id]/widget

**Response (updated):**
```json
{
  "success": true,
  "projectId": "clx...",
  "widgetVersion": "legacy",  // ← NEW FIELD
  "operationMode": "WITH_BOT",
  "botUsername": "example_bot",
  "welcomeBonusAmount": 100,
  // ... other settings
}
```

**Использование:**
- Виджеты могут проверять версию для совместимости
- Мониторинг использования разных версий
- Подготовка к условной логике (если потребуется)

### POST /api/webhook/[webhookSecret]

**Logging (updated):**
```typescript
logger.info('Webhook Processed', {
  projectId: project.id,
  widgetVersion: project.widgetVersion,  // ← NEW FIELD
  orderId: normalizedOrder.orderId,
  spent: result.data?.spent,
  earned: result.data?.earned
});
```

**Результат:**
- Все webhook события логируют версию виджета
- Возможность анализа использования legacy vs universal
- Метрики для принятия решений о миграции

---

## 📈 Monitoring & Metrics

### Что отслеживать

#### 1. Распределение версий
```sql
SELECT 
  "widget_version",
  COUNT(*) as project_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM "projects"
GROUP BY "widget_version";
```

#### 2. Активность по версиям
```sql
SELECT 
  p."widget_version",
  COUNT(DISTINCT w."projectId") as active_projects,
  COUNT(*) as webhook_events
FROM "webhook_logs" w
JOIN "projects" p ON p.id = w."projectId"
WHERE w."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY p."widget_version";
```

#### 3. Ошибки по версиям
```sql
SELECT 
  p."widget_version",
  COUNT(*) as error_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as error_rate
FROM "webhook_logs" w
JOIN "projects" p ON p.id = w."projectId"
WHERE w.success = false
  AND w."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY p."widget_version";
```

### Dashboard метрики (для Phase 6.2)
- **Total Projects:** Общее количество проектов
- **Legacy Projects:** Количество на legacy версии
- **Universal Projects:** Количество на universal версии
- **Migration Progress:** Процент мигрированных проектов
- **Error Rate:** Частота ошибок по версиям
- **Active Projects:** Активные проекты по версиям

---

## 🚀 Migration Strategy

### Current State (Phase 6.1)
- ✅ Database готова к feature flag
- ✅ API возвращает версию виджета
- ✅ Webhook логирует версию
- ✅ Все проекты на legacy версии
- ⏳ UI для управления версиями (Phase 6.2)

### Next Steps (Phase 6.2)
1. Создать страницу `/super-admin/widget-versions`
2. Таблица всех проектов с версией виджета
3. Toggle для переключения версии
4. Массовые операции (bulk switch)
5. История изменений версии

### Rollout Plan (Phase 6.3)
1. **Week 1-2:** Внутреннее тестирование (1-2 проекта)
2. **Week 3-4:** Бета-тестирование (5-10 проектов)
3. **Month 2-3:** Постепенное расширение (20-30%)
4. **Month 4-6:** Миграция большинства проектов
5. **Month 7+:** Новые проекты на universal по умолчанию
6. **Month 12+:** Удаление legacy (если 100% мигрировали)

---

## 🔄 Rollback Plan

### Для одного проекта
```sql
UPDATE "projects" 
SET "widget_version" = 'legacy'
WHERE id = 'project_id';
```

### Для всех проектов (Emergency)
```sql
UPDATE "projects" 
SET "widget_version" = 'legacy';
```

### Kill Switch (.env)
```env
FORCE_LEGACY_WIDGET=true
```

```typescript
// В API endpoint
if (process.env.FORCE_LEGACY_WIDGET === 'true') {
  return { ...config, widgetVersion: 'legacy' };
}
```

---

## 📝 Implementation Details

### Files Changed
1. **prisma/schema.prisma**
   - Added `widgetVersion` field to Project model
   - Default value: "legacy"

2. **prisma/migrations/20260201114318_add_widget_version/migration.sql**
   - Migration to add widget_version column
   - Set default for existing projects

3. **src/app/api/projects/[id]/widget/route.ts**
   - Added `widgetVersion` to project select
   - Included `widgetVersion` in response
   - Logging widget version on load

4. **src/app/api/webhook/[webhookSecret]/route.ts**
   - Added `widgetVersion` to project select
   - Logging widget version on webhook events

### Testing
```bash
# Check database
npx prisma studio

# Check API response
curl https://your-domain.com/api/projects/PROJECT_ID/widget

# Check logs
# Look for "widgetVersion" field in webhook logs
```

---

## 🎯 Success Criteria

### Phase 6.1 (Current) ✅
- [x] Database migration applied
- [x] API returns widgetVersion
- [x] Webhook logs widgetVersion
- [x] No breaking changes
- [x] All projects remain on legacy

### Phase 6.2 (Next)
- [ ] Super-admin UI created
- [ ] Can switch individual projects
- [ ] Can bulk switch projects
- [ ] History tracking implemented
- [ ] Metrics dashboard created

### Phase 6.3 (Future)
- [ ] 1-2 projects tested on universal
- [ ] 5-10 projects in beta
- [ ] No critical issues found
- [ ] Rollback plan tested
- [ ] Documentation updated

---

## 📚 Related Documents

- `.kiro/specs/universal-widget/migration-strategy.md` - Full migration strategy
- `.kiro/specs/universal-widget/tasks.md` - Task tracking
- `docs/changelog.md` - Change history
- `docs/universal-widget-guide.md` - Universal widget documentation
- `docs/widget-files-overview.md` - Widget architecture overview

---

## 🔗 Quick Links

### For Developers
- [Migration Strategy](.kiro/specs/universal-widget/migration-strategy.md)
- [Task Tracker](.kiro/specs/universal-widget/tasks.md)
- [Universal Widget Guide](./universal-widget-guide.md)

### For Super-Admins (Phase 6.2)
- Widget Versions Dashboard: `/super-admin/widget-versions` (coming soon)
- Project Management: `/super-admin/projects`
- System Logs: `/super-admin/errors`

---

**Last Updated:** 2026-02-01  
**Status:** Phase 6.1 Complete, Phase 6.2 Ready to Start  
**Progress:** 19/21 tasks (90%)
