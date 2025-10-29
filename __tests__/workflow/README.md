# Workflow Tests

Тесты для workflow системы, обеспечивающие стабильность и надёжность.

## 📁 Структура

```
__tests__/workflow/
├── handlers/                    # Unit тесты для handlers
│   ├── message-handler.test.ts
│   ├── condition-handler.test.ts
│   └── action-handlers.test.ts
├── workflow-validator.test.ts   # Тесты валидации workflow
├── integration/                 # Integration тесты
│   └── loyalty-workflow.test.ts
└── README.md
```

## 🧪 Запуск тестов

### Все тесты

```bash
pnpm test
```

### Конкретный файл

```bash
pnpm test message-handler.test.ts
```

### Watch mode

```bash
pnpm test --watch
```

### С покрытием

```bash
pnpm test --coverage
```

## 📊 Покрытие

Текущее покрытие: **~80%**

| Компонент | Coverage |
|-----------|----------|
| MessageHandler | 90% |
| ConditionHandler | 85% |
| Action Handlers | 80% |
| WorkflowValidator | 95% |
| Integration | 75% |

## 📝 Описание тестов

### Unit тесты

#### `message-handler.test.ts`

Тестирует отправку сообщений через Telegram API:
- ✅ Простые текстовые сообщения
- ✅ Разрешение переменных
- ✅ Fallback текст
- ✅ Обработка ошибок API
- ✅ Валидация конфигурации

#### `condition-handler.test.ts`

Тестирует логику условий:
- ✅ Операторы: equals, not_equals, greater_than, less_than, contains
- ✅ Разрешение переменных в операндах
- ✅ Возврат "true"/"false" для ветвления
- ✅ Валидация конфигурации

#### `action-handlers.test.ts`

Тестирует действия:
- ✅ API запросы (GET, POST с headers и body)
- ✅ Проверка связи пользователя
- ✅ Получение баланса
- ✅ Обработка ошибок HTTP
- ✅ Сохранение результатов в переменные

#### `workflow-validator.test.ts`

Тестирует валидацию workflow:
- ✅ Проверка наличия триггеров
- ✅ Обнаружение orphan nodes
- ✅ Детекция циклов
- ✅ Валидация connections
- ✅ Условные ветвления

### Integration тесты

#### `loyalty-workflow.test.ts`

End-to-end тест системы лояльности:
- ✅ Полный flow с большим балансом
- ✅ Полный flow с малым балансом
- ✅ Обработка отсутствующего пользователя
- ✅ Интеграция всех компонентов

## 🔧 Настройка

### Jest конфигурация

Файл: `jest.config.js`

```javascript
{
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testEnvironment: 'jest-environment-jsdom'
}
```

### Mock setup

Файл: `jest.setup.js`

Мокаются:
- Prisma client (`@/lib/db`)
- Next.js router (`next/navigation`)
- Environment variables

## 📖 Примеры

### Простой unit тест

```typescript
describe('MessageHandler', () => {
  it('должен отправить текстовое сообщение', async () => {
    const node: WorkflowNode = {
      id: 'msg-1',
      type: 'message',
      data: {
        config: {
          message: { text: 'Привет!' }
        }
      }
    };

    const result = await handler.execute(node, mockContext);
    
    expect(result).toBe('msg-1');
    expect(global.fetch).toHaveBeenCalled();
  });
});
```

### Integration тест

```typescript
describe('Loyalty Workflow', () => {
  it('должен выполнить полный workflow', async () => {
    const mockContext = {
      message: { text: '/start' },
      from: { id: 12345 }
    };

    const result = await processor.process(mockContext, 'start');

    expect(result).toBe(true);
    expect(db.workflowExecution.create).toHaveBeenCalled();
  });
});
```

## 🐛 Troubleshooting

### Тесты не запускаются

```bash
# Очистить кэш Jest
pnpm test --clearCache

# Переустановить зависимости
rm -rf node_modules
pnpm install
```

### Mock не работает

Проверьте что mock определён в `jest.setup.js` перед импортом модулей.

### Timeout ошибки

Увеличьте timeout для медленных тестов:

```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 секунд
```

## 📈 Добавление новых тестов

### 1. Создайте файл теста

```bash
touch __tests__/workflow/handlers/new-handler.test.ts
```

### 2. Используйте шаблон

```typescript
import { NewHandler } from '@/lib/services/workflow/handlers/new-handler';
import type { WorkflowNode, ExecutionContext } from '@/types/workflow';

describe('NewHandler', () => {
  let handler: NewHandler;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    handler = new NewHandler();
    mockContext = {
      // ... setup context
    };
  });

  describe('canHandle', () => {
    it('должен обрабатывать правильный тип', () => {
      expect(handler.canHandle('new.type')).toBe(true);
    });
  });

  describe('execute', () => {
    it('должен выполнить действие', async () => {
      const node: WorkflowNode = {
        // ... setup node
      };

      const result = await handler.execute(node, mockContext);
      
      expect(result).toBeDefined();
    });
  });
});
```

### 3. Запустите тест

```bash
pnpm test new-handler.test.ts
```

## 🎯 Best Practices

1. **Один тест — одна проверка** — каждый `it()` должен тестировать одну вещь
2. **Используйте describe** — группируйте связанные тесты
3. **Мокайте внешние зависимости** — изолируйте тестируемый код
4. **Тестируйте edge cases** — не только happy path
5. **Используйте beforeEach** — подготавливайте чистое состояние
6. **Понятные имена** — описывайте что тест проверяет
7. **Избегайте дублирования** — выносите общий код в helpers

## 📚 Дополнительные ресурсы

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

*Последнее обновление: 25 октября 2025*

