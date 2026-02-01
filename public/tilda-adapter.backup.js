/**
 * @file: tilda-adapter.js
 * @description: Адаптер для интеграции виджета с платформой Tilda
 * @implements: IWidgetAdapter
 * @version: 2.0.0
 * @status: В разработке (не используется в production)
 *
 * АРХИТЕКТУРА:
 * - Изолирует всю Tilda-специфичную логику от ядра виджета
 * - Реализует паттерн Adapter для мультиплатформенности
 * - Предоставляет унифицированный API для работы с платформой
 *
 * ИНТЕРФЕЙС ЯДРА (IWidgetCore):
 * - onCartUpdate(total: number): void
 * - onUserDataUpdate(data: {email?, phone?}): void
 * - calculateBonus(price: number): number
 * - renderInlineWidget(container: HTMLElement): void
 *
 * TODO перед внедрением:
 * 1. Создать WidgetCore класс с реализацией IWidgetCore
 * 2. Протестировать на реальном сайте Tilda
 * 3. Добавить обработку ошибок и fallback
 * 4. Добавить логирование для отладки
 */

(function () {
  'use strict';

  /**
   * Адаптер для платформы Tilda
   * Инкапсулирует всю логику взаимодействия с DOM Tilda
   */
  class TildaAdapter {
    /**
     * @param {IWidgetCore} core - Ядро виджета с бизнес-логикой
     */
    constructor(core) {
      if (!core) {
        throw new Error('TildaAdapter: core is required');
      }

      this.core = core;
      this.observers = new Set();
      this.eventListeners = new Map();
      this.promoHiddenClass = 'bonus-promocode-hidden';
      this.originalPromoStyles = null;
      this.isInitialized = false;

      // Debounce таймеры
      this.cartUpdateTimer = null;
      this.userInputTimer = null;
    }

    /**
     * Инициализация адаптера
     * Запускает все наблюдатели и подготавливает платформу
     */
    init() {
      if (this.isInitialized) {
        console.warn('TildaAdapter: Уже инициализирован');
        return;
      }

      try {
        // Проверяем что мы на Tilda
        if (!this.isTildaPlatform()) {
          throw new Error('Не обнаружена платформа Tilda');
        }

        // Инициализируем наблюдатели
        this.observeCart();
        this.observeUserInput();
        this.capturePromoStyles();

        this.isInitialized = true;
        console.log('✅ TildaAdapter: Инициализирован успешно');
      } catch (error) {
        console.error('❌ TildaAdapter: Ошибка инициализации:', error);
        throw error;
      }
    }

    /**
     * Проверка что мы на платформе Tilda
     * @returns {boolean}
     */
    isTildaPlatform() {
      // Проверяем наличие характерных элементов Tilda
      return !!(
        document.querySelector('.t706__cartwin') || // Корзина
        document.querySelector('.t-store') || // Магазин
        document.querySelector('.t-inputpromocode') || // Промокод
        window.tildaForm || // Tilda Forms API
        document.querySelector('[data-tilda]') // Любой Tilda элемент
      );
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
     * Применить промокод к корзине Tilda
     * @param {string} code - Промокод для применения
     * @returns {boolean} Успешность применения
     */
    applyPromocode(code) {
      if (!code) {
        console.warn('TildaAdapter: Пустой промокод');
        return false;
      }

      const input = document.querySelector('.t-inputpromocode');
      const btn = document.querySelector('.t-inputpromocode__btn');

      if (!input || !btn) {
        console.warn('TildaAdapter: Поле промокода не найдено');
        return false;
      }

      try {
        // Устанавливаем значение
        input.value = code;

        // Триггерим события для Tilda
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Кликаем кнопку применения
        setTimeout(() => btn.click(), 100);

        console.log('✅ TildaAdapter: Промокод применен:', code);
        return true;
      } catch (error) {
        console.error('❌ TildaAdapter: Ошибка применения промокода:', error);
        return false;
      }
    }

    /**
     * Скрыть или показать нативное поле промокода
     * @param {boolean} hidden - Скрыть (true) или показать (false)
     */
    setPromocodeFieldVisibility(hidden) {
      const wrapper = document.querySelector('.t-inputpromocode__wrapper');
      if (!wrapper) {
        console.warn('TildaAdapter: Обертка промокода не найдена');
        return;
      }

      if (hidden) {
        // Сохраняем оригинальные стили перед скрытием
        if (!this.originalPromoStyles) {
          this.originalPromoStyles = wrapper.getAttribute('style') || '';
        }

        wrapper.classList.add(this.promoHiddenClass);
        wrapper.style.display = 'none';
        wrapper.setAttribute('aria-hidden', 'true');
        console.log('✅ TildaAdapter: Поле промокода скрыто');
      } else {
        wrapper.classList.remove(this.promoHiddenClass);

        // Восстанавливаем оригинальные стили
        if (this.originalPromoStyles) {
          wrapper.setAttribute('style', this.originalPromoStyles);
        } else {
          wrapper.style.display = '';
        }

        wrapper.removeAttribute('aria-hidden');
        console.log('✅ TildaAdapter: Поле промокода показано');
      }
    }

    /**
     * Сохранить оригинальные стили поля промокода
     * @param {HTMLElement} [wrapper] - Обертка промокода (опционально)
     */
    capturePromoStyles(wrapper) {
      if (this.originalPromoStyles) return; // Уже сохранены

      if (!wrapper) {
        wrapper = document.querySelector('.t-inputpromocode__wrapper');
      }

      if (wrapper) {
        this.originalPromoStyles = wrapper.getAttribute('style') || '';
        console.log('✅ TildaAdapter: Стили промокода сохранены');
      }
    }

    /**
     * Отслеживание изменений корзины с debounce
     */
    observeCart() {
      const cartWin = document.querySelector('.t706__cartwin');
      if (!cartWin) {
        console.warn('TildaAdapter: Корзина не найдена');
        return;
      }

      const observer = new MutationObserver(() => {
        // Debounce для избежания множественных вызовов
        clearTimeout(this.cartUpdateTimer);
        this.cartUpdateTimer = setTimeout(() => {
          const total = this.getCartTotal();
          if (this.core.onCartUpdate) {
            this.core.onCartUpdate(total);
          }
        }, 300);
      });

      observer.observe(cartWin, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      this.observers.add(observer);
      console.log('✅ TildaAdapter: Наблюдатель корзины активирован');
    }

    /**
     * Отслеживание ввода пользователя с debounce
     */
    observeUserInput() {
      const handleInput = (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        const type = target.type;
        const name = target.name;
        const value = target.value.trim();

        // Debounce для избежания множественных вызовов
        clearTimeout(this.userInputTimer);
        this.userInputTimer = setTimeout(() => {
          if (type === 'email' || name === 'email' || name.includes('email')) {
            if (value.includes('@') && this.core.onUserDataUpdate) {
              this.core.onUserDataUpdate({ email: value });
            }
          } else if (
            type === 'tel' ||
            name === 'phone' ||
            name.includes('phone')
          ) {
            const digits = value.replace(/\D/g, '');
            if (digits.length >= 5 && this.core.onUserDataUpdate) {
              this.core.onUserDataUpdate({ phone: value });
            }
          }
        }, 500);
      };

      document.addEventListener('input', handleInput, { passive: true });
      document.addEventListener('change', handleInput, { passive: true });

      // Сохраняем для cleanup
      this.eventListeners.set('input', handleInput);
      this.eventListeners.set('change', handleInput);

      console.log('✅ TildaAdapter: Наблюдатель ввода активирован');
    }

    /**
     * Инициализация бонусных плашек на товарах
     * @param {object} settings - Настройки плашек из виджета
     * @param {function} calculatorFn - Функция расчета бонусов (из ядра)
     */
    initProductBadges(settings, calculatorFn) {
      if (!settings || settings.productBadgeEnabled === false) {
        console.log('TildaAdapter: Плашки товаров отключены');
        return;
      }

      if (!calculatorFn || typeof calculatorFn !== 'function') {
        console.error('TildaAdapter: calculatorFn должна быть функцией');
        return;
      }

      this.badgeSettings = settings;
      this.calculateBonus = calculatorFn;

      try {
        // Инжектим стили для плашек
        this.injectBadgeStyles(settings);

        // Добавляем плашки на существующие карточки
        this.addBadgesToCards();

        // Наблюдатель за динамической подгрузкой товаров
        const container = document.querySelector('.t-records') || document.body;
        const observer = new MutationObserver(() => {
          this.addBadgesToCards();
        });

        observer.observe(container, {
          childList: true,
          subtree: true
        });

        this.observers.add(observer);
        console.log('✅ TildaAdapter: Плашки товаров инициализированы');
      } catch (error) {
        console.error('❌ TildaAdapter: Ошибка инициализации плашек:', error);
      }
    }

    /**
     * Инжектирование CSS стилей для плашек
     * @param {object} settings - Настройки стилей
     */
    injectBadgeStyles(settings) {
      if (document.getElementById('lw-badge-styles')) {
        console.log('TildaAdapter: Стили плашек уже добавлены');
        return;
      }

      const style = document.createElement('style');
      style.id = 'lw-badge-styles';
      style.textContent = `
        .lw-bonus-badge {
          background-color: ${settings.productBadgeBackgroundColor || '#f1f1f1'};
          color: ${settings.productBadgeTextColor || '#000000'};
          font-size: ${settings.productBadgeFontSize || '14px'};
          padding: ${settings.productBadgePadding || '5px 10px'};
          border-radius: ${settings.productBadgeBorderRadius || '5px'};
          margin-top: ${settings.productBadgeMarginTop || '5px'};
          margin-left: ${settings.productBadgeMarginX || '0'};
          margin-right: ${settings.productBadgeMarginX || '0'};
          display: block;
          width: fit-content;
          transition: all 0.2s ease;
        }
        .lw-bonus-badge:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      `;

      document.head.appendChild(style);
      console.log('✅ TildaAdapter: Стили плашек добавлены');
    }

    /**
     * Добавление плашек на карточки товаров
     */
    addBadgesToCards() {
      // Все возможные селекторы карточек Tilda
      const selectors = [
        '.js-product', // Стандартные товары
        '.t-store__card', // Карточки магазина
        '.t776__col', // Каталог товаров (блок T776)
        '.t754__col', // Каталог товаров (блок T754)
        '.t762__col', // Каталог товаров (блок T762)
        '.t1050__col' // Каталог товаров (блок T1050)
      ];

      let addedCount = 0;

      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((card) => {
          // Пропускаем если уже добавили
          if (card.dataset.lwBadgeAdded === 'true') return;

          try {
            // Ищем элемент с ценой (разные варианты)
            const priceEl =
              card.querySelector('.js-product-price') ||
              card.querySelector('.t-store__card__price-value') ||
              card.querySelector('.t776__price-value') ||
              card.querySelector('.t754__price-value') ||
              card.querySelector('.t762__price-value') ||
              card.querySelector('.js-store-price-wrapper');

            if (!priceEl) return;

            // Парсим цену
            const priceText = priceEl.textContent || '';
            const price = parseFloat(
              priceText.replace(/[^\d.,]/g, '').replace(',', '.')
            );

            if (!price || price <= 0) return;

            // Рассчитываем бонусы
            const bonus = this.calculateBonus(price);
            if (bonus <= 0) return;

            // Создаем плашку
            const badge = document.createElement('div');
            badge.className = 'lw-bonus-badge';
            badge.textContent = (
              this.badgeSettings.productBadgeText ||
              'Начислим до {bonusAmount} бонусов'
            ).replace('{bonusAmount}', Math.floor(bonus));

            // Вставляем ПОСЛЕ обертки цены (на новой строке)
            const priceWrapper =
              priceEl.closest('.js-store-price-wrapper') || priceEl;
            priceWrapper.parentNode.insertBefore(
              badge,
              priceWrapper.nextSibling
            );

            // Помечаем карточку
            card.dataset.lwBadgeAdded = 'true';
            addedCount++;
          } catch (error) {
            console.warn(
              'TildaAdapter: Ошибка добавления плашки на карточку:',
              error
            );
          }
        });
      });

      if (addedCount > 0) {
        console.log(`✅ TildaAdapter: Добавлено ${addedCount} плашек`);
      }
    }

    /**
     * Монтирование инлайн-виджета в структуру страницы
     * @param {function} renderCallback - Функция рендера из ядра, принимает контейнер
     */
    mountInlineWidget(renderCallback) {
      if (!renderCallback || typeof renderCallback !== 'function') {
        console.error('TildaAdapter: renderCallback должна быть функцией');
        return;
      }

      const promoWrapper = document.querySelector('.t-inputpromocode__wrapper');
      if (!promoWrapper) {
        console.warn(
          'TildaAdapter: Обертка промокода не найдена, виджет не может быть смонтирован'
        );
        return;
      }

      try {
        // Скрываем нативное поле промокода
        this.setPromocodeFieldVisibility(true);

        // Ищем или создаем контейнер для виджета
        let container = document.querySelector('.lw-inline-widget-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'lw-inline-widget-container';
          container.style.marginBottom = '15px'; // Отступ от других элементов

          // Вставляем ПЕРЕД полем промокода
          promoWrapper.parentNode.insertBefore(container, promoWrapper);
        }

        // Вызываем callback для рендера виджета
        renderCallback(container);

        console.log('✅ TildaAdapter: Инлайн-виджет смонтирован');
      } catch (error) {
        console.error('❌ TildaAdapter: Ошибка монтирования виджета:', error);
      }
    }

    /**
     * Очистка ресурсов адаптера
     * Вызывается при уничтожении виджета
     */
    destroy() {
      console.log('TildaAdapter: Начало очистки...');

      // Отключаем всех наблюдателей
      this.observers.forEach((observer) => {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn('TildaAdapter: Ошибка отключения наблюдателя:', error);
        }
      });
      this.observers.clear();

      // Удаляем event listeners
      this.eventListeners.forEach((handler, event) => {
        try {
          document.removeEventListener(event, handler);
        } catch (error) {
          console.warn('TildaAdapter: Ошибка удаления listener:', error);
        }
      });
      this.eventListeners.clear();

      // Очищаем таймеры
      if (this.cartUpdateTimer) {
        clearTimeout(this.cartUpdateTimer);
        this.cartUpdateTimer = null;
      }
      if (this.userInputTimer) {
        clearTimeout(this.userInputTimer);
        this.userInputTimer = null;
      }

      // Удаляем инжектированные стили
      const styles = document.getElementById('lw-badge-styles');
      if (styles) {
        styles.remove();
      }

      // Удаляем контейнер виджета
      const container = document.querySelector('.lw-inline-widget-container');
      if (container) {
        container.remove();
      }

      // Восстанавливаем поле промокода
      this.setPromocodeFieldVisibility(false);

      // Очищаем ссылки
      this.core = null;
      this.badgeSettings = null;
      this.calculateBonus = null;
      this.isInitialized = false;

      console.log('✅ TildaAdapter: Очистка завершена');
    }

    /**
     * Получить информацию о состоянии адаптера (для отладки)
     * @returns {object}
     */
    getDebugInfo() {
      return {
        isInitialized: this.isInitialized,
        isTildaPlatform: this.isTildaPlatform(),
        observersCount: this.observers.size,
        listenersCount: this.eventListeners.size,
        hasPromoField: !!document.querySelector('.t-inputpromocode'),
        hasCart: !!document.querySelector('.t706__cartwin'),
        cartTotal: this.getCartTotal(),
        contactInfo: this.getContactInfo(),
        badgesEnabled: this.badgeSettings?.productBadgeEnabled ?? false
      };
    }
  }

  // Экспорт в глобальную область видимости
  window.TildaAdapter = TildaAdapter;

  // Экспорт для CommonJS/ES6 (если используется)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TildaAdapter;
  }

  console.log('✅ TildaAdapter: Класс загружен и готов к использованию');
})();
