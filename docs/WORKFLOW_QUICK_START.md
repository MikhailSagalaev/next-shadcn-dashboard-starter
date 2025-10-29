# Workflow Constructor — Quick Start Guide

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- PostgreSQL 14+
- Redis (опционально, для кэширования)
- pnpm или npm

### 1. Применить миграции

```bash
# Применить новые индексы для производительности
pnpm prisma migrate deploy
```

### 2. Настроить переменные окружения

Убедитесь, что в `.env` или `.env.local` есть:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
REDIS_URL="redis://localhost:6379"  # Опционально
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Запустить тесты

```bash
# Проверить что всё работает
pnpm test

# С покрытием
pnpm test --coverage
```

### 4. Запустить приложение

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

---

## 📖 Основные возможности

### Создание workflow

1. Перейдите в проект: `/dashboard/projects/[id]/workflow`
2. Нажмите "Создать workflow"
3. Добавьте ноды из категоризированного тулбара
4. Соедините ноды
5. Настройте конфигурацию каждой ноды
6. Сохраните и активируйте

### Мониторинг выполнений

1. Перейдите: `/dashboard/projects/[id]/workflow/monitoring`
2. Выберите workflow из списка
3. Просмотрите таблицу executions
4. Кликните на execution для деталей
5. Изучите логи, переменные и timeline

### Отладка workflow

1. Откройте execution details
2. Просмотрите timeline выполнения
3. Проверьте переменные на каждом шаге
4. Изучите логи для ошибок
5. При необходимости перезапустите execution

---

## 📚 Документация

### Node Types Reference

- [Триггеры](./nodes-reference/triggers.md) — command, message, callback, webhook, email
- [Сообщения](./nodes-reference/messages.md) — text, keyboards, media, edit, delete
- [Действия](./nodes-reference/actions.md) — API, database, users, notifications

### Примеры

- [Система лояльности](./workflow-examples/loyalty-program.md) — полный пример с webhook интеграцией

### Отчёты

- [Completion Report](./WORKFLOW_CONSTRUCTOR_COMPLETION_REPORT.md) — детальный отчёт о рефакторинге

---

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
pnpm test

# Конкретный файл
pnpm test message-handler.test.ts

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

### Структура тестов

```
__tests__/
├── workflow/
│   ├── handlers/
│   │   ├── message-handler.test.ts
│   │   ├── condition-handler.test.ts
│   │   └── action-handlers.test.ts
│   ├── workflow-validator.test.ts
│   └── integration/
│       └── loyalty-workflow.test.ts
```

---

## 🔧 Troubleshooting

### Workflow не выполняется

1. Проверьте что workflow активирован
2. Убедитесь что триггер настроен правильно
3. Проверьте логи выполнения в мониторинге
4. Проверьте валидацию workflow (нет ошибок)

### Медленное выполнение

1. Проверьте что Redis настроен и работает
2. Убедитесь что миграция с индексами применена
3. Проверьте метрики в мониторинге
4. Оптимизируйте запросы к БД в workflow

### Ошибки TypeScript

```bash
# Проверить типы
npx tsc --noEmit

# Если ошибки в scripts/ или test файлах — это нормально
# Критичны только ошибки в src/
```

---

## 📊 Метрики и мониторинг

### Ключевые метрики

- **Success Rate** — процент успешных выполнений
- **Average Duration** — среднее время выполнения
- **Bottleneck Nodes** — самые медленные ноды
- **Error Rate** — частота ошибок

### Где смотреть

1. Dashboard: `/dashboard/projects/[id]/workflow/monitoring`
2. Execution details: детальная информация по каждому запуску
3. Timeline: визуализация шагов выполнения
4. Logs: подробные логи каждого шага

---

## 🎯 Best Practices

### Проектирование workflow

1. **Начинайте с простого** — добавляйте сложность постепенно
2. **Используйте валидацию** — проверяйте workflow перед сохранением
3. **Тестируйте часто** — проверяйте каждое изменение
4. **Логируйте всё** — добавляйте логи для отладки
5. **Используйте переменные** — избегайте hardcode значений

### Производительность

1. **Кэшируйте данные** — используйте переменные для повторного использования
2. **Минимизируйте запросы** — объединяйте операции где возможно
3. **Используйте условия** — избегайте ненужных действий
4. **Оптимизируйте запросы** — добавляйте фильтры и лимиты

### Безопасность

1. **Валидируйте входные данные** — всегда проверяйте webhook payload
2. **Используйте secrets** — храните API keys в переменных проекта
3. **Ограничивайте доступ** — используйте RBAC
4. **Логируйте действия** — отслеживайте изменения

---

## 🆘 Поддержка

### Документация

- [Node Reference](./nodes-reference/) — справка по всем типам нод
- [Examples](./workflow-examples/) — готовые примеры workflow
- [Changelog](./changelog.md) — история изменений

### Логи

```bash
# Просмотр логов приложения
tail -f app.log

# Просмотр логов разработки
tail -f dev.log
```

### Полезные команды

```bash
# Проверка статуса БД
pnpm prisma studio

# Очистка кэша
redis-cli FLUSHALL

# Перезапуск workflow
# Используйте UI: Monitoring → Execution Details → Restart
```

---

## 🎉 Готово!

Workflow конструктор готов к использованию. Начните с простого workflow и постепенно добавляйте сложность.

**Рекомендуемый первый шаг**: Изучите [пример системы лояльности](./workflow-examples/loyalty-program.md) для понимания возможностей системы.

---

*Последнее обновление: 25 октября 2025*

