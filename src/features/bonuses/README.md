# Система управления бонусами

Полноценная система управления бонусными программами для пользователей с поддержкой массовых операций, автоматических уведомлений и cron jobs.

## 🚀 Возможности

### ✅ Завершенные функции

#### 1. Диалог списания бонусов
- ✅ Валидация суммы списания
- ✅ Проверка достаточности средств 
- ✅ Предварительный расчет остатка
- ✅ Подтверждение операции
- ✅ Запись в историю транзакций

#### 2. Массовые операции
- ✅ Выбор нескольких пользователей (checkbox)
- ✅ Групповое начисление бонусов
- ✅ Групповое списание бонусов  
- ✅ Установка одинакового баланса
- ✅ Массовая отправка уведомлений
- ✅ Floating toolbar для выбранных пользователей

#### 3. Production готовность
- ✅ Валидация данных
- ✅ Обработка ошибок
- ✅ Лимитирование операций
- ✅ Логирование для аудита
- ✅ Кэширование
- ✅ Оптимизация производительности
- ✅ Экспорт данных в CSV

#### 4. Cron jobs
- ✅ Автоматическое обнаружение истекающих бонусов
- ✅ Отправка уведомлений об истечении
- ✅ Списание истекших бонусов
- ✅ API endpoint для cron jobs
- ✅ Защищенный доступ к cron API

## 📁 Структура проекта

```
src/features/bonuses/
├── components/           # React компоненты
│   ├── bonus-management-page.tsx      # Главная страница
│   ├── users-table.tsx               # Таблица пользователей 
│   ├── bonus-deduction-dialog.tsx    # Диалог списания
│   ├── bonus-addition-dialog.tsx     # Диалог начисления
│   ├── bulk-actions-toolbar.tsx      # Тулбар массовых операций
│   ├── bulk-bonus-dialog.tsx         # Диалог массовых операций
│   ├── bulk-notification-dialog.tsx  # Диалог уведомлений
│   ├── user-transactions-dialog.tsx  # История транзакций
│   └── bonus-stats-cards.tsx         # Статистические карты
├── stores/              # Zustand store
│   └── bonus-store.ts   # Управление состоянием
├── types/               # TypeScript типы
│   └── index.ts         # Основные типы
├── utils/               # Утилиты
│   ├── bonus-expiration.ts  # Логика истечения бонусов
│   └── production.ts        # Production утилиты
└── README.md           # Документация
```

## 🛠 Основные компоненты

### BonusManagementPage
Главная страница системы с:
- Статистическими карточками
- Таблицей пользователей
- Поиском и фильтрацией
- Уведомлениями об истекающих бонусах

### UsersTable
Интерактивная таблица с:
- Множественным выбором (checkbox)
- Сортировкой и фильтрацией  
- Контекстным меню для каждого пользователя
- Визуальными индикаторами состояния

### BulkActionsToolbar
Floating тулбар для выбранных пользователей:
- Отображается только при выборе пользователей
- Показывает количество выбранных и общий баланс
- Dropdown меню с опциями операций

### Диалоги операций
- **BonusDeductionDialog**: Списание с валидацией
- **BonusAdditionDialog**: Начисление с настройкой сроков
- **BulkBonusDialog**: Массовые операции с предпросмотром
- **BulkNotificationDialog**: Отправка уведомлений

## 📊 Управление состоянием

### Zustand Store (bonus-store.ts)
Централизованное управление состоянием:

```typescript
// Основные операции
const { 
  // Данные
  users, transactions, stats,
  
  // Выбор пользователей
  selectedUsers, selectUser, clearSelection,
  
  // Операции с бонусами
  addBonusToUser, deductBonusFromUser,
  
  // Массовые операции
  bulkAddBonus, bulkDeductBonus, bulkSetBalance
} = useBonusStore();
```

## 🔄 Cron Jobs

### API Endpoint: `/api/cron/bonus-expiration`
Автоматическая обработка истечения бонусов:

```bash
# Ежедневный запуск (в crontab)
0 0 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/bonus-expiration

# Ручной запуск для тестирования
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/bonus-expiration
```

