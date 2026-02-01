# Обзор файлов виджетов в /public

> **Дата создания:** 2026-01-31  
> **Статус:** Актуально после завершения Phase 3 рефакторинга

## 📁 Структура файлов виджетов

```
public/
├── 🚀 НОВАЯ АРХИТЕКТУРА (Universal Widget)
│   ├── widget-loader.js          # Автозагрузчик (точка входа)
│   ├── universal-widget.js        # Ядро виджета (Core)
│   ├── tilda-adapter.js           # Адаптер для Tilda
│   └── custom-adapter.js          # Базовый адаптер (fallback)
│
├── 🔧 LEGACY (Production)
│   ├── tilda-bonus-widget.js      # Старый монолитный виджет
│   └── tilda-adapter.backup.js    # Бэкап старой версии адаптера
│
└── 🧪 ТЕСТИРОВАНИЕ
    ├── test-widget-loader.html    # Тесты widget-loader
    ├── test-tilda-adapter.html    # Тесты tilda-adapter
    ├── test-tilda.html            # Старые тесты legacy виджета
    └── TEST_ADAPTER_README.md     # Документация тестов
```

---

## 🚀 НОВАЯ АРХИТЕКТУРА (Universal Widget)

### 1. **widget-loader.js** v1.0.0
**Назначение:** Автоматический загрузчик виджета (точка входа для клиентов)

**Что делает:**
- 🔍 Автоматически определяет платформу (Tilda, Shopify, WooCommerce, Custom)
- 📦 Динамически загружает нужный адаптер
- 🔄 Retry с exponential backoff (до 3 попыток)
- ⏱️ Timeout 10 секунд для каждого скрипта
- 🛡️ Fallback на custom-adapter при ошибках
- 📊 Error reporting на сервер (опционально)
- 🎯 Автоинициализация при DOMContentLoaded

**Как используется:**
```html
<!-- Конфигурация -->
<script>
  window.LEAD_WIDGET_CONFIG = {
    projectId: 'your-project-id',
    apiUrl: 'https://bonus.example.com',
    debug: false
  };
</script>

<!-- Загрузка виджета -->
<script src="https://your-cdn.com/widget-loader.js"></script>
```

**Что происходит внутри:**
1. Определяет платформу (например, Tilda)
2. Загружает `universal-widget.js` (Core)
3. Загружает `tilda-adapter.js` (адаптер)
4. Создает экземпляры и инициализирует
5. Сохраняет в `window.LeadWidget`

**Статус:** ✅ Готов к использованию (не в production)

---

### 2. **universal-widget.js** v3.1.0
**Назначение:** Ядро виджета (платформо-независимая логика)

**Что делает:**
- 🧠 Управление состоянием (pub/sub паттерн)
- 🔌 Работа с адаптерами (setAdapter, validateAdapter)
- 🌐 API запросы с кешированием, retry, timeout
- 💾 Работа с localStorage
- 🎨 Рендеринг UI (инлайн или плавающая кнопка)
- 📊 Бизнес-логика (проверка пользователя, скидки, бонусы)

**Ключевые методы:**
```javascript
// Lifecycle
init()                    // Инициализация
destroy()                 // Очистка ресурсов

// Адаптер
setAdapter(adapter)       // Установка адаптера
getAdapter()              // Получение адаптера
validateAdapter(adapter)  // Валидация интерфейса

// Состояние
setState(updates)         // Обновление с уведомлениями
getState(key)             // Получение состояния
subscribe(key, callback)  // Подписка на изменения

// API
makeApiRequest(url, options, cacheOptions)  // Запрос с кешем и retry
clearCache(key)                             // Очистка кеша
```

**Архитектура:**
- ❌ НЕТ прямых обращений к DOM платформы
- ✅ Все через методы адаптера
- ✅ Реактивность через pub/sub
- ✅ Оптимизированные API запросы

**Статус:** ✅ Готов к использованию (не в production)

---

### 3. **tilda-adapter.js** v3.0.0
**Назначение:** Адаптер для платформы Tilda (изолирует Tilda-специфичную логику)

