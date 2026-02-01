# Custom Adapter - Руководство для разработчиков

> **Версия:** 1.0.0  
> **Дата:** 2026-01-31  
> **Для:** Разработчиков, интегрирующих Gupil Widget с кастомными платформами

## 📋 Содержание

1. [Введение](#введение)
2. [Архитектура адаптера](#архитектура-адаптера)
3. [Интерфейс IWidgetAdapter](#интерфейс-iwidgetadapter)
4. [Создание адаптера](#создание-адаптера)
5. [Примеры реализации](#примеры-реализации)
6. [Тестирование](#тестирование)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## Введение

Custom Adapter позволяет интегрировать Gupil Widget с **любой платформой** электронной коммерции, которая не поддерживается из коробки.

### Когда нужен Custom Adapter?

- ✅ Вы используете самописную платформу e-commerce
- ✅ Вы используете редкую CMS (не Tilda/Shopify/WooCommerce)
- ✅ Вам нужна специфичная логика работы с корзиной
- ✅ Вы хотите полный контроль над интеграцией

### Что нужно знать?

- JavaScript (ES6+)
- DOM API
- Async/Await
- Основы работы с событиями

---

## Архитектура адаптера

### Роль адаптера

Адаптер - это **мост** между Universal Widget Core и вашей платформой:

```
┌─────────────────────────────────────────────────┐
│         Universal Widget Core                   │
│  • Бизнес-логика бонусов                        │
│  • API запросы к серверу                        │
│  • UI компоненты                                │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Вызывает методы адаптера
                  ▼
┌─────────────────────────────────────────────────┐
│          Your Custom Adapter                    │
│  • getCartTotal() → читает сумму корзины        │
│  • getContactInfo() → читает email/phone        │
│  • applyPromocode() → применяет промокод        │
│  • observeCart() → следит за изменениями        │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Работает с DOM/API платформы
                  ▼
┌─────────────────────────────────────────────────┐
│          Your E-commerce Platform               │
│  • Корзина                                      │
│  • Формы оформления                             │
│  • Каталог товаров                              │
└─────────────────────────────────────────────────┘
```

### Принципы работы

1. **Core не знает о платформе** - он вызывает методы адаптера
2. **Адаптер знает о платформе** - он работает с DOM/API
3. **Адаптер реализует интерфейс** - все методы стандартизированы

---

## Интерфейс IWidgetAdapter

Каждый адаптер **обязан** реализовать следующие методы:

### Обязательные методы

#### `getCartTotal(): number`

Возвращает общую сумму корзины в рублях.

**Возвращает:** `number` - сумма корзины

**Пример:**
```javascript
getCartTotal() {
  const totalElement = document.querySelector('.cart-total');
  return parseFloat(totalElement?.textContent || '0');
}
```

---

#### `getContactInfo(): { email: string, phone: string }`

Возвращает контактную информацию пользователя из формы.

**Возвращает:** `object` - объект с email и phone

**Пример:**
```javascript
getContactInfo() {
  const emailInput = document.querySelector('#email');
  const phoneInput = document.querySelector('#phone');
  
  return {
    email: emailInput?.value || '',
    phone: phoneInput?.value || ''
  };
}
```

---

#### `applyPromocode(code: string): Promise<boolean>`

Применяет промокод на платформе.

**Параметры:**
- `code` (string) - промокод для применения

**Возвращает:** `Promise<boolean>` - успешность применения

**Пример:**
```javascript
async applyPromocode(code) {
  const input = document.querySelector('#promo-code');
  const button = document.querySelector('#apply-promo');
  
  if (!input || !button) return false;
  
  input.value = code;
  button.click();
  
  // Ждем применения
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Проверяем успешность
  const error = document.querySelector('.promo-error');
  return !error || error.style.display === 'none';
}
```

---

#### `observeCart(callback: Function): void`

Наблюдает за изменениями корзины и вызывает callback.

**Параметры:**
- `callback` (function) - функция, вызываемая при изменении корзины

**Пример:**
```javascript
observeCart(callback) {
  const cartElement = document.querySelector('.cart');
  if (!cartElement) return;
  
  // MutationObserver для отслеживания изменений
  const observer = new MutationObserver(() => {
    callback();
  });
  
  observer.observe(cartElement, {
    childList: true,
    subtree: true,
    attributes: true
  });
}
```

---

#### `observeContactInput(callback: Function): void`

Наблюдает за вводом контактной информации и вызывает callback.

**Параметры:**
- `callback` (function) - функция, вызываемая при изменении контактов

**Пример:**
```javascript
observeContactInput(callback) {
  const emailInput = document.querySelector('#email');
  const phoneInput = document.querySelector('#phone');
  
  const handler = () => callback();
  
  emailInput?.addEventListener('input', handler);
  phoneInput?.addEventListener('input', handler);
}
```

---

### Опциональные методы

#### `init(): Promise<void>`

Инициализация адаптера (если нужна асинхронная инициализация).

**Пример:**
```javascript
async init() {
  // Ждем загрузки платформы
  await this.waitForPlatform();
  
  // Инициализируем обработчики
  this.setupEventHandlers();
}
```

---

#### `getCartItems(): Array<object>`

Возвращает список товаров в корзине.

**Возвращает:** `Array<object>` - массив товаров

**Пример:**
```javascript
getCartItems() {
  const items = document.querySelectorAll('.cart-item');
  return Array.from(items).map(item => ({
    id: item.dataset.productId,
    name: item.querySelector('.item-name')?.textContent,
    price: parseFloat(item.querySelector('.item-price')?.textContent || '0'),
    quantity: parseInt(item.querySelector('.item-quantity')?.textContent || '1')
  }));
}
```

---

#### `initProductBadges(): void`

Инициализирует отображение бонусных плашек на товарах.

**Пример:**
```javascript
initProductBadges() {
  const products = document.querySelectorAll('.product-card');
  
  products.forEach(product => {
    const price = this.getProductPrice(product);
    const bonuses = Math.floor(price * 0.05); // 5% бонусов
    
    // Создаем плашку
    const badge = document.createElement('div');
    badge.className = 'bonus-badge';
    badge.textContent = `+${bonuses} бонусов`;
    
    product.appendChild(badge);
  });
}
```

---

## Создание адаптера

### Шаг 1: Создайте файл адаптера

Создайте файл `my-platform-adapter.js`:

```javascript
/**
 * @file: my-platform-adapter.js
 * @description: Адаптер для интеграции с MyPlatform
 * @version: 1.0.0
 * @implements: IWidgetAdapter
 */

class MyPlatformAdapter {
  constructor(config = {}) {
    this.config = config;
    this.selectors = config.selectors || this.getDefaultSelectors();
  }

  /**
   * Селекторы по умолчанию
   */
  getDefaultSelectors() {
    return {
      cartTotal: '.cart-total',
      cartItems: '.cart-item',
      emailInput: '#email',
      phoneInput: '#phone',
      promoInput: '#promo-code',
      promoButton: '#apply-promo'
    };
  }

  /**
   * Получить общую сумму корзины
   * @returns {number}
   */
  getCartTotal() {
    const element = document.querySelector(this.selectors.cartTotal);
    if (!element) return 0;
    
    const text = element.textContent.replace(/[^\d.,]/g, '');
    return parseFloat(text) || 0;
  }

  /**
   * Получить контактную информацию
   * @returns {{ email: string, phone: string }}
   */
  getContactInfo() {
    const emailInput = document.querySelector(this.selectors.emailInput);
    const phoneInput = document.querySelector(this.selectors.phoneInput);
    
    return {
      email: emailInput?.value || '',
      phone: phoneInput?.value || ''
    };
  }

  /**
   * Применить промокод
   * @param {string} code - промокод
   * @returns {Promise<boolean>}
   */
  async applyPromocode(code) {
    const input = document.querySelector(this.selectors.promoInput);
    const button = document.querySelector(this.selectors.promoButton);
    
    if (!input || !button) {
      console.warn('[MyPlatformAdapter] Promo elements not found');
      return false;
    }
    
    input.value = code;
    button.click();
    
    // Ждем применения
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  }

  /**
   * Наблюдать за изменениями корзины
   * @param {Function} callback
   */
  observeCart(callback) {
    const cartElement = document.querySelector('.cart');
    if (!cartElement) {
      console.warn('[MyPlatformAdapter] Cart element not found');
      return;
    }
    
    const observer = new MutationObserver(() => {
      callback();
    });
    
    observer.observe(cartElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-total']
    });
  }

  /**
   * Наблюдать за вводом контактов
   * @param {Function} callback
   */
  observeContactInput(callback) {
    const emailInput = document.querySelector(this.selectors.emailInput);
    const phoneInput = document.querySelector(this.selectors.phoneInput);
    
    const handler = () => callback();
    
    emailInput?.addEventListener('input', handler);
    emailInput?.addEventListener('blur', handler);
    phoneInput?.addEventListener('input', handler);
    phoneInput?.addEventListener('blur', handler);
  }

  /**
   * Получить список товаров в корзине (опционально)
   * @returns {Array<object>}
   */
  getCartItems() {
    const items = document.querySelectorAll(this.selectors.cartItems);
    
    return Array.from(items).map(item => ({
      id: item.dataset.productId || '',
      name: item.querySelector('.item-name')?.textContent || '',
      price: parseFloat(item.querySelector('.item-price')?.textContent || '0'),
      quantity: parseInt(item.querySelector('.item-quantity')?.textContent || '1')
    }));
  }

  /**
   * Инициализировать бонусные плашки (опционально)
   */
  initProductBadges() {
    const products = document.querySelectorAll('.product-card');
    
    products.forEach(product => {
      const priceElement = product.querySelector('.product-price');
      if (!priceElement) return;
      
      const price = parseFloat(priceElement.textContent.replace(/[^\d.,]/g, ''));
      const bonuses = Math.floor(price * 0.05); // 5% бонусов
      
      // Создаем плашку
      const badge = document.createElement('div');
      badge.className = 'gupil-bonus-badge';
      badge.textContent = `+${bonuses} бонусов`;
      badge.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #4F46E5;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      `;
      
      product.style.position = 'relative';
      product.appendChild(badge);
    });
  }
}

// Экспорт для использования в Widget Loader
if (typeof window !== 'undefined') {
  window.MyPlatformAdapter = MyPlatformAdapter;
}
```

### Шаг 2: Подключите адаптер

Добавьте адаптер на страницу:

```html
<!-- Ваш адаптер -->
<script src="/path/to/my-platform-adapter.js"></script>

<!-- Конфигурация -->
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api',
    platform: 'custom',
    
    // Кастомные селекторы (опционально)
    selectors: {
      cartTotal: '.my-cart-total',
      cartItems: '.my-cart-item',
      emailInput: '#customer-email',
      phoneInput: '#customer-phone'
    },
    
    // Кастомный адаптер
    customAdapter: MyPlatformAdapter
  };
</script>

<!-- Widget Loader -->
<script src="https://gupil.ru/widget-loader.js" async></script>
```

### Шаг 3: Протестируйте

Откройте консоль браузера и проверьте:

```javascript
// Проверить, что адаптер загружен
console.log(window.gupilWidget?.adapter);

// Проверить методы
console.log('Cart Total:', window.gupilWidget.adapter.getCartTotal());
console.log('Contact Info:', window.gupilWidget.adapter.getContactInfo());
console.log('Cart Items:', window.gupilWidget.adapter.getCartItems());
```

---

## Примеры реализации

### Пример 1: Простой адаптер

Минимальная реализация для простого магазина:

```javascript
class SimpleAdapter {
  getCartTotal() {
    return parseFloat(document.querySelector('.total')?.textContent || '0');
  }

  getContactInfo() {
    return {
      email: document.querySelector('#email')?.value || '',
      phone: document.querySelector('#phone')?.value || ''
    };
  }

  async applyPromocode(code) {
    const input = document.querySelector('#promo');
    if (input) {
      input.value = code;
      input.form?.submit();
      return true;
    }
    return false;
  }

  observeCart(callback) {
    const cart = document.querySelector('.cart');
    if (cart) {
      new MutationObserver(callback).observe(cart, { 
        childList: true, 
        subtree: true 
      });
    }
  }

  observeContactInput(callback) {
    ['#email', '#phone'].forEach(selector => {
      document.querySelector(selector)?.addEventListener('input', callback);
    });
  }
}
```

### Пример 2: Адаптер с API

Интеграция через JavaScript API платформы:

```javascript
class APIAdapter {
  constructor(config) {
    this.api = window.MyPlatformAPI;
  }

  getCartTotal() {
    return this.api.cart.getTotal();
  }

  getContactInfo() {
    const customer = this.api.customer.getCurrent();
    return {
      email: customer?.email || '',
      phone: customer?.phone || ''
    };
  }

  async applyPromocode(code) {
    try {
      await this.api.cart.applyDiscount(code);
      return true;
    } catch (error) {
      console.error('Failed to apply promo:', error);
      return false;
    }
  }

  observeCart(callback) {
    this.api.cart.on('change', callback);
  }

  observeContactInput(callback) {
    this.api.customer.on('update', callback);
  }
}
```

### Пример 3: Адаптер с debounce

Оптимизированный адаптер с debounce для частых изменений:

```javascript
class OptimizedAdapter {
  constructor(config) {
    this.config = config;
    this.debounceTimers = new Map();
  }

  debounce(key, callback, delay = 300) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      callback();
      this.debounceTimers.delete(key);
    }, delay);
    
    this.debounceTimers.set(key, timer);
  }

  getCartTotal() {
    return parseFloat(document.querySelector('.total')?.textContent || '0');
  }

  getContactInfo() {
    return {
      email: document.querySelector('#email')?.value || '',
      phone: document.querySelector('#phone')?.value || ''
    };
  }

  async applyPromocode(code) {
    // Реализация
    return true;
  }

  observeCart(callback) {
    const cart = document.querySelector('.cart');
    if (!cart) return;
    
    const observer = new MutationObserver(() => {
      // Debounce для оптимизации
      this.debounce('cart', callback, 400);
    });
    
    observer.observe(cart, { 
      childList: true, 
      subtree: true 
    });
  }

  observeContactInput(callback) {
    ['#email', '#phone'].forEach(selector => {
      const input = document.querySelector(selector);
      input?.addEventListener('input', () => {
        // Debounce для оптимизации
        this.debounce('contact', callback, 500);
      });
    });
  }
}
```

---

## Тестирование

### Создайте тестовую страницу

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Test My Platform Adapter</title>
</head>
<body>
  <!-- Имитация вашей платформы -->
  <div class="cart">
    <div class="cart-item" data-product-id="1">
      <span class="item-name">Товар 1</span>
      <span class="item-price">1000</span>
      <span class="item-quantity">1</span>
    </div>
    <div class="cart-total">1000</div>
  </div>

  <form>
    <input type="email" id="email" placeholder="Email">
    <input type="tel" id="phone" placeholder="Телефон">
    <input type="text" id="promo-code" placeholder="Промокод">
    <button type="button" id="apply-promo">Применить</button>
  </form>

  <!-- Ваш адаптер -->
  <script src="my-platform-adapter.js"></script>

  <!-- Тестовый скрипт -->
  <script>
    // Инициализация адаптера
    const adapter = new MyPlatformAdapter();

    // Тест 1: getCartTotal
    console.log('Test 1: getCartTotal');
    console.log('Result:', adapter.getCartTotal());
    console.assert(adapter.getCartTotal() === 1000, 'Cart total should be 1000');

    // Тест 2: getContactInfo
    console.log('\nTest 2: getContactInfo');
    document.querySelector('#email').value = 'test@example.com';
    document.querySelector('#phone').value = '+79991234567';
    const contactInfo = adapter.getContactInfo();
    console.log('Result:', contactInfo);
    console.assert(contactInfo.email === 'test@example.com', 'Email should match');
    console.assert(contactInfo.phone === '+79991234567', 'Phone should match');

    // Тест 3: observeCart
    console.log('\nTest 3: observeCart');
    adapter.observeCart(() => {
      console.log('Cart changed! New total:', adapter.getCartTotal());
    });
    
    // Имитация изменения корзины
    setTimeout(() => {
      document.querySelector('.cart-total').textContent = '2000';
    }, 1000);

    // Тест 4: observeContactInput
    console.log('\nTest 4: observeContactInput');
    adapter.observeContactInput(() => {
      console.log('Contact changed!', adapter.getContactInfo());
    });

    // Тест 5: applyPromocode
    console.log('\nTest 5: applyPromocode');
    adapter.applyPromocode('TEST123').then(result => {
      console.log('Promocode applied:', result);
    });

    console.log('\n✅ All tests completed!');
  </script>
</body>
</html>
```

