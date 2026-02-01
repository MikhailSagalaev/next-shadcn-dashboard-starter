/**
 * @file: custom-adapter.js
 * @description: Базовый адаптер для кастомных платформ (fallback)
 * @implements: IWidgetAdapter
 * @version: 1.0.0
 * @project: SaaS Bonus System - Universal Widget
 *
 * НАЗНАЧЕНИЕ:
 * - Fallback адаптер для платформ без специализированного адаптера
 * - Базовая реализация обязательных методов интерфейса
 * - Шаблон для создания собственных адаптеров
 *
 * ИСПОЛЬЗОВАНИЕ:
 * Этот адаптер используется автоматически когда платформа не определена.
 * Разработчики могут расширить его для своих платформ.
 */

(function () {
  'use strict';

  class CustomAdapter {
    constructor(core) {
      this.core = core;
      this.observers = new Set();
      this.lastCartTotal = 0;
      this.debounceTimers = new Map();
    }

    /**
     * ========================================
     * ОБЯЗАТЕЛЬНЫЕ МЕТОДЫ ИНТЕРФЕЙСА
     * ========================================
     */

    /**
     * Инициализация адаптера
     */
    init() {
      this.log('✅ CustomAdapter: Инициализация');
      this.log(
        '⚠️ Используется базовый адаптер. Рекомендуется создать специализированный адаптер для вашей платформы.'
      );
    }

    /**
     * Получить текущую сумму корзины
     * @returns {number}
     */
    getCartTotal() {
      // Базовая реализация - ищем элементы с data-атрибутами
      try {
        // Попытка 1: data-cart-total
        const cartEl = document.querySelector('[data-cart-total]');
        if (cartEl) {
          const total = parseFloat(
            cartEl.dataset.cartTotal || cartEl.textContent
          );
          if (!isNaN(total)) return total;
        }

        // Попытка 2: элемент с классом cart-total
        const totalEl = document.querySelector(
          '.cart-total, .order-total, .checkout-total'
        );
        if (totalEl) {
          const text = totalEl.textContent
            .replace(/[^\d.,]/g, '')
            .replace(',', '.');
          const total = parseFloat(text);
          if (!isNaN(total)) return total;
        }

        // Попытка 3: input с name="total"
        const input = document.querySelector(
          'input[name="total"], input[name="order_total"]'
        );
        if (input) {
          const total = parseFloat(input.value);
          if (!isNaN(total)) return total;
        }

        return 0;
      } catch (e) {
        this.log('❌ Ошибка получения суммы корзины:', e);
        return 0;
      }
    }

    /**
     * Получить контакты пользователя
     * @returns {{email: string|null, phone: string|null}}
     */
    getContactInfo() {
      let email = null;
      let phone = null;

      try {
        // Поиск email
        const emailInputs = document.querySelectorAll(
          'input[type="email"], input[name="email"], input[name="user_email"], [data-field="email"]'
        );
        for (const input of emailInputs) {
          if (input.value && this.validateEmail(input.value)) {
            email = input.value.trim();
            break;
          }
        }

        // Поиск телефона
        const phoneInputs = document.querySelectorAll(
          'input[type="tel"], input[name="phone"], input[name="user_phone"], [data-field="phone"]'
        );
        for (const input of phoneInputs) {
          if (input.value && this.validatePhone(input.value)) {
            phone = input.value.trim();
            break;
          }
        }
      } catch (e) {
        this.log('❌ Ошибка получения контактов:', e);
      }

      return { email, phone };
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
      this.log('🧹 CustomAdapter: Очистка ресурсов');

      this.observers.forEach((obs) => obs.disconnect());
      this.observers.clear();

      this.debounceTimers.forEach((timer) => clearTimeout(timer));
      this.debounceTimers.clear();
    }

    /**
     * ========================================
     * ОПЦИОНАЛЬНЫЕ МЕТОДЫ
     * ========================================
     */

    /**
     * Применить промокод (базовая реализация)
     * @param {string} code
     * @returns {Promise<boolean>}
     */
    async applyPromocode(code) {
      this.log(
        `⚠️ applyPromocode не реализован для CustomAdapter. Код: ${code}`
      );

      // Попытка найти поле промокода
      const input = document.querySelector(
        'input[name="promo"], input[name="promocode"], input[name="coupon"], [data-field="promo"]'
      );

      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Попытка найти кнопку применения
        const btn =
          input.parentElement?.querySelector('button') ||
          document.querySelector('[data-action="apply-promo"]');

        if (btn) {
          btn.click();
          return true;
        }
      }

      return false;
    }

    /**
     * Отслеживание изменений корзины
     */
    observeCart() {
      // Ищем контейнер корзины
      const cartContainer =
        document.querySelector(
          '[data-cart], .cart, .shopping-cart, .checkout'
        ) || document.body;

      let debounceTimer = null;

      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          const newTotal = this.getCartTotal();

          if (this.lastCartTotal !== newTotal) {
            this.log(
              `📊 Корзина изменилась: ${this.lastCartTotal} → ${newTotal}`
            );
            this.lastCartTotal = newTotal;
            this.core.onPlatformCartUpdate(newTotal);
          }
        }, 400);
      });

      observer.observe(cartContainer, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      this.observers.add(observer);
      this.log('✅ Observer корзины запущен');
    }

    /**
     * Отслеживание ввода пользователя
     */
    observeUserInput() {
      const handleInput = (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        const type = target.type;
        const name = target.name;
        const value = target.value;

        let fieldType = null;
        if (type === 'email' || name.includes('email')) {
          fieldType = 'email';
        } else if (type === 'tel' || name.includes('phone')) {
          fieldType = 'phone';
        }

        if (!fieldType) return;

        if (this.debounceTimers.has(fieldType)) {
          clearTimeout(this.debounceTimers.get(fieldType));
        }

        this.debounceTimers.set(
          fieldType,
          setTimeout(() => {
            if (fieldType === 'email' && !this.validateEmail(value)) return;
            if (fieldType === 'phone' && !this.validatePhone(value)) return;

            this.log(`📝 Пользователь ввел ${fieldType}:`, value);
            this.core.onUserDataUpdate({ [fieldType]: value });
          }, 500)
        );
      };

      document.addEventListener('input', handleInput, { passive: true });
      document.addEventListener('change', handleInput, { passive: true });

      this.log('✅ Observer ввода пользователя запущен');
    }

    /**
     * Монтирование инлайн-виджета
     * @param {function} renderCallback
     */
    mountInlineWidget(renderCallback) {
      // Ищем подходящее место для виджета
      const mountPoint = document.querySelector(
        '[data-widget-mount], .checkout-sidebar, .order-summary'
      );

      if (!mountPoint) {
        this.log('⚠️ Точка монтирования не найдена');
        return;
      }

      let container = document.querySelector('.lw-inline-widget-container');

      if (!container) {
        container = document.createElement('div');
        container.className = 'lw-inline-widget-container';
        container.style.cssText = 'margin-bottom: 16px;';

        mountPoint.insertBefore(container, mountPoint.firstChild);
      }

      renderCallback(container);
      this.log('✅ Инлайн виджет смонтирован');
    }

    /**
     * ========================================
     * УТИЛИТЫ
     * ========================================
     */

    /**
     * Валидация email
     * @param {string} email
     * @returns {boolean}
     */
    validateEmail(email) {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
    }

    /**
     * Валидация телефона
     * @param {string} phone
     * @returns {boolean}
     */
    validatePhone(phone) {
      if (!phone || typeof phone !== 'string') return false;
      const digits = phone.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }

    /**
     * Логирование
     * @param {...any} args
     */
    log(...args) {
      if (this.core && this.core.config && this.core.config.debug) {
        console.log('[CustomAdapter]', ...args);
      }
    }
  }

  // Экспорт в глобальную область видимости
  window.CustomAdapter = CustomAdapter;
})();
