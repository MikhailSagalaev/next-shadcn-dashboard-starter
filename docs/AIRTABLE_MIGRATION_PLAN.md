# 🏗️ План миграции заказчиков из Airtable в SaaS Бонусную Систему

## 📋 Обзор

Этот документ содержит подробный план миграции базы заказчиков из Airtable в мультитенантную SaaS систему управления бонусными программами.

## 🎯 Цели миграции

- Перенести всех заказчиков из Airtable без потери данных
- Сохранить историческую информацию о покупках
- Настроить корректные уровни бонусов на основе суммы покупок
- Создать резервные копии перед миграцией
- Обеспечить целостность данных

## 📊 Структура данных

### Текущая модель User в системе:

```typescript
{
  id: string;
  projectId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  telegramId?: BigInt;
  telegramUsername?: string;
  isActive: boolean;
  registeredAt: DateTime;
  currentLevel: string;
  referralCode?: string;
  referredBy?: string;
  totalPurchases: Decimal;
  utmCampaign?: string;
  utmContent?: string;
  utmMedium?: string;
  utmSource?: string;
  utmTerm?: string;
}
```

### Типичные поля в Airtable:

```typescript
// Возможные поля для импорта
{
  "Имя": "string",
  "Фамилия": "string",
  "Email": "string",
  "Телефон": "string",
  "Дата рождения": "string|Date",
  "Город": "string",
  "Адрес": "string",
  "Компания": "string",
  "Сумма покупок": "number",
  "Количество покупок": "number",
  "Дата первой покупки": "string|Date",
  "Дата последней активности": "string|Date",
  "Статус": "string", // активный/неактивный/архив
  "UTM Source": "string",
  "UTM Medium": "string",
  "UTM Campaign": "string",
  "UTM Term": "string",
  "UTM Content": "string",
  "Комментарии": "string",
  "Реферальный код": "string"
}
```

## 📝 Этапы миграции

### Этап 1: Подготовка и анализ данных

#### 1.1 Экспорт данных из Airtable
```bash
# Создать CSV экспорт из Airtable
# Скачать файл customers_export.csv
```

#### 1.2 Создание проекта в системе
```typescript
// Создать новый проект через админ-панель
const project = await ProjectService.createProject({
  name: "Название компании заказчика",
  domain: "company-domain.com",
  bonusPercentage: 5.0,
  bonusExpiryDays: 365
});
```

#### 1.3 Анализ и очистка данных
```bash
# Запустить скрипт анализа данных
npm run analyze-airtable-data customers_export.csv
```

### Этап 2: Создание скрипта миграции

#### 2.1 Скрипт миграции заказчиков

✅ **ГОТОВО!** Созданы все необходимые скрипты миграции:

- `scripts/migrate-airtable-customers.ts` - основной скрипт миграции
- `scripts/update-user-levels.ts` - обновление уровней
- `scripts/validate-migration.ts` - валидация данных
- `scripts/rollback-migration.ts` - откат миграции
- `scripts/README_MIGRATION.md` - подробная документация

**Быстрый запуск:**
```bash
# 1. Миграция заказчиков
yarn migrate-customers customers.csv PROJECT_ID

# 2. Обновление уровней
yarn update-levels PROJECT_ID

# 3. Валидация
yarn validate-migration PROJECT_ID

# 4. Откат при проблемах
yarn rollback-migration PROJECT_ID
```

