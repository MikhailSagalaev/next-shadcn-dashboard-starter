# Стратегия миграции Universal Widget

## 🎯 Цель
Безопасный переход с legacy виджета на новую архитектуру БЕЗ риска для существующих клиентов.

## 📋 Стратегия: Feature Flag + Контроль через Супер-Админку

### Phase 6.1: Подготовка (1 час)

#### 1. Добавить поле в Project model
```prisma
model Project {
  // ... существующие поля
  widgetVersion String @default("legacy") // "legacy" | "universal"
}
```

#### 2. Создать миграцию
```bash
npx prisma migrate dev --name add_widget_version
```

#### 3. Обновить API endpoint `/api/projects/[id]/widget`
```typescript
// Возвращать разный код в зависимости от версии
if (project.widgetVersion === 'universal') {
  // Новая архитектура
  return `
    <script src="${baseUrl}/widget-loader.js"></script>
    <script>
      window.gupilConfig = {
        projectId: '${projectId}',
        apiUrl: '${baseUrl}/api',
        platform: 'tilda' // или auto-detect
      };
    </script>
  `;
} else {
  // Legacy виджет (текущий)
  return `
    <script src="${baseUrl}/tilda-bonus-widget.js"></script>
    <script>
      window.gupilConfig = { /* ... */ };
    </script>
  `;
}
```

### Phase 6.2: UI в супер-админке (1 час)

#### Страница управления версиями виджета
```tsx
// src/app/super-admin/widget-versions/page.tsx

export default async function WidgetVersionsPage() {
  const projects = await getAllProjectsWithVersions();
  
  return (
    <div>
      <PageHeader
        title="Управление версиями виджета"
        description="Контроль версий виджета для всех проектов"
      />
      
      {/* Метрики */}
      <StatsCards>
        <StatCard 
          title="Legacy виджет"
          value={projects.filter(p => p.widgetVersion === 'legacy').length}
          icon={Package}
        />
        <StatCard 
          title="Universal виджет"
          value={projects.filter(p => p.widgetVersion === 'universal').length}
          icon={Rocket}
        />
      </StatsCards>
      
      {/* Таблица проектов */}
      <DataTable
        columns={[
          { header: 'Проект', accessor: 'name' },
          { header: 'Версия', accessor: 'widgetVersion' },
          { header: 'Создан', accessor: 'createdAt' },
          { header: 'Активность', accessor: 'lastActivity' },
          { 
            header: 'Действия', 
            cell: (row) => (
              <WidgetVersionToggle 
                projectId={row.id}
                currentVersion={row.widgetVersion}
              />
            )
          }
        ]}
        data={projects}
      />
      
      {/* Массовые действия */}
      <BulkActions>
        <Button onClick={switchSelectedToUniversal}>
          Переключить выбранные на Universal
        </Button>
        <Button onClick={switchSelectedToLegacy}>
          Вернуть выбранные на Legacy
        </Button>
      </BulkActions>
    </div>
  );
}
```

#### Компонент переключения версии
```tsx
// src/features/super-admin/components/widget-version-toggle.tsx
'use client';

export function WidgetVersionToggle({ projectId, currentVersion }) {
  const [version, setVersion] = useState(currentVersion);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleToggle = async () => {
    const confirmed = await confirm({
      title: 'Изменить версию виджета?',
      description: `Переключить проект на ${version === 'legacy' ? 'Universal' : 'Legacy'} версию?`,
      confirmText: 'Переключить'
    });
    
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      await fetch(`/api/super-admin/projects/${projectId}/widget-version`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          version: version === 'legacy' ? 'universal' : 'legacy' 
        })
      });
      
      setVersion(version === 'legacy' ? 'universal' : 'legacy');
      toast.success('Версия виджета изменена');
    } catch (error) {
      toast.error('Ошибка при изменении версии');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <Badge variant={version === 'universal' ? 'default' : 'secondary'}>
        {version === 'legacy' ? 'Legacy' : 'Universal'}
      </Badge>
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? 'Переключение...' : 'Переключить'}
      </Button>
    </div>
  );
}
```

### Phase 6.3: Мониторинг и тестирование (1 час)

#### 1. Логирование версии виджета
```typescript
// В webhook handler
logger.info('Widget event received', {
  projectId,
  widgetVersion: project.widgetVersion,
  action: payload.action
});
```