**Что делает:**
- 🛒 Работа с корзиной Tilda (tcart, DOM элементы)
- 🎫 Работа с промокодами (применение, очистка)
- 📝 Работа с формами оформления
- 🏷️ Работа с товарами и каталогами
- 👀 Наблюдатели (observeCart, observeUserInput)
- 🎨 Бонусные плашки на товарах

**Ключевые методы (25+ методов):**
```javascript
// ОБЯЗАТЕЛЬНЫЕ (IWidgetAdapter)
init()                    // Инициализация
getCartTotal()            // Сумма корзины
getContactInfo()          // Email и телефон
destroy()                 // Очистка

// ОПЦИОНАЛЬНЫЕ
applyPromocode(code)      // Применить промокод
observeCart()             // Отслеживать корзину (debounce 400ms)
observeUserInput()        // Отслеживать ввод (debounce 500ms)
initProductBadges()       // Бонусные плашки на товарах
mountInlineWidget()       // Монтирование UI

// ДОПОЛНИТЕЛЬНЫЕ (Tilda-специфичные)
getTildaCart()            // Объект window.tcart
getCartItems()            // Товары в корзине
getCurrentPromocode()     // Текущий промокод
getCheckoutForm()         // Форма оформления
getAllProducts()          // Все товары на странице
getProductPrice(el)       // Цена товара
```

**Поддерживаемые каталоги Tilda:**
- T706 (корзина)
- T776 (каталог)
- T754 (каталог)
- T750 (каталог)
- И другие

**Статус:** ✅ Готов к использованию (не в production)

---

### 4. **custom-adapter.js** v1.0.0
**Назначение:** Базовый адаптер для кастомных платформ (fallback + шаблон)

**Что делает:**
- 🔍 Универсальные селекторы для поиска элементов
- 📦 Базовая реализация IWidgetAdapter
- ✅ Валидация email и телефона
- 👀 Observer для корзины и ввода
- 📝 Шаблон для создания собственных адаптеров

**Когда используется:**
1. Платформа не определена автоматически
2. Ошибка загрузки специализированного адаптера
3. Разработчик хочет создать свой адаптер

**Универсальные селекторы:**
```javascript
// Корзина
'[data-cart-total]'
'.cart-total, .order-total, .checkout-total'
'input[name="total"]'

// Email
'input[type="email"]'
'input[name="email"]'
'[data-field="email"]'

// Телефон
'input[type="tel"]'
'input[name="phone"]'
'[data-field="phone"]'

// Промокод
'input[name="promo"]'
'input[name="promocode"]'
'[data-field="promo"]'
```

**Как расширить:**
```javascript
class MyPlatformAdapter extends CustomAdapter {
  constructor(core) {
    super(core);
  }
  
  // Переопределяем методы
  getCartTotal() {
    // Ваша логика для вашей платформы
    return window.myPlatform.cart.total;
  }
  
  applyPromocode(code) {
    // Ваша логика применения промокода
    window.myPlatform.applyPromo(code);
  }
}
```

**Статус:** ✅ Готов к использованию (не в production)

---

## 🔧 LEGACY (Production)

### 5. **tilda-bonus-widget.js** (Legacy)
**Назначение:** Старый монолитный виджет (СЕЙЧАС В PRODUCTION)

**Характеристики:**
- 📦 Монолитная архитектура (~2000+ строк)
- 🔗 Жестко привязан к Tilda
- ❌ Невозможно использовать на других платформах
- ⚠️ Сложно тестировать и поддерживать
- ✅ Стабильно работает в production

**Функционал:**
- Все то же самое что новая архитектура
- Но все в одном файле
- Tilda-специфичный код смешан с бизнес-логикой

**Статус:** 🟢 В PRODUCTION (не трогать до миграции)

**Когда будет заменен:**
- После завершения Phase 4-6 рефакторинга
- После полного тестирования новой архитектуры
- После A/B тестирования на 10% проектов

---

### 6. **tilda-adapter.backup.js**
**Назначение:** Бэкап старой версии tilda-adapter.js

