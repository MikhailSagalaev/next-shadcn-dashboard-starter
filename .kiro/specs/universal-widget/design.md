# Universal Widget - Дизайн архитектуры

> **Версия:** 3.0.0  
> **Дата:** 2026-01-31  
> **Статус:** 🚧 В разработке

## 📐 Архитектурные принципы

### 1. Separation of Concerns
- **Core** — платформо-независимая бизнес-логика
- **Adapter** — платформо-специфичная интеграция
- **Loader** — автоматическая инициализация

### 2. Interface Segregation
- Адаптеры реализуют только нужные методы
- Опциональные методы помечены как `optional`
- Минимальный интерфейс для базовой работы

### 3. Dependency Inversion
- Core зависит от абстракции (IWidgetAdapter)
- Адаптеры зависят от Core, а не наоборот
- Легкая замена адаптеров без изменения Core

### 4. Open/Closed Principle
- Core закрыт для изменений
- Открыт для расширения через адаптеры
- Новые платформы = новые адаптеры

## 🏗️ Структура проекта

```
public/
├── universal-widget.js          # Core (15KB gzip)
├── widget-loader.js             # Loader (3KB gzip)
├── adapters/
│   ├── tilda-adapter.js         # Tilda (5KB gzip)
│   ├── shopify-adapter.js       # Shopify (будущее)
│   ├── woocommerce-adapter.js   # WooCommerce (будущее)
│   └── custom-adapter.js        # Custom (будущее)
└── tilda-bonus-widget.js        # Legacy (deprecated)
```

## 🔌 Интерфейс IWidgetAdapter

```typescript
interface IWidgetAdapter {
  // === ОБЯЗАТЕЛЬНЫЕ МЕТОДЫ ===
  
  /**
   * Инициализация адаптера
   * Вызывается один раз при создании
   */
  init(): void;
  
  /**
   * Получить текущую сумму корзины
   * @returns {number} Сумма в рублях
   */
  getCartTotal(): number;
  
  /**
   * Получить контактные данные пользователя
   * @returns {{ email: string | null, phone: string | null }}
   */
  getContactInfo(): { email: string | null; phone: string | null };
  
  /**
   * Очистка ресурсов при уничтожении
   */
  destroy(): void;
  
  // === ОПЦИОНАЛЬНЫЕ МЕТОДЫ ===
  
  /**
   * Применить промокод к корзине
   * @param {string} code - Промокод
   * @returns {Promise<boolean>} Успешность применения
   */
  applyPromocode?(code: string): Promise<boolean>;
  
  /**
   * Скрыть/показать нативное поле промокода
   * @param {boolean} hidden - Скрыть или показать
   */
  setPromocodeFieldVisibility?(hidden: boolean): void;
  
  /**
   * Наблюдать за изменениями корзины
   * Должен вызывать core.onPlatformCartUpdate(total)
   */
  observeCart?(): void;
  
  /**
   * Наблюдать за вводом пользователя
   * Должен вызывать core.onUserDataUpdate(data)
   */
  observeUserInput?(): void;
  
  /**
   * Инициализировать бонусные плашки на товарах
   * @param {object} settings - Настройки виджета
   * @param {Function} calculatorFn - Функция расчета бонусов
   */
  initProductBadges?(settings: object, calculatorFn: (price: number) => number): void;
  
  /**
   * Монтировать инлайн виджет в структуру страницы
   * @param {Function} renderCallback - Функция рендера из Core
   */
  mountInlineWidget?(renderCallback: (container: HTMLElement) => void): void;
  
  /**
   * Получить товары в корзине
   * @returns {Array<CartItem>}
   */
  getCartItems?(): Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}
```

## 🎨 Диаграмма взаимодействия

```
┌─────────────────────────────────────────────────────────┐
│                    widget-loader.js                      │
│  1. Определяет платформу (Tilda/Shopify/etc)           │
│  2. Загружает нужный адаптер                            │
│  3. Создает Core с адаптером                            │
│  4. Инициализирует виджет                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              LeadWidgetCore (universal-widget.js)        │
│                                                          │
│  Состояние:                                             │
│  - user: { email, phone, balance }                      │
│  - cartTotal: number                                    │
│  - widgetSettings: object                               │
│                                                          │
│  Методы:                                                │
│  - init()                                               │
│  - onPlatformCartUpdate(total)                          │
│  - onUserDataUpdate(data)                               │
│  - checkUserRegistration()                              │
│  - applyFirstPurchaseDiscount()                         │
│  - makeApiRequest(url, options)                         │
│  - renderUI()                                           │
│  - updateUI()                                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓ вызывает методы адаптера
┌─────────────────────────────────────────────────────────┐
│              TildaAdapter (tilda-adapter.js)             │
│                                                          │
│  Методы:                                                │
│  - init()                    → Инициализация observers  │
│  - getCartTotal()            → Парсинг .t706__cartwin   │
│  - getContactInfo()          → Поиск input[type=email]  │
│  - applyPromocode(code)      → Клик .t-inputpromocode   │
│  - observeCart()             → MutationObserver         │
│  - observeUserInput()        → Event delegation         │
│  - initProductBadges()       → Добавление плашек        │
│  - mountInlineWidget()       → Вставка в DOM            │
│  - destroy()                 → Очистка observers        │
└─────────────────────────────────────────────────────────┘
                     │
                     ↓ работает с
┌─────────────────────────────────────────────────────────┐
│                    Tilda Platform                        │
│  - window.tcart                                         │
│  - .t706__cartwin                                       │
│  - .t-inputpromocode                                    │
│  - .js-product                                          │
└─────────────────────────────────────────────────────────┘
```