### Функции cron job:
1. **Обнаружение истекших бонусов**
2. **Создание транзакций списания**
3. **Обновление балансов пользователей**
4. **Отправка уведомлений об истечении**
5. **Планирование предупреждений (за 7, 3, 1 день)**

## 🔒 Безопасность

### Валидация данных
```typescript
import { validateUserData, validateTransaction } from '../utils/production';

const { isValid, errors } = validateUserData(userData);
if (!isValid) {
  console.error('Validation errors:', errors);
}
```

### Лимитирование операций
```typescript
import { OperationLimiter } from '../utils/production';

const limiter = new OperationLimiter(100, 1000); // 100/час, 1000/день
const { allowed, reason } = limiter.canPerformOperation(userId);
```

### Логирование аудита
```typescript
import { AuditLogger } from '../utils/production';

AuditLogger.log('BONUS_DEDUCTION', userId, { amount, reason }, adminId);
```

## 📈 Производительность

### Кэширование
```typescript
import { SimpleCache } from '../utils/production';

const cache = new SimpleCache<UserStats>(5 * 60 * 1000); // 5 минут
cache.set(`user-stats-${userId}`, stats);
```

### Дебаунсинг поиска
```typescript
import { debounce } from '../utils/production';

const debouncedSearch = debounce(searchFunction, 300);
```

## 🚀 Запуск и разработка

### 1. Установка зависимостей
```bash
pnpm install
```

### 2. Настройка переменных окружения
```bash
cp env.example.txt .env.local
# Добавьте CRON_SECRET=your-secret-key
```

### 3. Запуск в режиме разработки
```bash
pnpm dev
```

### 4. Переход к бонусной системе
Откройте `http://localhost:3000/dashboard/bonuses`

## 🧪 Тестирование

### Тестирование cron job
```bash
# Локальное тестирование
curl -X POST -H "Authorization: Bearer your-secret" \
  http://localhost:3000/api/cron/bonus-expiration
```

### Демо данные
Система автоматически загружает демо данные:
- 5 пользователей с разными балансами
- Образцы транзакций
- Статистика системы

## 📦 Экспорт данных

### CSV экспорт
```typescript
import { exportToCSV } from '../utils/production';

const csvData = users.map(user => ({
  'Имя': user.name,
  'Email': user.email, 
  'Баланс': user.bonusBalance
}));

exportToCSV(csvData, 'users-export.csv');
```

## 🔧 Кастомизация

### Настройка лимитов операций
```typescript
// В bonus-store.ts или production.ts
const limiter = new OperationLimiter(
  50,   // операций в час
  500   // операций в день
);
```

### Настройка уведомлений об истечении
```typescript
// В bonus-expiration.ts
const warningDays = [14, 7, 3, 1]; // Дни до истечения для уведомлений
```

### Кастомизация валидации
```typescript
// Добавление собственных правил валидации
export function customValidateUser(user: User): ValidationResult {
  // Ваша логика валидации
}
```

## 🚀 Деплой в продакшн

### 1. Переменные окружения
```bash
CRON_SECRET=secure-random-secret-key-here
NODE_ENV=production
```

### 2. Настройка cron jobs
```bash
# Добавить в crontab
0 0 * * * curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://your-production-domain.com/api/cron/bonus-expiration
```

### 3. Мониторинг
- Настройте логирование операций
- Мониторинг API endpoint'ов cron jobs
- Отслеживание ошибок валидации

## 📋 TODO для дальнейшего развития

- [ ] Интеграция с реальной базой данных
- [ ] Email уведомления (SendGrid/PostMark)
- [ ] Push уведомления
- [ ] Расширенная аналитика и отчеты
- [ ] A/B тестирование бонусных программ
- [ ] API для мобильных приложений
- [ ] Интеграция с платежными системами
- [ ] Многоуровневая система лояльности

## 🤝 Вклад в развитие

1. Форкните репозиторий
2. Создайте feature-ветку
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл LICENSE для деталей.