### Автоматические тесты (Jest)

```javascript
// my-platform-adapter.test.js
describe('MyPlatformAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div class="cart">
        <div class="cart-total">1000</div>
      </div>
      <input type="email" id="email" value="test@example.com">
      <input type="tel" id="phone" value="+79991234567">
    `;

    adapter = new MyPlatformAdapter();
  });

  test('getCartTotal returns correct value', () => {
    expect(adapter.getCartTotal()).toBe(1000);
  });

  test('getContactInfo returns correct data', () => {
    const info = adapter.getContactInfo();
    expect(info.email).toBe('test@example.com');
    expect(info.phone).toBe('+79991234567');
  });

  test('observeCart triggers callback on change', (done) => {
    adapter.observeCart(() => {
      done();
    });

    // Trigger change
    document.querySelector('.cart-total').textContent = '2000';
  });
});
```

---

## Best Practices

### 1. Используйте debounce для частых событий

```javascript
observeCart(callback) {
  let timer;
  const debouncedCallback = () => {
    clearTimeout(timer);
    timer = setTimeout(callback, 400);
  };
  
  // Observer с debounce
  new MutationObserver(debouncedCallback).observe(/* ... */);
}
```

### 2. Проверяйте наличие элементов

```javascript
getCartTotal() {
  const element = document.querySelector('.cart-total');
  if (!element) {
    console.warn('[Adapter] Cart total element not found');
    return 0;
  }
  return parseFloat(element.textContent || '0');
}
```

### 3. Обрабатывайте ошибки

```javascript
async applyPromocode(code) {
  try {
    // Попытка применить промокод
    await this.platformAPI.applyPromo(code);
    return true;
  } catch (error) {
    console.error('[Adapter] Failed to apply promo:', error);
    return false;
  }
}
```

### 4. Логируйте важные события

```javascript
constructor(config) {
  this.config = config;
  this.debug = config.debug || false;
  
  if (this.debug) {
    console.log('[Adapter] Initialized with config:', config);
  }
}

