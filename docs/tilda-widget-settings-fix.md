# Исправление настроек виджета Tilda

**Дата**: 2026-01-11  
**Статус**: ✅ Завершено

## Проблемы

### 1. Дублирование процента начисления
**Описание**: Процент начисления задавался в трёх местах:
- В настройках проекта (`bonusPercentage`)
- В уровнях бонусов (`/bonus-levels`)
- В настройках виджета (`productBadgeBonusPercent`)

**Путаница**: Непонятно, какой процент используется для реального начисления бонусов.

### 2. Позиция плашки не меняется в preview
**Описание**: При изменении "Позиция плашки" (до цены/после цены/кастомная) preview не обновлялся и всегда показывал плашку справа от цены.

## Решение

### 1. Автоматическое определение процента
Создан API endpoint `/api/projects/[id]/max-bonus-percent`, который:
- Получает `bonusPercentage` из настроек проекта
- Получает все активные bonus levels
- Возвращает максимальный процент из всех источников

**Автозагрузка**:
- При открытии настроек интеграции процент автоматически загружается
- Поле процента теперь **readonly** — пользователь не может его редактировать
- Процент всегда актуален и синхронизирован с настройками проекта

**Логика**:
```typescript
// 1. Берём процент из проекта
let maxPercent = project.bonusPercentage;

// 2. Если есть уровни, берём максимальный
if (bonusLevels.length > 0) {
  const maxLevelPercent = Math.max(...bonusLevels.map(l => l.bonusPercent));
  maxPercent = Math.max(maxPercent, maxLevelPercent);
}

// 3. Автоматически устанавливаем в виджет (readonly)
widgetSettings.productBadgeBonusPercent = maxPercent;
```

### 2. Исправление preview позиции плашки
Изменена структура preview с учётом выбранной позиции:

```tsx
// До исправления
<div className='flex items-center gap-4'>
  <div>3 990 р.</div>
  <div>{badge}</div> {/* Всегда справа */}
</div>

// После исправления
<div className='flex flex-col gap-2'>
  {position === 'before-price' && <div>{badge}</div>}
  <div>3 990 р.</div>
  {position === 'after-price' && <div>{badge}</div>}
  {position === 'custom' && <div>Кастомная позиция: {selector}</div>}
</div>
```

## Файлы

- `src/app/api/projects/[id]/max-bonus-percent/route.ts` — новый API endpoint
- `src/features/projects/components/tilda-integration-view.tsx` — автозагрузка процента, readonly display
- `docs/changelog.md` — обновлён changelog
- `docs/tilda-widget-settings-fix.md` — эта документация

## Тестирование

1. Открыть настройки интеграции Tilda
2. Проверить что процент автоматически загрузился из настроек проекта (readonly поле)
3. Изменить процент в настройках проекта или bonus-levels
4. Обновить страницу настроек интеграции → процент должен обновиться автоматически
5. Изменить "Позиция плашки" → preview должен обновиться

## Важно

**Процент начисления в виджете** (`productBadgeBonusPercent`) теперь **readonly** и автоматически синхронизируется с максимальным процентом из настроек проекта или bonus-levels. Это ТОЛЬКО для визуального отображения плашек на товарах.

**Реальное начисление** определяется:
1. Настройками проекта (`/dashboard/projects/[id]/settings`)
2. Уровнями бонусов (`/dashboard/projects/[id]/bonus-levels`)