#### 2. Дашборд для мониторинга в супер-админке
```typescript
// src/app/super-admin/page.tsx - добавить метрики
const stats = {
  totalProjects: await db.project.count(),
  legacyProjects: await db.project.count({ 
    where: { widgetVersion: 'legacy' } 
  }),
  universalProjects: await db.project.count({ 
    where: { widgetVersion: 'universal' } 
  }),
  // Метрики ошибок
  legacyErrors: await getErrorCount('legacy'),
  universalErrors: await getErrorCount('universal')
};
```

#### 3. История изменений
```prisma
model WidgetVersionHistory {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  fromVersion String
  toVersion   String
  changedBy   String   // super-admin ID
  changedAt   DateTime @default(now())
  reason      String?  // Опциональная причина
}
```

### Phase 6.4: Постепенный Rollout

#### Этап 1: Внутреннее тестирование (1 неделя)
- Супер-админ переключает 1-2 тестовых проекта на universal
- Проверить все сценарии использования
- Собрать метрики ошибок

#### Этап 2: Бета-тестирование (2 недели)
- Выбрать 5-10 активных проектов
- Переключить через супер-админку на universal
- Мониторить метрики ежедневно
- Быстро откатывать при проблемах

#### Этап 3: Расширение (1 месяц)
- Постепенно переключать больше проектов
- Анализировать метрики каждую неделю
- Исправлять найденные баги

#### Этап 4: Новые проекты (через 2-3 месяца)
- Изменить default в Prisma schema на 'universal'
- Новые проекты создаются с universal по умолчанию
- Legacy остается для старых проектов

#### Этап 5: Полная миграция (через 6 месяцев)
- Переключить все оставшиеся проекты
- Удалить legacy код
- Обновить документацию

## 🔄 План отката

### Для одного проекта (через супер-админку):
- Открыть `/super-admin/widget-versions`
- Найти проект
- Нажать "Переключить" → вернется на legacy

### Для нескольких проектов (массово):
- Выбрать проекты в таблице
- Нажать "Вернуть выбранные на Legacy"

### Для всех проектов (emergency):
```sql
UPDATE "Project" 
SET "widgetVersion" = 'legacy';
```

### Kill switch в коде:
```typescript
// .env
FORCE_LEGACY_WIDGET=true

// В API endpoint
if (process.env.FORCE_LEGACY_WIDGET === 'true') {
  return legacyWidgetCode;
}
```

## 📊 Метрики успеха

### Отслеживать в супер-админке:
1. **Количество проектов на каждой версии**
2. **Частота ошибок** (legacy vs universal)
3. **Время отклика API** (legacy vs universal)
4. **Количество откатов** (сколько раз вернули на legacy)
5. **Активность проектов** (какие версии используют активные проекты)

### Dashboard в супер-админке:
```tsx
<StatsCards>
  <StatCard title="Legacy проекты" value="95" trend="-5%" />
  <StatCard title="Universal проекты" value="5" trend="+5%" />
  <StatCard title="Ошибки Legacy" value="0.1%" color="green" />
  <StatCard title="Ошибки Universal" value="0.05%" color="green" />
</StatsCards>

<Chart 
  title="Миграция проектов"
  data={migrationHistory}
  xAxis="date"
  yAxis="count"
  series={['legacy', 'universal']}
/>
```

## 🎯 Преимущества этого подхода

### ✅ Безопасность
- Legacy виджет продолжает работать
- Только супер-админ контролирует миграцию
- Клиенты не видят изменений (прозрачно)
- Можно откатиться в любой момент

### ✅ Контроль
- Полная видимость всех проектов
- Выбор конкретных проектов для миграции
- Массовые операции
- История всех изменений

### ✅ Гибкость
- Можно тестировать на разных типах проектов
- Постепенная миграция по критериям (активность, размер, и т.д.)
- Быстрый откат при проблемах

### ✅ Прозрачность для клиентов
- Клиенты не знают о миграции
- Нет путаницы с настройками
- Нет лишних вопросов в поддержку
- Код виджета обновляется автоматически

## 💡 Рекомендация

**Начать с супер-админки** потому что:
1. Полный контроль над процессом
2. Клиенты не вовлечены (меньше вопросов)
3. Можно тестировать на конкретных проектах
4. Легко откатиться
5. Прозрачно для конечных пользователей

**Timeline:**
- Неделя 1: Подготовка (Phase 6.1-6.2)
- Неделя 2: Внутреннее тестирование (1-2 проекта)
- Неделя 3-4: Бета-тестирование (5-10 проектов)
- Месяц 2-3: Расширение (20-30% проектов)
- Месяц 4-6: Постепенная миграция остальных
- Месяц 7+: Новые проекты на universal по умолчанию
- Месяц 12+: Удаление legacy кода (если 100% мигрировали)