log(message, ...args) {
  if (this.debug) {
    console.log(`[Adapter] ${message}`, ...args);
  }
}
```

### 5. Делайте адаптер конфигурируемым

```javascript
constructor(config = {}) {
  this.config = {
    selectors: {
      cartTotal: '.cart-total',
      emailInput: '#email',
      phoneInput: '#phone',
      ...config.selectors
    },
    debounceDelay: config.debounceDelay || 400,
    debug: config.debug || false
  };
}
```

### 6. Очищайте ресурсы

```javascript
destroy() {
  // Отписываемся от событий
  this.observers.forEach(observer => observer.disconnect());
  this.eventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  
  // Очищаем таймеры
  this.debounceTimers.forEach(timer => clearTimeout(timer));
}
```

---

## FAQ

### Нужно ли реализовывать все методы?

Обязательно только 5 методов:
- `getCartTotal()`
- `getContactInfo()`
- `applyPromocode()`
- `observeCart()`
- `observeContactInput()`

Остальные опциональны.

### Как обрабатывать асинхронные операции?

Используйте `async/await`:

```javascript
async applyPromocode(code) {
  await this.api.applyDiscount(code);
  return true;
}
```

### Как тестировать адаптер локально?

Создайте HTML страницу с имитацией вашей платформы и подключите адаптер. См. раздел "Тестирование".

### Можно ли использовать TypeScript?

Да! Создайте `.d.ts` файл с интерфейсом:

```typescript
interface IWidgetAdapter {
  getCartTotal(): number;
  getContactInfo(): { email: string; phone: string };
  applyPromocode(code: string): Promise<boolean>;
  observeCart(callback: () => void): void;
  observeContactInput(callback: () => void): void;
}
```

### Как отлаживать адаптер?

Включите debug режим:

```javascript
window.gupilConfig = {
  projectId: 'YOUR_PROJECT_ID',
  apiUrl: 'https://gupil.ru/api',
  debug: true // Включить логи
};
```

### Нужно ли минифицировать адаптер?

Для production - да. Используйте UglifyJS или Terser:

```bash
npx terser my-platform-adapter.js -o my-platform-adapter.min.js -c -m
```

---

## Связанные документы

- [Universal Widget Guide](./universal-widget-guide.md) - общее руководство по виджету
- [Tilda Adapter Guide](./tilda-adapter-guide.md) - пример готового адаптера
- [Widget Files Overview](./widget-files-overview.md) - обзор всех файлов
- [Universal Widget Summary](./universal-widget-summary.md) - краткая сводка

---

**Версия документа:** 1.0.0  
**Последнее обновление:** 2026-01-31  
**Автор:** Gupil Team
