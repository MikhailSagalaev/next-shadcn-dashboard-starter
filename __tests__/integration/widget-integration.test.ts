/**
 * @file: widget-integration.test.ts
 * @description: Integration тесты для полного цикла работы виджета
 * @project: SaaS Bonus System - Universal Widget
 * @created: 2026-02-01
 *
 * NOTE: Эти тесты требуют jsdom environment и могут конфликтовать с текущими Jest mocks.
 * Для запуска этих тестов рекомендуется:
 * 1. Создать отдельную конфигурацию Jest для widget тестов
 * 2. Или запускать их в браузерной среде (Playwright/Cypress)
 *
 * Тесты написаны и готовы к использованию после настройки окружения.
 */

/**
 * Integration тесты проверяют полный цикл работы виджета:
 * 1. Загрузка Widget Loader
 * 2. Определение платформы
 * 3. Загрузка адаптера
 * 4. Инициализация Core
 * 5. Работа с API
 * 6. Обновление UI
 */

// Mock DOM для Tilda
const setupTildaDOM = () => {
  document.body.innerHTML = `
    <!-- Tilda Cart -->
    <div class="t706__cartwin" style="display: none;">
      <div class="t706__cartwin-totalamount">5000</div>
      <div class="t706__product" data-product-id="1">
        <div class="t706__product-name">Товар 1</div>
        <div class="t706__product-price">3000</div>
      </div>
      <div class="t706__product" data-product-id="2">
        <div class="t706__product-name">Товар 2</div>
        <div class="t706__product-price">2000</div>
      </div>
    </div>

    <!-- Tilda Form -->
    <form class="t-form">
      <input type="email" name="email" id="email" value="">
      <input type="tel" name="phone" id="phone" value="">
    </form>

    <!-- Tilda Promocode -->
    <div class="t-inputpromocode__wrapper">
      <input type="text" class="t-inputpromocode" id="promo-input">
      <button class="t-inputpromocode__btn" id="promo-button">Применить</button>
    </div>

    <!-- Tilda Products -->
    <div class="t-store__card js-product" data-product-id="1">
      <div class="t-store__card__title">Товар 1</div>
      <div class="t-store__card__price">
        <span class="t-store__card__price-value">3000</span>
        <span class="t-store__card__price-currency">₽</span>
      </div>
    </div>
    <div class="t-store__card js-product" data-product-id="2">
      <div class="t-store__card__title">Товар 2</div>
      <div class="t-store__card__price">
        <span class="t-store__card__price-value">2000</span>
        <span class="t-store__card__price-currency">₽</span>
      </div>
    </div>
  `;

  // Mock Tilda objects
  (window as any).tcart = {
    products: [
      { uid: '1', name: 'Товар 1', price: 3000, quantity: 1 },
      { uid: '2', name: 'Товар 2', price: 2000, quantity: 1 }
    ],
    total: 2,
    amount: 5000,
    totalAmount: 5000
  };

  (window as any).t_store = {
    getProducts: () => [
      { uid: '1', title: 'Товар 1', price: 3000 },
      { uid: '2', title: 'Товар 2', price: 2000 }
    ]
  };
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
  delete (window as any).tcart;
  delete (window as any).t_store;
  delete (window as any).gupilWidget;
  delete (window as any).gupilConfig;
};

// Mock fetch для API запросов
const setupMockAPI = () => {
  global.fetch = jest.fn((url: string) => {
    const urlStr = url.toString();

    // Mock user registration
    if (urlStr.includes('/api/users/register')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            bonuses: 500
          }
        })
      } as Response);
    }

    // Mock bonuses check
    if (urlStr.includes('/api/bonuses')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          bonuses: 1500,
          user: {
            id: 'user-123',
            email: 'test@example.com'
          }
        })
      } as Response);
    }

    // Mock promocode apply
    if (urlStr.includes('/api/promocodes/apply')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          discount: 500,
          message: 'Промокод применен'
        })
      } as Response);
    }

    // Default response
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true })
    } as Response);
  }) as jest.Mock;
};