```typescript
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parser';

const prisma = new PrismaClient();

interface AirtableCustomer {
  'Имя'?: string;
  'Фамилия'?: string;
  'Email'?: string;
  'Телефон'?: string;
  'Дата рождения'?: string;
  'Город'?: string;
  'Сумма покупок'?: string;
  'Дата первой покупки'?: string;
  'Статус'?: string;
  'UTM Source'?: string;
  'UTM Medium'?: string;
  'UTM Campaign'?: string;
  // ... остальные поля
}

async function migrateCustomers(csvPath: string, projectId: string) {
  const customers: AirtableCustomer[] = [];

  // Чтение CSV файла
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data) => customers.push(data))
    .on('end', async () => {
      console.log(`Найдено ${customers.length} заказчиков`);

      for (const customer of customers) {
        await migrateCustomer(customer, projectId);
      }

      console.log('Миграция завершена');
    });
}

async function migrateCustomer(customer: AirtableCustomer, projectId: string) {
  try {
    // Преобразование данных
    const userData = {
      projectId,
      firstName: customer['Имя'],
      lastName: customer['Фамилия'],
      email: customer['Email']?.toLowerCase().trim(),
      phone: normalizePhone(customer['Телефон']),
      birthDate: customer['Дата рождения'] ? new Date(customer['Дата рождения']) : undefined,
      totalPurchases: parseFloat(customer['Сумма покупок'] || '0'),
      isActive: customer['Статус'] !== 'архив',
      utmSource: customer['UTM Source'],
      utmMedium: customer['UTM Medium'],
      utmCampaign: customer['UTM Campaign'],
      registeredAt: customer['Дата первой покупки']
        ? new Date(customer['Дата первой покупки'])
        : new Date()
    };

    // Создание пользователя
    const user = await prisma.user.create({
      data: userData
    });

    // Создание реферального кода
    if (user.email) {
      const referralCode = generateReferralCode(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode }
      });
    }

    console.log(`Создан пользователь: ${user.firstName} ${user.lastName} (${user.email})`);
  } catch (error) {
    console.error(`Ошибка миграции пользователя ${customer['Email']}:`, error);
  }
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;

  // Удалить все кроме цифр
  const cleaned = phone.replace(/\D/g, '');

  // Если начинается с 7 или 8, преобразовать в международный формат
  if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
    return `+7${cleaned.slice(1)}`;
  }

  // Если уже в международном формате
  if (cleaned.startsWith('7')) {
    return `+${cleaned}`;
  }

  return phone;
}

function generateReferralCode(email: string): string {
  // Генерация уникального реферального кода
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}_${random}`.toUpperCase();
}

// Запуск миграции
migrateCustomers(process.argv[2], process.argv[3])
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Этап 3: Создание уровней бонусов

#### 3.1 Настройка уровней бонусов
```typescript
// Создать уровни бонусов на основе суммы покупок
const levels = [
  { name: 'Базовый', minAmount: 0, maxAmount: 10000, bonusPercent: 5, paymentPercent: 5 },
  { name: 'Серебряный', minAmount: 10000, maxAmount: 50000, bonusPercent: 7, paymentPercent: 7 },
  { name: 'Золотой', minAmount: 50000, maxAmount: 100000, bonusPercent: 10, paymentPercent: 10 },
  { name: 'Платиновый', minAmount: 100000, bonusPercent: 15, paymentPercent: 15 }
];

for (const level of levels) {
  await prisma.bonusLevel.create({
    data: {
      ...level,
      projectId: project.id
    }
  });
}
```

#### 3.2 Автоматическое определение уровней
```typescript
// Скрипт для обновления уровней пользователей
async function updateUserLevels(projectId: string) {
  const users = await prisma.user.findMany({
    where: { projectId },
    include: { project: { include: { bonusLevels: true } } }
  });

  for (const user of users) {
    const levels = user.project.bonusLevels.sort((a, b) => a.minAmount - b.minAmount);

    for (const level of levels.reverse()) {
      if (user.totalPurchases >= level.minAmount) {
        await prisma.user.update({
          where: { id: user.id },
          data: { currentLevel: level.name }
        });
        break;
      }
    }
  }
}
```

### Этап 4: Миграция истории покупок

