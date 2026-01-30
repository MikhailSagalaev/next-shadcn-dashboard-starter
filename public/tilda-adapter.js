/**
 * @file: tilda-adapter.js
 * @description: Адаптер для интеграции виджета с платформой Tilda
 * @implements: IWidgetAdapter
 */

(function () {
  'use strict';

  class TildaAdapter {
    constructor(core) {
      this.core = core;
      this.observers = new Set();
      this.promoHiddenClass = 'bonus-promocode-hidden';
      this.originalPromoStyles = null;
    }

    /**
     * Инициализация наблюдателей платформы
     */
    init() {
      this.observeCart();
      this.observeUserInput();
      this.capturePromoStyles();
      console.log('✅ TildaAdapter: Инициализирован');
    }

    /**
     * Получить текущую сумму корзины
     * @returns {number}
     */
    getCartTotal() {
      try {
        const totalEl = document.querySelector('.t706__cartwin-totalamount');
        if (!totalEl) return 0;

        // Удаляем символы валюты и все кроме цифр и разделителей
        let cleanText = totalEl.textContent.replace(/[^\d.,]/g, '');
        // Заменяем запятую на точку если нужно
        cleanText = cleanText.replace(',', '.');

        return parseFloat(cleanText) || 0;
      } catch (e) {
        console.warn('Ошибка парсинга суммы корзины:', e);
        return 0;
      }
    }

    /**
     * Получить контакты пользователя из полей ввода
     * @returns {{email: string|null, phone: string|null}}
     */
    getContactInfo() {
      let email = null;
      let phone = null;

      // Пробуем найти поля Tilda
      const emailInputs = document.querySelectorAll(
        'input[name="email"], input[type="email"], .t-input-group_email input'
      );
      for (const input of emailInputs) {
        if (input.value && input.value.includes('@')) {
          email = input.value.trim();
          break;
        }
      }

      const phoneInputs = document.querySelectorAll(
        'input[name="phone"], input[type="tel"], .t-input-group_phone input'
      );
      for (const input of phoneInputs) {
        // Базовая валидация (минимум 5 цифр)
        const digits = input.value.replace(/\D/g, '');
        if (digits.length > 5) {
          phone = input.value.trim();
          break;
        }
      }

      return { email, phone };
    }

    /**
     * Применить промокод к корзине
     * @param {string} code - Промокод для применения
     */
    applyPromocode(code) {
      const wrapper = document.querySelector('.t-inputpromocode__wrapper');
      const input = document.querySelector('.t-inputpromocode');
      const btn = document.querySelector('.t-inputpromocode__btn');

      if (input && btn) {
        // Если поле скрыто, логика обработки может потребоваться здесь
        // For now, Tilda requires the field to be present

        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        btn.click();
        return true;
      }
      return false;
    }

    /**
     * Скрыть или показать нативное поле промокода
     * @param {boolean} hidden
     */
    setPromocodeFieldVisibility(hidden) {
      const wrapper = document.querySelector('.t-inputpromocode__wrapper');
      if (!wrapper) return;

      if (hidden) {
        this.capturePromoStyles(wrapper);
        wrapper.classList.add(this.promoHiddenClass);
        wrapper.style.display = 'none'; // Принудительное скрытие
        wrapper.setAttribute('aria-hidden', 'true');
      } else {
        wrapper.classList.remove(this.promoHiddenClass);
        // Восстановление стилей
        wrapper.style.display = '';
        wrapper.removeAttribute('aria-hidden');
      }
    }

    capturePromoStyles(wrapper) {
      if (!wrapper)
        wrapper = document.querySelector('.t-inputpromocode__wrapper');
      if (!wrapper || this.originalPromoStyles) return;

      this.originalPromoStyles = wrapper.getAttribute('style');
    }

    /**
     * Отслеживание изменений корзины
     */
    observeCart() {
      const cartWin = document.querySelector('.t706__cartwin');
      if (!cartWin) return;

      const observer = new MutationObserver((mutations) => {
        // Debounce можно реализовать в ядре, здесь просто отправляем событие
        this.core.onPlatformCartUpdate(this.getCartTotal());
      });

      observer.observe(cartWin, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
      this.observers.add(observer);
    }

    /**
     * Отслеживание ввода пользователя
     */
    observeUserInput() {
      // Use efficient delegation or specific inputs
      const handleInput = (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        const type = target.type;
        const name = target.name;

        if (type === 'email' || name === 'email' || name.includes('email')) {
          this.core.onUserDataUpdate({ email: target.value });
        } else if (
          type === 'tel' ||
          name === 'phone' ||
          name.includes('phone')
        ) {
          this.core.onUserDataUpdate({ phone: target.value });
        }
      };

      document.addEventListener('input', handleInput, { passive: true });
      document.addEventListener('change', handleInput, { passive: true });
      // Store cleanup function if needed, or relying on page lifecycle
    }

    /**
     * Инициализация бонусных плашек
     * @param {object} settings
     * @param {function} calculatorFn Функция расчета бонусов (из ядра)
     */
    initProductBadges(settings, calculatorFn) {
      if (settings.productBadgeEnabled === false) return;

      this.badgeSettings = settings;
      this.calculateBonus = calculatorFn;

      // Стили для плашек
      this.injectBadgeStyles(settings);

      // Поиск и добавление на карточки
      this.addBadgesToCards();

      // Наблюдатель за подгрузкой товаров
      const container = document.querySelector('.t-records') || document.body;
      const observer = new MutationObserver(() => this.addBadgesToCards());
      observer.observe(container, { childList: true, subtree: true });
      this.observers.add(observer);
    }

    injectBadgeStyles(settings) {
      if (document.getElementById('lw-badge-styles')) return;
      const style = document.createElement('style');
      style.id = 'lw-badge-styles';
      style.textContent = `
            .lw-bonus-badge {
                background-color: ${settings.productBadgeBackgroundColor || '#f1f1f1'};
                color: ${settings.productBadgeTextColor || '#000000'};
                font-size: ${settings.productBadgeFontSize || '14px'};
                padding: ${settings.productBadgePadding || '5px 10px'};
                border-radius: ${settings.productBadgeBorderRadius || '5px'};
                margin-top: 5px;
                display: inline-block;
            }
        `;
      document.head.appendChild(style);
    }

    addBadgesToCards() {
      // Селекторы карточек Тильды
      const selectors = [
        '.js-product',
        '.t-store__card',
        '.t776__col',
        '.t754__col'
      ];

      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((card) => {
          if (card.dataset.lwBadgeAdded) return;

          // Находим цену
          const priceEl =
            card.querySelector('.js-product-price') ||
            card.querySelector('.t-store__card__price-value') ||
            card.querySelector('.t776__price-value');

          if (!priceEl) return;

          const price = parseFloat(
            priceEl.textContent.replace(/[^\d.,]/g, '').replace(',', '.')
          );
          if (!price) return;

          const bonus = this.calculateBonus(price);
          if (bonus <= 0) return;

          // Создаем плашку
          const badge = document.createElement('div');
          badge.className = 'lw-bonus-badge';
          badge.textContent = (
            this.badgeSettings.productBadgeText || 'Бонусы: {bonusAmount}'
          ).replace('{bonusAmount}', bonus);

          // Вставляем после цены
          priceEl.parentNode.insertBefore(badge, priceEl.nextSibling);
          card.dataset.lwBadgeAdded = 'true';
        });
      });
    }

    /**
     * Монтирование инлайн-виджета в структуру страницы
     * @param {function} renderCallback - Функция рендера из ядра, принимает контейнер
     */
    mountInlineWidget(renderCallback) {
      const promoWrapper = document.querySelector('.t-inputpromocode__wrapper');
      if (!promoWrapper) return;

      // Скрываем нативное поле (но не удаляем)
      this.setPromocodeFieldVisibility(true);

      let container = document.querySelector('.lw-inline-widget-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'lw-inline-widget-container';
        // Вставляем ПЕРЕД полем промокода
        promoWrapper.parentNode.insertBefore(container, promoWrapper);
      }

      renderCallback(container);
    }

    destroy() {
      this.observers.forEach((obs) => obs.disconnect());
      this.observers.clear();
      // Remove event listeners if stored
    }
  }

  // Экспорт в глобальную область видимости
  window.TildaAdapter = TildaAdapter;
})();