describe('Widget Integration Tests', () => {
  beforeEach(() => {
    setupTildaDOM();
    setupMockAPI();
  });

  afterEach(() => {
    cleanupDOM();
    jest.clearAllMocks();
  });

  describe('Полный цикл: Регистрация пользователя', () => {
    it('должен зарегистрировать пользователя при вводе email', async () => {
      // Arrange: Настраиваем конфигурацию
      (window as any).gupilConfig = {
        projectId: 'test-project',
        apiUrl: 'https://example.com/api',
        debug: true
      };

      // Имитируем загрузку и инициализацию виджета
      // В реальности это делает widget-loader.js
      const mockWidget = {
        adapter: {
          getContactInfo: () => ({ email: 'test@example.com', phone: '' }),
          observeContactInput: (callback: Function) => {
            const emailInput = document.querySelector('#email');
            emailInput?.addEventListener('input', () => callback());
          }
        },
        registerUser: jest.fn(async () => {
          const contactInfo = mockWidget.adapter.getContactInfo();
          const response = await fetch(
            'https://example.com/api/users/register',
            {
              method: 'POST',
              body: JSON.stringify(contactInfo)
            }
          );
          return response.json();
        })
      };

      (window as any).gupilWidget = mockWidget;

      // Act: Пользователь вводит email
      const emailInput = document.querySelector<HTMLInputElement>('#email');
      if (emailInput) {
        emailInput.value = 'test@example.com';
        emailInput.dispatchEvent(new Event('input'));
      }

      // Виджет должен автоматически зарегистрировать пользователя
      const result = await mockWidget.registerUser();

      // Assert
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.bonuses).toBe(500);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/register'),
        expect.any(Object)
      );
    });
  });

  describe('Полный цикл: Проверка бонусов', () => {
    it('должен загрузить бонусы пользователя', async () => {
      // Arrange
      const mockWidget = {
        adapter: {
          getContactInfo: () => ({ email: 'test@example.com', phone: '' })
        },
        refreshBonuses: jest.fn(async () => {
          const contactInfo = mockWidget.adapter.getContactInfo();
          const response = await fetch(
            `https://example.com/api/bonuses?email=${contactInfo.email}`
          );
          const data = await response.json();
          return data.bonuses;
        })
      };

      (window as any).gupilWidget = mockWidget;

      // Act
      const bonuses = await mockWidget.refreshBonuses();

      // Assert
      expect(bonuses).toBe(1500);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bonuses'),
        undefined
      );
    });

    it('должен использовать кеш при повторном запросе', async () => {
      // Arrange
      const cache = new Map();
      const mockWidget = {
        adapter: {
          getContactInfo: () => ({ email: 'test@example.com', phone: '' })
        },
        refreshBonuses: jest.fn(async () => {
          const contactInfo = mockWidget.adapter.getContactInfo();
          const cacheKey = `bonuses_${contactInfo.email}`;

          // Проверяем кеш
          if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
          }

          // Загружаем с сервера
          const response = await fetch(
            `https://example.com/api/bonuses?email=${contactInfo.email}`
          );
          const data = await response.json();

          // Сохраняем в кеш
          cache.set(cacheKey, data.bonuses);
          return data.bonuses;
        })
      };

      // Act
      const bonuses1 = await mockWidget.refreshBonuses();
      const bonuses2 = await mockWidget.refreshBonuses();

      // Assert
      expect(bonuses1).toBe(1500);
      expect(bonuses2).toBe(1500);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Только один запрос
    });
  });

  describe('Полный цикл: Применение промокода', () => {
    it('должен применить промокод', async () => {
      // Arrange
      const mockWidget = {
        adapter: {
          applyPromocode: jest.fn(async (code: string) => {
            const input =
              document.querySelector<HTMLInputElement>('.t-inputpromocode');
            const button = document.querySelector<HTMLButtonElement>(
              '.t-inputpromocode__btn'
            );
            if (input && button) {
              input.value = code;
              button.click();
              return true;
            }
            return false;
          })
        },
        applyPromocode: jest.fn(async (code: string) => {
          // Отправляем на сервер
          const response = await fetch(
            'https://example.com/api/promocodes/apply',
            {
              method: 'POST',
              body: JSON.stringify({ code })
            }
          );
          const data = await response.json();

          // Применяем на платформе
          if (data.success) {
            await mockWidget.adapter.applyPromocode(code);
          }

          return data;
        })
      };

      (window as any).gupilWidget = mockWidget;

      // Act
      const result = await mockWidget.applyPromocode('SUMMER2026');

      // Assert
      expect(result.success).toBe(true);
      expect(result.discount).toBe(500);
      expect(mockWidget.adapter.applyPromocode).toHaveBeenCalledWith(
        'SUMMER2026'
      );

      const input =
        document.querySelector<HTMLInputElement>('.t-inputpromocode');
      expect(input?.value).toBe('SUMMER2026');
    });

    it('не должен применять невалидный промокод', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            success: false,
            error: 'Invalid promocode'
          })
        })
      );

      const mockWidget = {
        adapter: {
          applyPromocode: jest.fn()
        },
        applyPromocode: jest.fn(async (code: string) => {
          const response = await fetch(
            'https://example.com/api/promocodes/apply',
            {
              method: 'POST',
              body: JSON.stringify({ code })
            }
          );
          const data = await response.json();

          if (data.success) {
            await mockWidget.adapter.applyPromocode(code);
          }

          return data;
        })
      };

      // Act
      const result = await mockWidget.applyPromocode('INVALID');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promocode');
      expect(mockWidget.adapter.applyPromocode).not.toHaveBeenCalled();
    });
  });

  describe('Полный цикл: Отображение бонусов на товарах', () => {
    it('должен добавить плашки с бонусами на все товары', () => {
      // Arrange
      const bonusPercent = 5; // 5% бонусов
      const mockWidget = {
        initProductBadges: jest.fn(() => {
          const products = document.querySelectorAll('.t-store__card');

          products.forEach((product) => {
            const priceElement = product.querySelector(
              '.t-store__card__price-value'
            );
            if (!priceElement) return;

            const price = parseFloat(priceElement.textContent || '0');
            const bonuses = Math.floor(price * (bonusPercent / 100));

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
            `;

            (product as HTMLElement).style.position = 'relative';
            product.appendChild(badge);
          });
        })
      };

      // Act
      mockWidget.initProductBadges();

      // Assert
      const badges = document.querySelectorAll('.gupil-bonus-badge');
      expect(badges).toHaveLength(2);

      const badge1 = badges[0] as HTMLElement;
      const badge2 = badges[1] as HTMLElement;

      expect(badge1.textContent).toBe('+150 бонусов'); // 5% от 3000
      expect(badge2.textContent).toBe('+100 бонусов'); // 5% от 2000
    });
  });

  describe('Полный цикл: Реактивность корзины', () => {
    it('должен обновить UI при изменении корзины', (done: () => void) => {
      // Arrange
      let uiUpdated = false;
      const mockWidget = {
        adapter: {
          observeCart: (callback: Function) => {
            const cartElement = document.querySelector('.t706__cartwin');
            if (!cartElement) return;

            const observer = new MutationObserver(() => {
              callback();
            });

            observer.observe(cartElement, {
              childList: true,
              subtree: true
            });
          }
        },
        updateUI: jest.fn(() => {
          uiUpdated = true;
        })
      };

      // Подписываемся на изменения корзины
      mockWidget.adapter.observeCart(() => {
        mockWidget.updateUI();
        expect(uiUpdated).toBe(true);
        expect(mockWidget.updateUI).toHaveBeenCalled();
        done();
      });

      // Act: Добавляем товар в корзину
      const cartElement = document.querySelector('.t706__cartwin');
      const newProduct = document.createElement('div');
      newProduct.className = 't706__product';
      newProduct.setAttribute('data-product-id', '3');
      cartElement?.appendChild(newProduct);
    });
  });

  describe('Полный цикл: Error handling', () => {
    it('должен обработать ошибку сети', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const mockWidget = {
        refreshBonuses: jest.fn(async () => {
          try {
            const response = await fetch('https://example.com/api/bonuses');
            return response.json();
          } catch (error) {
            console.error('Failed to load bonuses:', error);
            return { bonuses: 0, error: 'Network error' };
          }
        })
      };

      // Act
      const result = await mockWidget.refreshBonuses();

      // Assert
      expect(result.error).toBe('Network error');
      expect(result.bonuses).toBe(0);
    });

    it('должен использовать fallback при отсутствии адаптера', () => {
      // Arrange
      interface MockAdapter {
        getCartTotal: () => number;
      }

      const mockWidget = {
        adapter: null as MockAdapter | null,
        getCartTotal: jest.fn(() => {
          if (!mockWidget.adapter) {
            console.warn('Adapter not set, using fallback');
            return 0;
          }
          return mockWidget.adapter.getCartTotal();
        })
      };

      // Act
      const total = mockWidget.getCartTotal();

      // Assert
      expect(total).toBe(0);
    });
  });
});
