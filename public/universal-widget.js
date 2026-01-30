/**
 * @file: universal-widget.js
 * @description: Ядро Универсального Бонусного Виджета (Платформо-независимое)
 * @version: 3.0.0 (Alpha)
 */

(function () {
  'use strict';

  class LeadWidgetCore {
    constructor(config) {
      this.config = Object.assign(
        {
          apiUrl: 'https://bonus.example.com',
          projectId: null,
          debug: false,
          adapter: null // Экземпляр адаптера
        },
        config
      );

      this.state = {
        user: null, // { email, phone, balance, etc }
        cartTotal: 0,
        isInitialized: false,
        accessToken: null,
        _lastApiCall: 0
      };

      this.adapter = this.config.adapter;

      // Привязка методов
      this.onPlatformCartUpdate = this.onPlatformCartUpdate.bind(this);
      this.onUserDataUpdate = this.onUserDataUpdate.bind(this);
    }

    async init() {
      if (!this.adapter) {
        console.error('LeadWidget: Не передан адаптер платформы');
        return;
      }

      this.log('Инициализация ядра...');

      // Инициализация адаптера
      if (this.adapter.init) {
        this.adapter.init();
      }

      // Начальная проверка данных
      this.state.cartTotal = this.adapter.getCartTotal();
      const contactInfo = this.adapter.getContactInfo();
      if (contactInfo.email || contactInfo.phone) {
        this.onUserDataUpdate(contactInfo);
      }

      // Загрузка авторизации
      this.loadStorage();

      // Рендер UI
      this.renderUI();

      this.state.isInitialized = true;
    }

    /**
     * Вызывается адаптером при изменении корзины
     * @param {number} total
     */
    onPlatformCartUpdate(total) {
      if (this.state.cartTotal === total) return;
      this.log(`Корзина обновлена: ${this.state.cartTotal} -> ${total}`);
      this.state.cartTotal = total;
      this.updateUI();
    }

    /**
     * Вызывается адаптером при вводе данных пользователем
     * @param {object} data { email, phone }
     */
    onUserDataUpdate(data) {
      let changed = false;
      if (data.email && data.email !== this.state.user?.email) {
        this.state.user = { ...this.state.user, email: data.email };
        changed = true;
      }
      if (data.phone && data.phone !== this.state.user?.phone) {
        this.state.user = { ...this.state.user, phone: data.phone };
        changed = true;
      }

      if (changed) {
        this.log('Данные пользователя обновлены:', this.state.user);
        this.checkUserRegistration();
      }
    }

    async checkUserRegistration() {
      if (!this.state.user?.email && !this.state.user?.phone) return;

      try {
        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/users/check`,
          {
            method: 'POST',
            body: JSON.stringify(this.state.user)
          }
        );

        if (res && res.registered) {
          this.log('Пользователь зарегистрирован:', res);
          // Обработка статуса регистрации
        }
      } catch (e) {
        this.log('Ошибка проверки регистрации', e);
      }
    }

    /**
     * Общий метод API запросов с повторами и ограничением частоты
     * @param {string} url
     * @param {object} options
     * @param {number} retryCount
     */
    async makeApiRequest(url, options = {}, retryCount = 0) {
      // Простой ограничитель частоты (rate limiter)
      const now = Date.now();
      if (this.state._lastApiCall && now - this.state._lastApiCall < 300) {
        await new Promise((r) => setTimeout(r, 300));
      }
      this.state._lastApiCall = Date.now();

      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!res.ok) {
          if (res.status >= 500 && retryCount < 3) {
            await new Promise((r) =>
              setTimeout(r, 1000 * Math.pow(2, retryCount))
            );
            return this.makeApiRequest(url, options, retryCount + 1);
          }
          throw new Error(`Ошибка API: ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        if (retryCount < 3) {
          await new Promise((r) =>
            setTimeout(r, 1000 * Math.pow(2, retryCount))
          );
          return this.makeApiRequest(url, options, retryCount + 1);
        }
        throw err;
      }
    }

    async checkFirstPurchaseDiscount() {
      try {
        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/discounts/first-purchase`,
          {
            method: 'POST',
            body: JSON.stringify({ user: this.state.user })
          }
        );

        if (res && res.available) {
          this.state.firstPurchaseDiscount = res;
          this.log('🎁 Доступна скидка на первый заказ:', res);
          this.updateUI();
        }
      } catch (e) {
        this.log('Ошибка проверки скидки на первый заказ', e);
      }
    }

    async applyFirstPurchaseDiscount() {
      if (!this.state.firstPurchaseDiscount) return;

      const code = this.state.firstPurchaseDiscount.promocode;
      if (code && this.adapter.applyPromocode) {
        const success = await this.adapter.applyPromocode(code);
        if (success) {
          this.log('✅ Промокод первой покупки применен');
          alert('Скидка применена!'); // В реальности тут красивый тост
        }
      }
    }

    renderUI() {
      // Если адаптер предоставил точку монтирования - рендерим инлайн
      if (this.adapter && this.adapter.mountInlineWidget) {
        this.adapter.mountInlineWidget((container) => {
          this.renderInlineUI(container);
        });
        return;
      }

      // Иначе (или если настроено) - плавающая кнопка (Shadow DOM)
      if (document.getElementById('lead-widget-root')) return;

      // Создаем Shadow DOM хост
      const host = document.createElement('div');
      host.id = 'lead-widget-root';
      host.style.cssText = 'position: absolute; z-index: 2147483647;';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'open' });

      // Добавляем стили
      const style = document.createElement('style');
      style.textContent = `
        .lw-btn {
          position: fixed; bottom: 20px; right: 20px;
          width: 56px; height: 56px;
          background: #4F46E5; color: white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 24px;
          transition: transform 0.2s;
        }
        .lw-btn:hover { transform: scale(1.05); }
      `;
      shadow.appendChild(style);

      const btn = document.createElement('div');
      btn.className = 'lw-btn';
      btn.innerHTML = '🎁';
      btn.onclick = () => this.toggleModal();

      shadow.appendChild(btn);
      this.shadowRoot = shadow;
    }

    renderInlineUI(container) {
      if (!container) return;

      // Очищаем контейнер
      container.innerHTML = '';

      // Создаем структуру инлайн виджета (упрощенная копия из legacy)
      const widget = document.createElement('div');
      widget.className = 'bonus-widget-container';
      widget.style.cssText = `
            padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;
            background: white; margin-bottom: 12px; font-family: system-ui;
        `;

      // Секция скидки на первый заказ
      if (this.state.firstPurchaseDiscount?.available) {
        const discountDiv = document.createElement('div');
        discountDiv.style.cssText = `
                padding: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                border-radius: 8px; margin-bottom: 12px; text-align: center; color: white;
            `;
        discountDiv.innerHTML = `
                <p style="margin:0 0 8px 0;font-weight:600">🎉 Скидка на первый заказ ${this.state.firstPurchaseDiscount.discountPercent}%!</p>
                <button style="background:white;color:#059669;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:600">Применить</button>
            `;
        discountDiv.querySelector('button').onclick = () =>
          this.applyFirstPurchaseDiscount();
        widget.appendChild(discountDiv);
      }

      // Основной баланс
      const balanceDiv = document.createElement('div');
      balanceDiv.innerHTML = `
            <div style="font-size:14px;color:#6b7280;margin-bottom:8px">Ваш баланс: <span style="font-weight:600;color:#059669;font-size:16px">${this.state.user?.balance || 0}</span> бонусов</div>
        `;
      widget.appendChild(balanceDiv);

      container.appendChild(widget);
    }

    toggleModal() {
      alert(
        `Статус: ${this.state.isInitialized ? 'Готов' : 'Загрузка'}\nКорзина: ${this.state.cartTotal}\nПользователь: ${this.state.user?.email || 'Гость'}`
      );
    }

    updateUI() {
      // Перерисовываем UI при изменениях
      if (this.config.adapter && this.config.adapter.mountInlineWidget) {
        // Инлайн обновление
        // В реальности лучше обновлять конкретные узлы, а не все дерево
        // this.renderInlineUI(this.currentContainer);
      }
      this.log('UI обновлен, баланс:', this.state.cartTotal);
    }

    // Безопасное получение данных из localStorage
    safeGetStorage(key) {
      try {
        if (typeof Storage === 'undefined') return null;
        const value = localStorage.getItem(key);
        if (!value) return null;
        if (value.length > 5000) return null; // Защита от переполнения
        if (/<script|javascript:|data:/i.test(value)) return null; // Защита от XSS
        return value;
      } catch (error) {
        this.log('Ошибка доступа к Storage', error);
        return null;
      }
    }

    // Безопасная запись в localStorage
    safeSetStorage(key, value) {
      try {
        if (typeof Storage === 'undefined') return false;
        if (typeof value !== 'string') value = String(value);
        if (value.length > 5000) return false;
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        this.log('Ошибка записи в Storage', error);
        return false;
      }
    }

    // Валидация email
    validateEmail(email) {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
    }

    // Валидация телефона
    validatePhone(phone) {
      if (!phone || typeof phone !== 'string') return false;
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    // Загрузка настроек виджета
    async loadWidgetSettingsOnInit() {
      try {
        this.log('🔄 Загрузка настроек виджета...');
        // Пытаемся получить кешированные настройки
        const cached = this.safeGetStorage('lw_settings_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            // 5 минут кеш
            this.applySettings(parsed.data);
            return;
          }
        }

        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/settings`
        );
        if (res) {
          this.applySettings(res);
          this.safeSetStorage(
            'lw_settings_cache',
            JSON.stringify({
              timestamp: Date.now(),
              data: res
            })
          );
        }
      } catch (e) {
        this.log('Ошибка загрузки настроек', e);
      }
    }

    applySettings(settings) {
      this.log('✅ Настройки применены:', settings);
      this.state.widgetSettings = settings.widgetSettings || {};
      this.state.operationMode = settings.operationMode || 'WITH_BOT';

      // Тут будет инъекция CSS переменных
      if (settings.widgetSettings) {
        this.injectCssVariables(settings.widgetSettings);
        // Инициализация плашек, если включены
        if (this.config.adapter && this.config.adapter.initProductBadges) {
          this.config.adapter.initProductBadges(
            settings.widgetSettings,
            (price) => this.calculateBonusAmount(price)
          );
        }
      }
    }

    calculateBonusAmount(price) {
      const settings = this.state.widgetSettings;
      const percent = settings.productBadgeBonusPercent || 10;
      return Math.round(price * (percent / 100));
    }

    injectCssVariables(settings) {
      // TODO: Создать style элемент с CSS переменными
    }

    loadStorage() {
      try {
        const data = this.safeGetStorage('lw_user');
        if (data) this.state.user = JSON.parse(data);
      } catch (e) {
        /* игнорируем */
      }
    }

    log(...args) {
      if (this.config.debug) console.log('[LeadWidget]', ...args);
    }
  }

  // Экспорт
  window.LeadWidgetCore = LeadWidgetCore;
})();