#### 4.1 Создание транзакций для существующих покупок
```typescript
// Если есть история покупок, создать транзакции EARN
async function createPurchaseTransactions(userId: string, purchaseAmount: number, purchaseDate: Date) {
  await prisma.transaction.create({
    data: {
      userId,
      amount: purchaseAmount.toString(),
      type: 'EARN',
      description: `Начисление бонусов за покупку`,
      createdAt: purchaseDate
    }
  });
}
```

### Этап 5: Тестирование и валидация

#### 5.1 Скрипт валидации данных
```typescript
async function validateMigration(projectId: string) {
  const stats = await prisma.user.groupBy({
    by: ['projectId'],
    where: { projectId },
    _count: { id: true },
    _sum: { totalPurchases: true }
  });

  console.log('Статистика миграции:');
  console.log(`- Всего пользователей: ${stats[0]._count.id}`);
  console.log(`- Общая сумма покупок: ${stats[0]._sum.totalPurchases}`);

  // Проверка дубликатов email
  const duplicateEmails = await prisma.$queryRaw`
    SELECT email, COUNT(*) as count
    FROM users
    WHERE project_id = ${projectId} AND email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  `;

  if (duplicateEmails.length > 0) {
    console.warn('Найдены дубликаты email:', duplicateEmails);
  }
}
```

## 🛠️ Необходимые скрипты

### 1. Основной скрипт миграции
```bash
# scripts/migrate-airtable-customers.ts
npm run migrate-customers customers_export.csv PROJECT_ID
```

### 2. Скрипт обновления уровней
```bash
# scripts/update-user-levels.ts
npm run update-levels PROJECT_ID
```

### 3. Скрипт валидации
```bash
# scripts/validate-migration.ts
npm run validate-migration PROJECT_ID
```

### 4. Скрипт отката (на случай проблем)
```bash
# scripts/rollback-migration.ts
npm run rollback-migration PROJECT_ID
```

## 📋 Чек-лист выполнения

### Подготовка:
- [ ] Экспорт данных из Airtable в CSV
- [ ] Создание проекта в системе
- [ ] Анализ структуры данных Airtable
- [ ] Создание резервной копии БД

### Миграция:
- [ ] Запуск скрипта миграции заказчиков
- [ ] Обновление уровней пользователей
- [ ] Создание истории транзакций (если есть)
- [ ] Настройка реферальных программ

### Валидация:
- [ ] Проверка количества перенесенных пользователей
- [ ] Валидация email и телефонов
- [ ] Проверка отсутствия дубликатов
- [ ] Тестирование работы системы с новыми данными

### Пост-миграция:
- [ ] Настройка Telegram ботов для проекта
- [ ] Настройка webhook интеграций
- [ ] Тестирование уведомлений
- [ ] Обучение клиента работе с системой

## ⚠️ Риски и меры предосторожности

### Риски:
1. **Дубликаты данных** - проверка на существующие email/телефоны
2. **Некорректные форматы** - валидация и нормализация данных
3. **Потеря данных** - создание резервных копий
4. **Неправильные уровни** - тестирование логики определения уровней

### Меры:
1. **Тестирование на копии данных** - сначала протестировать на dev среде
2. **Пошаговая миграция** - переносить данные небольшими батчами
3. **Логирование всех операций** - подробные логи для откладки
4. **Резервные копии** - возможность полного отката

## 📊 Метрики успеха

- **Количество пользователей**: должно совпадать с Airtable
- **Сумма покупок**: должна совпадать с Airtable
- **Активные пользователи**: корректный статус
- **Уровни бонусов**: корректное определение
- **Отсутствие ошибок**: в логах системы

## 💡 Рекомендации

1. **Начать с малого** - протестировать миграцию на 10-20 пользователях
2. **Документировать все шаги** - создавать логи всех операций
3. **Иметь план B** - возможность отката миграции
4. **Вовлекать клиента** - регулярные отчеты о прогрессе
5. **Тестировать функциональность** - проверить все возможности системы

---

*План миграции создан для безопасного и эффективного переноса данных из Airtable в SaaS бонусную систему.*