## 🔄 Жизненный цикл виджета

### 1. Загрузка (widget-loader.js)

```javascript
// 1. Определение платформы
const platform = detectPlatform(); // 'tilda'

// 2. Загрузка адаптера
const AdapterClass = await loadAdapter(platform);

// 3. Создание экземпляров
const core = new LeadWidgetCore({
  projectId: window.LEAD_WIDGET_PROJECT_ID,
  apiUrl: 'https://gupil.ru',
  debug: true
});

const adapter = new AdapterClass(core);
core.setAdapter(adapter);

// 4. Инициализация
await core.init();
```

### 2. Инициализация (Core)

```javascript
async init() {
  // 1. Валидация адаптера
  this.validateAdapter();
  
  // 2. Инициализация адаптера
  await this.adapter.init();
  
  // 3. Загрузка настроек
  await this.loadWidgetSettings();
  
  // 4. Загрузка данных пользователя
  this.loadUserFromStorage();
  
  // 5. Начальная синхронизация
  this.state.cartTotal = this.adapter.getCartTotal();
  const contacts = this.adapter.getContactInfo();
  if (contacts.email || contacts.phone) {
    await this.checkUserRegistration(contacts);
  }
  
  // 6. Рендер UI
  this.renderUI();
  
  // 7. Запуск наблюдателей
  if (this.adapter.observeCart) {
    this.adapter.observeCart();
  }
  if (this.adapter.observeUserInput) {
    this.adapter.observeUserInput();
  }
  
  // 8. Инициализация плашек
  if (this.adapter.initProductBadges) {
    this.adapter.initProductBadges(
      this.state.widgetSettings,
      (price) => this.calculateBonusAmount(price)
    );
  }
}
```

### 3. Работа (Runtime)

```javascript
// Пользователь добавил товар в корзину
// → Tilda обновляет DOM
// → MutationObserver в adapter.observeCart() ловит изменение
// → adapter вызывает core.onPlatformCartUpdate(newTotal)
// → core обновляет state.cartTotal
// → core вызывает updateUI()
// → UI перерисовывается с новой суммой

// Пользователь ввел email
// → Input event в adapter.observeUserInput()
// → adapter вызывает core.onUserDataUpdate({ email })
// → core обновляет state.user
// → core вызывает checkUserRegistration()
// → API запрос на проверку регистрации
// → Если зарегистрирован → загрузка баланса
// → updateUI() с балансом пользователя
```

### 4. Уничтожение

```javascript
destroy() {
  // 1. Очистка адаптера
  if (this.adapter && this.adapter.destroy) {
    this.adapter.destroy();
  }
  
  // 2. Очистка UI
  this.removeUI();
  
  // 3. Очистка состояния
  this.state = null;
  
  // 4. Удаление ссылок
  this.adapter = null;
}
```

## 🎯 Примеры использования

### Базовая интеграция (Tilda)

```html
<!-- 1. Подключение loader -->
<script>
  window.LEAD_WIDGET_PROJECT_ID = 'your-project-id';
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>

<!-- Loader автоматически:
  - Определит что это Tilda
  - Загрузит tilda-adapter.js
  - Загрузит universal-widget.js
  - Инициализирует виджет
-->
```

### Ручная инициализация (Advanced)

```html
<!-- 1. Подключение Core -->
<script src="https://gupil.ru/universal-widget.js"></script>

<!-- 2. Подключение адаптера -->
<script src="https://gupil.ru/adapters/tilda-adapter.js"></script>

<!-- 3. Инициализация -->
<script>
  const core = new LeadWidgetCore({
    projectId: 'your-project-id',
    apiUrl: 'https://gupil.ru',
    debug: true
  });
  
  const adapter = new TildaAdapter(core);
  core.setAdapter(adapter);
  
  core.init().then(() => {
    console.log('✅ Виджет инициализирован');
  });
</script>
```