**Зачем нужен:**
- 💾 Резервная копия на случай проблем
- 🔄 Возможность откатиться к предыдущей версии
- 📊 Сравнение изменений

**Статус:** 📦 Архив (не используется)

---

## 🧪 ТЕСТИРОВАНИЕ

### 7. **test-widget-loader.html**
**Назначение:** Тестовая страница для widget-loader.js

**Что тестирует:**
- ✅ Автоопределение платформы
- ✅ Загрузку Core и адаптера
- ✅ Инициализацию виджета
- ✅ Методы Core (setState, subscribe, clearCache)
- ✅ Работу адаптера (getCartTotal, getContactInfo)
- ✅ Обработку ошибок

**Секции тестов:**
1. Статус загрузки (мониторинг в реальном времени)
2. Информация о виджете
3. Имитация платформы Tilda
4. Тестирование API методов
5. Отладка

**Как использовать:**
```bash
# Запустить dev сервер
yarn dev

# Открыть в браузере
http://localhost:3000/test-widget-loader.html
```

**Статус:** ✅ Актуален

---

### 8. **test-tilda-adapter.html**
**Назначение:** Тестовая страница для tilda-adapter.js

**Что тестирует:**
- ✅ Инициализацию адаптера
- ✅ Работу с корзиной (getCartTotal, observeCart)
- ✅ Работу с промокодами (apply, clear, hide/show)
- ✅ Работу с контактами (getContactInfo, observeUserInput)
- ✅ Работу с товарами (getAllProducts, initProductBadges)
- ✅ Валидацию (email, phone)
- ✅ Очистку ресурсов (destroy)

**Секции тестов:**
1. Инициализация
2. Работа с корзиной
3. Работа с промокодами
4. Работа с контактами
5. Работа с товарами
6. Валидация
7. Очистка ресурсов

**Имитация Tilda:**
- Структура DOM (`.t706__cartwin`, `.t-inputpromocode__wrapper`)
- Объект `window.tcart`
- Товары в каталоге (`.t-store__card`)

**Статус:** ✅ Актуален

---

### 9. **test-tilda.html**
**Назначение:** Старая тестовая страница для legacy виджета

**Статус:** ⚠️ Устарел (можно удалить после миграции)

---

### 10. **TEST_ADAPTER_README.md**
**Назначение:** Документация по тестированию адаптеров

**Содержит:**
- Инструкции по запуску тестов
- Описание тестовых сценариев
- Примеры использования

**Статус:** ✅ Актуален

---

## 📊 Сравнение архитектур

### Legacy (tilda-bonus-widget.js)
```
┌─────────────────────────────────────┐
│   tilda-bonus-widget.js (~2000 строк)│
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Tilda DOM манипуляции        │  │
│  │ Бизнес-логика                │  │
│  │ API запросы                  │  │
│  │ UI рендеринг                 │  │
│  │ Все смешано в одном файле    │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Новая архитектура (Universal Widget)
```
┌──────────────────────────────────────────┐
│  widget-loader.js (автозагрузчик)        │
│  - Определяет платформу                  │
│  - Загружает нужные файлы                │
└──────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│  universal-widget.js (Core)              │
│  - Бизнес-логика                         │
│  - API запросы                           │
│  - Управление состоянием                 │
│  - UI рендеринг                          │
│  ❌ НЕТ платформо-специфичного кода      │
└──────────────────────────────────────────┘
           ↓ использует IWidgetAdapter
┌──────────────────────────────────────────┐
│  tilda-adapter.js (Tilda)                │
│  - Tilda DOM манипуляции                 │
│  - Работа с tcart                        │
│  - Tilda-специфичные методы              │
└──────────────────────────────────────────┘
```

---

## 🎯 Как это работает вместе

### Сценарий 1: Загрузка на Tilda сайте

```javascript
// 1. Клиент добавляет на свой Tilda сайт:
<script>
  window.LEAD_WIDGET_CONFIG = {
    projectId: 'abc123',
    apiUrl: 'https://bonus.gupil.ru'
  };
</script>
<script src="https://bonus.gupil.ru/widget-loader.js"></script>

