# Universal Widget - Руководство по интеграции

> **Версия:** 1.0.0  
> **Дата:** 2026-01-31  
> **Статус:** ✅ Production Ready

## 📋 Содержание

1. [Введение](#введение)
2. [Быстрый старт](#быстрый-старт)
3. [Поддерживаемые платформы](#поддерживаемые-платформы)
4. [Установка](#установка)
5. [Конфигурация](#конфигурация)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Введение

Universal Widget - это универсальная система бонусов, которая работает на **любой платформе** электронной коммерции:

- ✅ **Tilda** - полная поддержка всех типов каталогов
- ✅ **Shopify** - интеграция с корзиной и checkout
- ✅ **WooCommerce** - поддержка WordPress магазинов
- ✅ **Custom** - любая другая платформа через адаптер

### Архитектура

```
┌─────────────────────────────────────────────────┐
│           widget-loader.js (Entry Point)        │
│  • Автоопределение платформы                    │
│  • Динамическая загрузка адаптера               │
│  • Инициализация Core                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         universal-widget.js (Core)              │
│  • Управление состоянием                        │
│  • API запросы к серверу                        │
│  • Бизнес-логика бонусов                        │
│  • UI компоненты                                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│          Platform Adapter (Interface)           │
│  • tilda-adapter.js                             │
│  • shopify-adapter.js (coming soon)             │
│  • woocommerce-adapter.js (coming soon)         │
│  • custom-adapter.js (fallback)                 │
└─────────────────────────────────────────────────┘
```

---

## Быстрый старт

### Шаг 1: Получите код интеграции

1. Войдите в админ-панель Gupil
2. Перейдите в раздел **Проекты** → Ваш проект
3. Откройте вкладку **Интеграция**
4. Скопируйте код подключения

### Шаг 2: Добавьте код на сайт

Вставьте код **перед закрывающим тегом `</body>`**:

```html
<!-- Gupil Bonus Widget -->
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api',
    // platform: 'tilda' // Опционально, автоопределяется
  };
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>
```

### Шаг 3: Проверьте работу

1. Откройте сайт в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте логи: `[Gupil Widget] Platform detected: tilda`
4. Добавьте товар в корзину - должна появиться плашка с бонусами

---

## Поддерживаемые платформы

### 🟢 Tilda (Полная поддержка)

**Поддерживаемые блоки:**
- ✅ T706 - Корзина
- ✅ T776 - Каталог товаров (Grid)
- ✅ T754 - Каталог товаров (List)
- ✅ T750 - Каталог товаров (Compact)
- ✅ T762 - Каталог товаров (Cards)
- ✅ T1200+ - Все новые блоки каталогов

**Функционал:**
- ✅ Отображение бонусов на товарах
- ✅ Применение промокодов
- ✅ Списание бонусов при оплате
- ✅ Регистрация пользователей
- ✅ Автозаполнение контактов

**Пример кода:**
```html
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api'
  };
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>
```

### 🟡 Shopify (Coming Soon)

**Планируемый функционал:**
- ⏳ Интеграция с Shopify Cart API
- ⏳ Отображение бонусов на страницах товаров
- ⏳ Применение промокодов через Discount API
- ⏳ Webhook интеграция для заказов

**Ожидаемая дата:** Q2 2026

### 🟡 WooCommerce (Coming Soon)

**Планируемый функционал:**
- ⏳ Интеграция с WooCommerce Cart
- ⏳ Отображение бонусов на страницах товаров
- ⏳ Применение купонов через WooCommerce API
- ⏳ Webhook интеграция для заказов

**Ожидаемая дата:** Q2 2026

### 🟢 Custom Platform (Базовая поддержка)

Для любой другой платформы используется **CustomAdapter** с универсальными селекторами.

**Требования:**
- HTML форма с полями email/phone
- Элементы корзины с data-атрибутами
- JavaScript API для работы с корзиной

**Пример кода:**
```html
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api',
    platform: 'custom', // Принудительно использовать CustomAdapter
    selectors: {
      // Кастомные селекторы для вашей платформы
      emailInput: '#user-email',
      phoneInput: '#user-phone',
      cartTotal: '.cart-total-amount',
      cartItems: '.cart-item'
    }
  };
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>
```

---

## Установка

### Вариант 1: CDN (Рекомендуется)

Самый простой способ - загрузка с CDN:

```html
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api'
  };
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>
```

**Преимущества:**
- ✅ Автоматические обновления
- ✅ CDN кеширование
- ✅ Минимальная задержка загрузки
- ✅ Не нужно обновлять код вручную

### Вариант 2: Self-hosted

Если нужно хостить файлы на своем сервере:

1. Скачайте файлы:
   - `widget-loader.js`
   - `universal-widget.js`
   - `tilda-adapter.js` (или другой адаптер)

2. Разместите на своем сервере

3. Обновите пути в коде:

```html
<script>
  window.gupilConfig = {
    projectId: 'YOUR_PROJECT_ID',
    apiUrl: 'https://gupil.ru/api',
    baseUrl: 'https://your-domain.com/widgets/' // Путь к файлам
  };
</script>
<script src="https://your-domain.com/widgets/widget-loader.js" async></script>
```

**Недостатки:**
- ❌ Нужно обновлять файлы вручную
- ❌ Нет CDN кеширования
- ❌ Дополнительная нагрузка на сервер

---

## Конфигурация

### Базовая конфигурация

```javascript
window.gupilConfig = {
  // Обязательные параметры
  projectId: 'YOUR_PROJECT_ID',    // ID проекта из админ-панели
  apiUrl: 'https://gupil.ru/api',  // URL API сервера
  
  // Опциональные параметры
  platform: 'tilda',               // Принудительный выбор платформы
  debug: false,                    // Включить debug логи
  theme: 'light',                  // Тема виджета: light | dark | auto
  language: 'ru',                  // Язык: ru | en
  
  // Кастомные селекторы (для custom платформы)
  selectors: {
    emailInput: '#email',
    phoneInput: '#phone',
    cartTotal: '.cart-total',
    cartItems: '.cart-item'
  },
  
  // Callbacks
  onReady: function(widget) {
    console.log('Widget ready!', widget);
  },
  onError: function(error) {
    console.error('Widget error:', error);
  }
};
```

### Параметры конфигурации

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `projectId` | string | ✅ Да | ID проекта из админ-панели |
| `apiUrl` | string | ✅ Да | URL API сервера (обычно `https://gupil.ru/api`) |
| `platform` | string | ❌ Нет | Принудительный выбор платформы: `tilda`, `shopify`, `woocommerce`, `custom` |
| `debug` | boolean | ❌ Нет | Включить debug логи в консоль (по умолчанию `false`) |
| `theme` | string | ❌ Нет | Тема виджета: `light`, `dark`, `auto` (по умолчанию `auto`) |
| `language` | string | ❌ Нет | Язык интерфейса: `ru`, `en` (по умолчанию `ru`) |
| `baseUrl` | string | ❌ Нет | Базовый URL для загрузки файлов (для self-hosted) |
| `selectors` | object | ❌ Нет | Кастомные CSS селекторы (для custom платформы) |
| `onReady` | function | ❌ Нет | Callback при успешной инициализации |
| `onError` | function | ❌ Нет | Callback при ошибке |

### Примеры конфигурации

#### Минимальная конфигурация (Tilda)
```javascript
window.gupilConfig = {
  projectId: 'abc123',
  apiUrl: 'https://gupil.ru/api'
};
```

#### Полная конфигурация (Custom Platform)
```javascript
window.gupilConfig = {
  projectId: 'abc123',
  apiUrl: 'https://gupil.ru/api',
  platform: 'custom',
  debug: true,
  theme: 'dark',
  language: 'en',
  selectors: {
    emailInput: '#customer-email',
    phoneInput: '#customer-phone',
    cartTotal: '.shopping-cart-total',
    cartItems: '.shopping-cart-item',
    cartItemPrice: '.item-price',
    cartItemQuantity: '.item-quantity'
  },
  onReady: function(widget) {
    console.log('Gupil Widget initialized!');
    // Можно вызывать методы widget
    widget.refreshBonuses();
  },
  onError: function(error) {
    console.error('Failed to initialize widget:', error);
    // Отправить ошибку в систему мониторинга
    if (window.Sentry) {
      Sentry.captureException(error);
    }
  }
};
```

---

## API Reference

### Widget Loader API

Widget Loader автоматически определяет платформу и загружает нужные файлы.

#### Методы

##### `GupilWidgetLoader.init(config)`

Инициализация виджета (вызывается автоматически).

**Параметры:**
- `config` (object) - конфигурация виджета

**Возвращает:** Promise<LeadWidgetCore>

**Пример:**
```javascript
// Обычно не нужно вызывать вручную
GupilWidgetLoader.init(window.gupilConfig)
  .then(widget => {
    console.log('Widget ready!', widget);
  })
  .catch(error => {
    console.error('Widget error:', error);
  });
```

##### `GupilWidgetLoader.detectPlatform()`

Определение текущей платформы.

**Возвращает:** string ('tilda' | 'shopify' | 'woocommerce' | 'custom')

**Пример:**
```javascript
const platform = GupilWidgetLoader.detectPlatform();
console.log('Detected platform:', platform);
```

### Universal Widget Core API

Core предоставляет методы для работы с бонусами.

#### Методы

##### `widget.init()`

Инициализация виджета (вызывается автоматически).

**Возвращает:** Promise<void>

##### `widget.refreshBonuses()`

Обновление информации о бонусах пользователя.

**Возвращает:** Promise<void>

**Пример:**
```javascript
widget.refreshBonuses()
  .then(() => {
    console.log('Bonuses refreshed!');
  });
```

##### `widget.applyPromocode(code)`

Применение промокода.

**Параметры:**
- `code` (string) - промокод

**Возвращает:** Promise<object>

**Пример:**
```javascript
widget.applyPromocode('SUMMER2026')
  .then(result => {
    console.log('Promocode applied:', result);
  })
  .catch(error => {
    console.error('Invalid promocode:', error);
  });
```

##### `widget.getState(key)`

Получение значения из состояния.

**Параметры:**
- `key` (string) - ключ состояния

**Возвращает:** any

**Пример:**
```javascript
const userBonuses = widget.getState('userBonuses');
console.log('User bonuses:', userBonuses);
```

##### `widget.setState(updates)`

Обновление состояния.

**Параметры:**
- `updates` (object) - объект с обновлениями

**Возвращает:** void

**Пример:**
```javascript
widget.setState({
  userBonuses: 1500,
  userName: 'Иван Иванов'
});
```

##### `widget.subscribe(key, callback)`

Подписка на изменения состояния.

**Параметры:**
- `key` (string) - ключ состояния
- `callback` (function) - функция обратного вызова

**Возвращает:** void

**Пример:**
```javascript
widget.subscribe('userBonuses', (newValue, oldValue) => {
  console.log(`Bonuses changed: ${oldValue} → ${newValue}`);
});
```

### Platform Adapter API

Каждый адаптер реализует интерфейс `IWidgetAdapter`.

#### Обязательные методы

##### `adapter.getCartTotal()`

Получение общей суммы корзины.

**Возвращает:** number

##### `adapter.getContactInfo()`

Получение контактной информации пользователя.

**Возвращает:** object `{ email: string, phone: string }`

##### `adapter.applyPromocode(code)`

Применение промокода на платформе.

**Параметры:**
- `code` (string) - промокод

**Возвращает:** Promise<boolean>

##### `adapter.observeCart(callback)`

Наблюдение за изменениями корзины.

**Параметры:**
- `callback` (function) - функция обратного вызова

**Возвращает:** void

##### `adapter.observeContactInput(callback)`

Наблюдение за вводом контактов.

**Параметры:**
- `callback` (function) - функция обратного вызова

**Возвращает:** void

---

## Troubleshooting

### Виджет не загружается

**Проблема:** Виджет не появляется на странице.

**Решение:**
1. Проверьте консоль браузера (F12) на наличие ошибок
2. Убедитесь, что `projectId` указан правильно
3. Проверьте, что скрипт загружается: `Network` → `widget-loader.js`
4. Проверьте, что `apiUrl` доступен

**Debug:**
```javascript
window.gupilConfig = {
  projectId: 'YOUR_PROJECT_ID',
  apiUrl: 'https://gupil.ru/api',
  debug: true // Включить debug логи
};
```

### Платформа определяется неправильно

**Проблема:** Widget Loader определяет неправильную платформу.

**Решение:**
Принудительно укажите платформу в конфигурации:

```javascript
window.gupilConfig = {
  projectId: 'YOUR_PROJECT_ID',
  apiUrl: 'https://gupil.ru/api',
  platform: 'tilda' // Принудительно использовать Tilda
};
```

### Бонусы не отображаются на товарах

**Проблема:** Плашки с бонусами не появляются на карточках товаров.

**Решение (Tilda):**
1. Убедитесь, что используется поддерживаемый блок каталога (T776, T754, T750, T762)
2. Проверьте, что товары загружены в каталог Tilda
3. Проверьте настройки проекта в админ-панели

**Debug:**
```javascript
// Проверить, что адаптер инициализирован
console.log('Adapter:', window.gupilWidget?.adapter);

// Проверить, что метод initProductBadges вызван
window.gupilWidget?.adapter?.initProductBadges();
```

### Промокод не применяется

**Проблема:** При вводе промокода ничего не происходит.

**Решение:**
1. Проверьте, что промокод активен в админ-панели
2. Проверьте, что промокод не истек
3. Проверьте лимиты использования промокода
4. Проверьте консоль на наличие ошибок API

**Debug:**
```javascript
// Проверить применение промокода вручную
window.gupilWidget.applyPromocode('YOUR_CODE')
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

### Ошибка CORS

**Проблема:** `Access to fetch at 'https://gupil.ru/api/...' from origin '...' has been blocked by CORS policy`

**Решение:**
Это проблема на стороне сервера. Обратитесь в поддержку Gupil.

**Временное решение:**
Используйте прокси или JSONP (не рекомендуется для production).

### Виджет конфликтует с другими скриптами

**Проблема:** Виджет не работает из-за конфликта с другими JavaScript библиотеками.

**Решение:**
1. Загружайте виджет последним (перед `</body>`)
2. Используйте `async` атрибут для асинхронной загрузки
3. Проверьте консоль на наличие ошибок

**Пример:**
```html
<!-- Другие скрипты -->
<script src="jquery.js"></script>
<script src="bootstrap.js"></script>

<!-- Gupil Widget (последним) -->
<script>
  window.gupilConfig = { /* ... */ };
</script>
<script src="https://gupil.ru/widget-loader.js" async></script>
</body>
```

---

## FAQ

### Можно ли использовать виджет на нескольких сайтах?

Да, один проект может использоваться на нескольких доменах. Укажите все домены в настройках проекта в админ-панели.

### Как обновить виджет до новой версии?

Если используете CDN - обновление происходит автоматически. Если self-hosted - скачайте новые файлы и замените старые.

### Поддерживается ли мобильная версия?

Да, виджет полностью адаптивен и работает на всех устройствах.

### Можно ли кастомизировать дизайн виджета?

Да, через CSS переменные или кастомные стили. Подробнее в разделе "Кастомизация" (coming soon).

### Как работает автоопределение платформы?

Widget Loader проверяет наличие специфичных объектов и элементов:
- **Tilda**: `window.t_store`, `window.tcart`, `.t-records`
- **Shopify**: `window.Shopify`, `[data-shopify]`
- **WooCommerce**: `window.wc_add_to_cart_params`, `.woocommerce`

Если ничего не найдено - используется CustomAdapter.

### Можно ли использовать виджет без Telegram бота?

Да, виджет работает независимо от Telegram бота. Бот - это дополнительный канал коммуникации.

### Как протестировать виджет перед запуском?

1. Используйте тестовый проект в админ-панели
2. Тестируйте на staging окружении
3. Используйте `debug: true` для просмотра логов
4. Проверьте все сценарии: регистрация, покупка, промокод

### Влияет ли виджет на скорость загрузки сайта?

Минимально. Виджет загружается асинхронно (`async`) и не блокирует рендеринг страницы. Размер файлов:
- `widget-loader.js`: ~5 KB (gzip)
- `universal-widget.js`: ~15 KB (gzip)
- `tilda-adapter.js`: ~10 KB (gzip)

**Итого:** ~30 KB (меньше одной картинки).

### Как получить поддержку?

- 📧 Email: support@gupil.ru
- 💬 Telegram: @gupil_support
- 📚 Документация: https://docs.gupil.ru
- 🐛 GitHub Issues: https://github.com/gupil/widget/issues

---

## Связанные документы

- [Tilda Adapter Guide](./tilda-adapter-guide.md) - подробное руководство по Tilda
- [Custom Adapter Guide](./custom-adapter-guide.md) - создание адаптера для своей платформы
- [Widget Files Overview](./widget-files-overview.md) - обзор всех файлов виджета
- [Universal Widget Why](./universal-widget-why.md) - зачем нужен рефакторинг
- [Universal Widget Summary](./universal-widget-summary.md) - краткая сводка проекта

---

**Версия документа:** 1.0.0  
**Последнее обновление:** 2026-01-31  
**Автор:** Gupil Team
