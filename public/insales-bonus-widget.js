/**
 * @file: insales-bonus-widget.js
 * @description: Виджет бонусной системы для InSales магазинов
 * @project: SaaS Bonus System
 * @version: 1.0.0
 * @author: AI Assistant + User
 */

(function () {
  'use strict';

  // Проверяем что настройки загружены
  if (!window.InSalesBonusWidget || !window.InSalesBonusWidget.settings) {
    console.error('[InSales Bonus Widget] Settings not loaded');
    return;
  }

  const widget = window.InSalesBonusWidget;
  const settings = widget.settings;
  const API_BASE_URL = widget.API_BASE_URL;

  // Состояние виджета
  const state = {
    userEmail: null,
    userPhone: null,
    bonusBalance: 0,
    appliedBonuses: 0,
    cartTotal: 0,
    initialized: false,
    widgetMounted: false
  };

  // Утилиты
  const utils = {
    log: function () {
      if (settings.debug) {
        console.log('[InSales Bonus Widget]', ...arguments);
      }
    },

    logError: function (message, error) {
      console.error('[InSales Bonus Widget]', message, error);
    },

    validateEmail: function (email) {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
    },

    validatePhone: function (phone) {
      if (!phone || typeof phone !== 'string') return false;
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    },

    formatBonus: function (amount) {
      return Math.floor(amount)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    debounce: function (func, wait) {
      let timeout;
      return function executedFunction() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          func.apply(context, args);
        }, wait);
      };
    },

    safeGetStorage: function (key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        utils.logError('Storage access error', error);
        return null;
      }
    },

    safeSetStorage: function (key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        utils.logError('Storage write error', error);
        return false;
      }
    }
  };

  // API запросы
  const api = {
    getBalance: async function (email, phone) {
      try {
        const params = new URLSearchParams();
        if (email) params.append('email', email);
        if (phone) params.append('phone', phone);

        const response = await fetch(
          `${API_BASE_URL}/api/insales/balance/${settings.projectId}?${params}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        utils.logError('Error fetching balance', error);
        return { success: false, balance: 0, error: error.message };
      }
    },

    applyBonuses: async function (
      email,
      phone,
      bonusAmount,
      orderId,
      orderTotal
    ) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/insales/apply-bonuses/${settings.projectId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email,
              phone,
              bonusAmount,
              orderId,
              orderTotal
            })
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        utils.logError('Error applying bonuses', error);
        return { success: false, error: error.message };
      }
    }
  };

  // UI компоненты
  const ui = {
    createWidget: function () {
      if (state.widgetMounted) {
        utils.log('Widget already mounted');
        return;
      }

      const widgetHtml = `
        <div id="insales-bonus-widget" class="insales-bonus-widget">
          <div class="insales-bonus-widget__header">
            <div class="insales-bonus-widget__icon">🎁</div>
            <div class="insales-bonus-widget__title">Бонусный счет</div>
          </div>
          <div class="insales-bonus-widget__content">
            <div class="insales-bonus-widget__balance">
              <span class="insales-bonus-widget__balance-amount" id="insales-bonus-balance">0</span>
              <span class="insales-bonus-widget__balance-currency">₽</span>
            </div>
            <div class="insales-bonus-widget__info" id="insales-bonus-info">
              Войдите, чтобы увидеть баланс
            </div>
          </div>
        </div>
      `;

      // Находим место для вставки виджета
      const targetElement =
        document.querySelector('.cart-preview') ||
        document.querySelector('.cart') ||
        document.querySelector('.header');

      if (targetElement) {
        const widgetContainer = document.createElement('div');
        widgetContainer.innerHTML = widgetHtml;
        targetElement.appendChild(widgetContainer.firstElementChild);
        state.widgetMounted = true;
        utils.log('Widget mounted successfully');
      } else {
        utils.log('Target element for widget not found');
      }
    },

    updateBalance: function (balance) {
      const balanceElement = document.getElementById('insales-bonus-balance');
      const infoElement = document.getElementById('insales-bonus-info');

      if (balanceElement) {
        balanceElement.textContent = utils.formatBonus(balance);
      }

      if (infoElement) {
        if (balance > 0) {
          infoElement.textContent = `Доступно для списания: ${Math.floor((state.cartTotal * settings.maxBonusSpend) / 100)} ₽`;
        } else {
          infoElement.textContent = 'Совершайте покупки и получайте бонусы';
        }
      }
    },

    createCheckoutForm: function () {
      // Находим форму оформления заказа
      const checkoutForm =
        document.querySelector('form[action*="checkout"]') ||
        document.querySelector('.checkout-form') ||
        document.querySelector('#order_form');

      if (!checkoutForm) {
        utils.log('Checkout form not found');
        return;
      }

      // Проверяем, не добавлена ли уже форма бонусов
      if (document.getElementById('insales-bonus-form')) {
        return;
      }

      const bonusFormHtml = `
        <div id="insales-bonus-form" class="insales-bonus-form">
          <div class="insales-bonus-form__header">
            <h3>Оплата бонусами</h3>
            <p>Доступно: <span id="insales-available-bonus">${utils.formatBonus(state.bonusBalance)}</span> ₽</p>
          </div>
          <div class="insales-bonus-form__content">
            <div class="insales-bonus-form__input-group">
              <label for="insales-bonus-input">Списать бонусов:</label>
              <input 
                type="number" 
                id="insales-bonus-input" 
                class="insales-bonus-form__input"
                min="0" 
                max="${Math.min(state.bonusBalance, Math.floor((state.cartTotal * settings.maxBonusSpend) / 100))}"
                value="0"
                placeholder="0"
              />
              <button type="button" id="insales-bonus-apply" class="insales-bonus-form__button">
                Применить
              </button>
            </div>
            <div class="insales-bonus-form__info">
              Максимум можно списать: ${Math.floor((state.cartTotal * settings.maxBonusSpend) / 100)} ₽ (${settings.maxBonusSpend}% от суммы заказа)
            </div>
            <div id="insales-bonus-applied" class="insales-bonus-form__applied" style="display: none;">
              ✓ Применено бонусов: <span id="insales-bonus-applied-amount">0</span> ₽
            </div>
          </div>
        </div>
      `;

      // Вставляем форму перед кнопкой оформления заказа
      const submitButton =
        checkoutForm.querySelector('button[type="submit"]') ||
        checkoutForm.querySelector('.checkout-button');

      if (submitButton) {
        const bonusFormContainer = document.createElement('div');
        bonusFormContainer.innerHTML = bonusFormHtml;
        submitButton.parentNode.insertBefore(
          bonusFormContainer.firstElementChild,
          submitButton
        );

        // Добавляем обработчики
        ui.attachCheckoutHandlers();
        utils.log('Checkout bonus form created');
      }
    },

    attachCheckoutHandlers: function () {
      const applyButton = document.getElementById('insales-bonus-apply');
      const bonusInput = document.getElementById('insales-bonus-input');

      if (applyButton && bonusInput) {
        applyButton.addEventListener('click', function () {
          const bonusAmount = parseFloat(bonusInput.value) || 0;
          const maxBonus = Math.min(
            state.bonusBalance,
            Math.floor((state.cartTotal * settings.maxBonusSpend) / 100)
          );

          if (bonusAmount <= 0) {
            alert('Введите сумму бонусов для списания');
            return;
          }

          if (bonusAmount > maxBonus) {
            alert(`Максимум можно списать ${maxBonus} ₽`);
            return;
          }

          // Применяем бонусы
          state.appliedBonuses = bonusAmount;
          utils.safeSetStorage('insales_applied_bonuses', bonusAmount);

          // Обновляем UI
          const appliedElement = document.getElementById(
            'insales-bonus-applied'
          );
          const appliedAmountElement = document.getElementById(
            'insales-bonus-applied-amount'
          );

          if (appliedElement && appliedAmountElement) {
            appliedAmountElement.textContent = utils.formatBonus(bonusAmount);
            appliedElement.style.display = 'block';
          }

          // Обновляем итоговую сумму заказа
          ui.updateOrderTotal();

          utils.log('Bonuses applied', bonusAmount);
        });
      }
    },

    updateOrderTotal: function () {
      // Находим элемент с итоговой суммой
      const totalElement =
        document.querySelector('.cart-total') ||
        document.querySelector('.order-total') ||
        document.querySelector('[data-cart-total]');

      if (totalElement && state.appliedBonuses > 0) {
        const newTotal = state.cartTotal - state.appliedBonuses;
        totalElement.textContent = `${utils.formatBonus(newTotal)} ₽`;
        utils.log('Order total updated', newTotal);
      }
    },

    addProductBadges: function () {
      if (!settings.showProductBadges) {
        return;
      }

      // Находим все карточки товаров
      const productCards =
        document.querySelectorAll('.product-card') ||
        document.querySelectorAll('.product') ||
        document.querySelectorAll('[data-product-id]');

      productCards.forEach(function (card) {
        // Проверяем, не добавлен ли уже бейдж
        if (card.querySelector('.insales-bonus-badge')) {
          return;
        }

        // Находим цену товара
        const priceElement =
          card.querySelector('.product-price') ||
          card.querySelector('.price') ||
          card.querySelector('[data-product-price]');

        if (priceElement) {
          const priceText = priceElement.textContent.replace(/[^\d]/g, '');
          const price = parseFloat(priceText);

          if (price > 0) {
            const bonusAmount = Math.floor(
              (price * settings.bonusPercent) / 100
            );

            const badgeHtml = `
              <div class="insales-bonus-badge">
                +${utils.formatBonus(bonusAmount)} ₽ бонусов
              </div>
            `;

            const badgeContainer = document.createElement('div');
            badgeContainer.innerHTML = badgeHtml;
            priceElement.appendChild(badgeContainer.firstElementChild);
          }
        }
      });

      utils.log('Product badges added');
    }
  };

  // Основная логика
  const core = {
    init: function () {
      utils.log('Initializing widget', settings);

      // Загружаем данные пользователя из localStorage
      core.loadUserData();

      // Создаем виджет
      ui.createWidget();

      // Если пользователь авторизован, загружаем баланс
      if (state.userEmail || state.userPhone) {
        core.loadBalance();
      }

      // Отслеживаем авторизацию
      core.observeAuth();

      // Отслеживаем корзину
      core.observeCart();

      // Добавляем бейджи на товары
      ui.addProductBadges();

      // Отслеживаем переход на страницу оформления заказа
      core.observeCheckout();

      state.initialized = true;
      utils.log('Widget initialized');
    },

    loadUserData: function () {
      const savedEmail = utils.safeGetStorage('insales_user_email');
      const savedPhone = utils.safeGetStorage('insales_user_phone');

      if (savedEmail && utils.validateEmail(savedEmail)) {
        state.userEmail = savedEmail;
        utils.log('Loaded email from storage');
      }

      if (savedPhone && utils.validatePhone(savedPhone)) {
        state.userPhone = savedPhone;
        utils.log('Loaded phone from storage');
      }

      // Загружаем примененные бонусы
      const savedAppliedBonuses = utils.safeGetStorage(
        'insales_applied_bonuses'
      );
      if (savedAppliedBonuses) {
        state.appliedBonuses = parseFloat(savedAppliedBonuses) || 0;
      }
    },

    loadBalance: utils.debounce(async function () {
      if (!state.userEmail && !state.userPhone) {
        return;
      }

      utils.log('Loading balance...');

      const result = await api.getBalance(state.userEmail, state.userPhone);

      if (result.success) {
        state.bonusBalance = result.balance;
        ui.updateBalance(result.balance);
        utils.log('Balance loaded', result.balance);
      } else {
        utils.logError('Failed to load balance', result.error);
      }
    }, 500),

    observeAuth: function () {
      // Отслеживаем изменения в полях email/телефон
      const emailInputs = document.querySelectorAll('input[type="email"]');
      const phoneInputs = document.querySelectorAll('input[type="tel"]');

      emailInputs.forEach(function (input) {
        input.addEventListener('blur', function () {
          const email = input.value.trim();
          if (utils.validateEmail(email) && email !== state.userEmail) {
            state.userEmail = email;
            utils.safeSetStorage('insales_user_email', email);
            core.loadBalance();
            utils.log('Email updated', email);
          }
        });
      });

      phoneInputs.forEach(function (input) {
        input.addEventListener('blur', function () {
          const phone = input.value.trim();
          if (utils.validatePhone(phone) && phone !== state.userPhone) {
            state.userPhone = phone;
            utils.safeSetStorage('insales_user_phone', phone);
            core.loadBalance();
            utils.log('Phone updated', phone);
          }
        });
      });

      // Проверяем авторизацию через InSales API
      if (typeof InSales !== 'undefined' && InSales.client) {
        const client = InSales.client;
        if (client.email) {
          state.userEmail = client.email;
          utils.safeSetStorage('insales_user_email', client.email);
          core.loadBalance();
        }
        if (client.phone) {
          state.userPhone = client.phone;
          utils.safeSetStorage('insales_user_phone', client.phone);
          core.loadBalance();
        }
      }
    },

    observeCart: function () {
      // Получаем текущую сумму корзины
      core.updateCartTotal();

      // Отслеживаем изменения в корзине через MutationObserver
      const cartObserver = new MutationObserver(function () {
        core.updateCartTotal();
      });

      const cartElement =
        document.querySelector('.cart') ||
        document.querySelector('.cart-preview') ||
        document.querySelector('[data-cart]');

      if (cartElement) {
        cartObserver.observe(cartElement, {
          childList: true,
          subtree: true
        });
      }

      // Также отслеживаем через InSales Cart API
      if (typeof InSales !== 'undefined' && InSales.Cart) {
        InSales.Cart.on('update', function () {
          core.updateCartTotal();
        });
      }
    },

    updateCartTotal: function () {
      let total = 0;

      // Пытаемся получить сумму из InSales Cart API
      if (
        typeof InSales !== 'undefined' &&
        InSales.Cart &&
        InSales.Cart.order
      ) {
        total = parseFloat(InSales.Cart.order.total_price) || 0;
      } else {
        // Иначе ищем в DOM
        const totalElement =
          document.querySelector('.cart-total') ||
          document.querySelector('.order-total') ||
          document.querySelector('[data-cart-total]');

        if (totalElement) {
          const totalText = totalElement.textContent.replace(/[^\d]/g, '');
          total = parseFloat(totalText) || 0;
        }
      }

      if (total !== state.cartTotal) {
        state.cartTotal = total;
        utils.log('Cart total updated', total);

        // Обновляем информацию в виджете
        if (state.bonusBalance > 0) {
          ui.updateBalance(state.bonusBalance);
        }
      }
    },

    observeCheckout: function () {
      // Проверяем, находимся ли мы на странице оформления заказа
      const isCheckoutPage =
        window.location.pathname.includes('checkout') ||
        window.location.pathname.includes('order') ||
        document.querySelector('.checkout-form') ||
        document.querySelector('#order_form');

      if (isCheckoutPage && state.bonusBalance > 0) {
        // Создаем форму для применения бонусов
        ui.createCheckoutForm();
      }

      // Отслеживаем переходы на страницу оформления
      const observer = new MutationObserver(function () {
        const checkoutForm =
          document.querySelector('.checkout-form') ||
          document.querySelector('#order_form');

        if (
          checkoutForm &&
          state.bonusBalance > 0 &&
          !document.getElementById('insales-bonus-form')
        ) {
          ui.createCheckoutForm();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };

  // Инициализация
  widget.init = core.init;

  // Публичные методы
  widget.getBalance = core.loadBalance;
  widget.updateCart = core.updateCartTotal;

  utils.log('Widget script loaded');
})();