### Custom адаптер (для разработчиков)

```javascript
class MyCustomAdapter {
  constructor(core) {
    this.core = core;
  }
  
  init() {
    // Ваша логика инициализации
    this.setupObservers();
  }
  
  getCartTotal() {
    // Ваша логика получения суммы корзины
    return parseFloat(document.querySelector('#cart-total').textContent);
  }
  
  getContactInfo() {
    // Ваша логика получения контактов
    return {
      email: document.querySelector('#email').value,
      phone: document.querySelector('#phone').value
    };
  }
  
  observeCart() {
    // Ваша логика наблюдения за корзиной
    const observer = new MutationObserver(() => {
      const total = this.getCartTotal();
      this.core.onPlatformCartUpdate(total);
    });
    
    observer.observe(document.querySelector('#cart'), {
      childList: true,
      subtree: true
    });
  }
  
  destroy() {
    // Очистка ресурсов
  }
}

// Использование
const core = new LeadWidgetCore({ projectId: 'xxx' });
const adapter = new MyCustomAdapter(core);
core.setAdapter(adapter);
core.init();
```

## 📊 Сравнение архитектур

### Legacy (tilda-bonus-widget.js)

```
Размер: 80KB (25KB gzip)
Строк кода: 2000+
Платформы: Только Tilda
Тестируемость: Низкая
Расширяемость: Низкая
Производительность: Средняя
```

### Universal (новая архитектура)

```
Размер Core: 45KB (15KB gzip)
Размер Adapter: 15KB (5KB gzip)
Общий размер: 60KB (20KB gzip) ✅ -25%
Строк кода Core: 800
Строк кода Adapter: 400
Платформы: Любые (через адаптеры)
Тестируемость: Высокая ✅
Расширяемость: Высокая ✅
Производительность: Высокая ✅
```

## 🔐 Безопасность

### XSS Protection
- Санитизация всех данных из localStorage
- Валидация email/phone перед использованием
- Escape HTML в динамическом контенте

### CSRF Protection
- Все API запросы с CORS headers
- Валидация projectId на backend
- Rate limiting на API endpoints

### Data Privacy
- Минимальное хранение данных в localStorage
- Автоочистка старых данных (7 дней)
- Опциональное шифрование чувствительных данных

## ⚡ Производительность

### Lazy Loading
- Адаптеры загружаются только при необходимости
- Dynamic import для современных браузеров
- Fallback на script tags для старых браузеров

### Debouncing
- Обновления корзины debounced (400ms)
- API запросы throttled (1000ms)
- UI updates batched (RAF)

### Caching
- Настройки виджета кешируются (5 минут)
- Данные пользователя кешируются (localStorage)
- API ответы кешируются (in-memory)

### Memory Management
- Автоочистка observers при destroy()
- WeakMap для хранения ссылок на DOM
- Периодическая очистка кешей

## 🧪 Тестирование

### Unit Tests
```javascript
describe('TildaAdapter', () => {
  it('should get cart total', () => {
    const adapter = new TildaAdapter(mockCore);
    expect(adapter.getCartTotal()).toBe(5000);
  });
  
  it('should apply promocode', async () => {
    const adapter = new TildaAdapter(mockCore);
    const result = await adapter.applyPromocode('TEST');
    expect(result).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Widget Integration', () => {
  it('should initialize on Tilda page', async () => {
    const core = new LeadWidgetCore({ projectId: 'test' });
    const adapter = new TildaAdapter(core);
    core.setAdapter(adapter);
    
    await core.init();
    
    expect(core.state.isInitialized).toBe(true);
    expect(core.state.cartTotal).toBeGreaterThan(0);
  });
});
```

### E2E Tests (Playwright)
```javascript
test('should display bonus balance', async ({ page }) => {
  await page.goto('https://test-site.tilda.ws');
  await page.waitForSelector('.bonus-widget');
  
  const balance = await page.textContent('.bonus-balance');
  expect(balance).toContain('бонусов');
});
```

## 📈 Метрики

### Производительность
- Time to Interactive: < 100ms
- First Contentful Paint: < 50ms
- Bundle Size: < 20KB gzip
- API Response Time: < 200ms

### Надежность
- Error Rate: < 0.1%
- Uptime: > 99.9%
- Test Coverage: > 90%

### Использование
- Active Installations: TBD
- Daily Active Users: TBD
- Conversion Rate: TBD

## 🔗 Связанные документы

- `requirements.md` - Требования к рефакторингу
- `tasks.md` - Детальный план задач
- `docs/tilda-adapter-guide.md` - Документация адаптера
- `docs/universal-widget-guide.md` - Документация Core