// 2. widget-loader.js:
// - Определяет платформу: Tilda ✅
// - Загружает universal-widget.js
// - Загружает tilda-adapter.js
// - Создает экземпляры:
const core = new LeadWidgetCore(config);
const adapter = new TildaAdapter(core);
core.setAdapter(adapter);

// 3. Инициализация:
await core.init();
// - adapter.init() - захватывает Tilda элементы
// - adapter.observeCart() - следит за корзиной
// - adapter.observeUserInput() - следит за вводом
// - core.renderUI() - рендерит виджет

// 4. Пользователь добавляет товар в корзину:
// - Tilda обновляет DOM
// - adapter.observeCart() обнаруживает изменение (debounce 400ms)
// - adapter вызывает core.onPlatformCartUpdate(newTotal)
// - core обновляет state и UI

// 5. Пользователь вводит email:
// - adapter.observeUserInput() обнаруживает ввод (debounce 500ms)
// - adapter валидирует email
// - adapter вызывает core.onUserDataUpdate({email})
// - core проверяет регистрацию через API
// - core обновляет UI с балансом бонусов
```

### Сценарий 2: Загрузка на неизвестной платформе

```javascript
// 1. widget-loader.js определяет платформу:
// - Tilda? ❌
// - Shopify? ❌
// - WooCommerce? ❌
// - Fallback на Custom ✅

// 2. Загружает custom-adapter.js

// 3. CustomAdapter использует универсальные селекторы:
getCartTotal() {
  // Ищет [data-cart-total], .cart-total, input[name="total"]
  const el = document.querySelector('[data-cart-total]');
  return parseFloat(el?.dataset.cartTotal || 0);
}

// 4. Разработчик может расширить CustomAdapter
//    для своей платформы
```

---

## 🚀 Что использовать для разработки

### Для тестирования новой архитектуры:
1. **test-widget-loader.html** - полный цикл загрузки
2. **test-tilda-adapter.html** - тесты адаптера

### Для разработки нового адаптера:
1. Скопировать **custom-adapter.js**
2. Переименовать класс (например, `ShopifyAdapter`)
3. Реализовать методы для своей платформы
4. Добавить в **widget-loader.js** определение платформы

### Для production (СЕЙЧАС):
- **tilda-bonus-widget.js** - используется в production
- НЕ ТРОГАТЬ до завершения миграции

---

## 📋 Чеклист перед деплоем новой архитектуры

- [ ] Phase 4: Интеграция и документация (3 задачи)
- [ ] Phase 5: Тестирование (4 задачи)
- [ ] Phase 6: Миграция и деплой (3 задачи)
- [ ] A/B тестирование на 10% проектов
- [ ] Мониторинг ошибок и производительности
- [ ] Постепенный rollout до 100%
- [ ] Удаление legacy кода

---

## 🔗 Связанные документы

- `.kiro/specs/universal-widget/requirements.md` - Требования
- `.kiro/specs/universal-widget/tasks.md` - План задач
- `.kiro/specs/universal-widget/design.md` - Архитектурный дизайн
- `.kiro/specs/universal-widget/analysis.md` - Анализ legacy кода
- `docs/tilda-adapter-guide.md` - Гайд по Tilda адаптеру
- `docs/changelog.md` - История изменений

---

## ❓ FAQ

**Q: Какой файл загружать на сайт клиента?**  
A: Только `widget-loader.js` - он автоматически загрузит остальное.

**Q: Можно ли использовать новую архитектуру в production?**  
A: Пока НЕТ. Нужно завершить Phase 4-6 и провести тестирование.

**Q: Как создать адаптер для своей платформы?**  
A: Скопировать `custom-adapter.js` и реализовать методы IWidgetAdapter.

**Q: Что делать с legacy виджетом?**  
A: НЕ ТРОГАТЬ до завершения миграции. Он в production.

**Q: Зачем нужен widget-loader.js?**  
A: Для автоматического определения платформы и загрузки нужного адаптера.

**Q: Можно ли использовать только universal-widget.js без loader?**  
A: Да, но нужно вручную создавать экземпляры Core и Adapter.
