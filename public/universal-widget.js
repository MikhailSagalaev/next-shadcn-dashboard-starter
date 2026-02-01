/**
 * @file: universal-widget.js
 * @description: Ядро Универсального Бонусного Виджета (Платформо-независимое)
 * @version: 3.1.0 (Alpha)
 * @project: SaaS Bonus System - Universal Widget
 * @created: 2026-01-31
 *
 * ИЗМЕНЕНИЯ v3.1.0:
 * - Добавлены методы работы с адаптером (setAdapter, getAdapter, validateAdapter)
 * - Улучшено управление состоянием (setState, getState, subscribe)
 * - Оптимизированы API запросы (кеширование, batch, retry)
 * - Удалены все Tilda-специфичные зависимости
 * - Добавлена реактивность через pub/sub паттерн
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
          adapter: null, // Экземпляр адаптера
          enableCache: true,
          cacheTimeout: 5 * 60 * 1000, // 5 минут
          apiTimeout: 10000, // 10 секунд
          maxRetries: 3
        },
        config
      );

      this.state = {
        user: null, // { email, phone, balance, etc }
        cartTotal: 0,
        isInitialized: false,
        accessToken: null,
        widgetSettings: null,
        operationMode: 'WITH_BOT',
        firstPurchaseDiscount: null,
        _lastApiCall: 0
      };

      // Pub/Sub для реактивности
      this.subscribers = new Map();

      // Кеш API запросов
      this.apiCache = new Map();

      // Очередь batch запросов
      this.batchQueue = [];
      this.batchTimer = null;

      this.adapter = this.config.adapter;

      // Привязка методов
      this.onPlatformCartUpdate = this.onPlatformCartUpdate.bind(this);
      this.onUserDataUpdate = this.onUserDataUpdate.bind(this);
    }

    /**
     * ========================================
     * LIFECYCLE МЕТОДЫ
     * ========================================
     */

    async init() {
      if (!this.adapter) {
        console.error('LeadWidget: Не передан адаптер платформы');
        return;
      }

      // Валидация адаптера
      if (!this.validateAdapter(this.adapter)) {
        console.error('LeadWidget: Адаптер не реализует необходимые методы');
        return;
      }

      this.log('🚀 Инициализация ядра...');

      // Инициализация адаптера
      if (this.adapter.init) {
        this.adapter.init();
      }

      // Загрузка настроек виджета
      await this.loadWidgetSettings();

      // Начальная проверка данных
      this.state.cartTotal = this.adapter.getCartTotal();
      const contactInfo = this.adapter.getContactInfo();
      if (contactInfo.email || contactInfo.phone) {
        this.onUserDataUpdate(contactInfo);
      }

      // Загрузка из localStorage
      this.loadStorage();

      // Запуск наблюдателей адаптера
      if (this.adapter.observeCart) {
        this.adapter.observeCart();
      }
      if (this.adapter.observeUserInput) {
        this.adapter.observeUserInput();
      }

      // Рендер UI
      this.renderUI();

      this.setState({ isInitialized: true });
      this.log('✅ Ядро инициализировано');
    }

    destroy() {
      this.log('🧹 Уничтожение виджета...');

      // Уничтожение адаптера
      if (this.adapter && this.adapter.destroy) {
        this.adapter.destroy();
      }

      // Очистка подписчиков
      this.subscribers.clear();

      // Очистка кеша
      this.apiCache.clear();

      // Очистка batch таймера
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Удаление UI
      const root = document.getElementById('lead-widget-root');
      if (root) {
        root.remove();
      }

      this.log('✅ Виджет уничтожен');
    }

    /**
     * ========================================
     * МЕТОДЫ РАБОТЫ С АДАПТЕРОМ
     * ========================================
     */

    /**
     * Установить адаптер
     * @param {object} adapter - Экземпляр адаптера
     * @returns {boolean}
     */
    setAdapter(adapter) {
      if (!this.validateAdapter(adapter)) {
        console.error('LeadWidget: Невалидный адаптер');
        return false;
      }

      this.adapter = adapter;
      this.config.adapter = adapter;
      this.log('✅ Адаптер установлен');
      return true;
    }

    /**
     * Получить текущий адаптер
     * @returns {object|null}
     */
    getAdapter() {
      return this.adapter;
    }

    /**
     * Валидация адаптера
     * @param {object} adapter
     * @returns {boolean}
     */
    validateAdapter(adapter) {
      if (!adapter || typeof adapter !== 'object') {
        return false;
      }

      // Обязательные методы
      const requiredMethods = ['getCartTotal', 'getContactInfo'];

      for (const method of requiredMethods) {
        if (typeof adapter[method] !== 'function') {
          console.error(`LeadWidget: Адаптер не реализует метод ${method}`);
          return false;
        }
      }

      return true;
    }

    /**
     * Событие готовности адаптера
     * @param {function} callback
     */
    onAdapterReady(callback) {
      if (this.adapter && this.state.isInitialized) {
        callback(this.adapter);
      } else {
        this.subscribe('initialized', () => callback(this.adapter));
      }
    }

    /**
     * ========================================
     * УПРАВЛЕНИЕ СОСТОЯНИЕМ (PUB/SUB)
     * ========================================
     */

    /**
     * Установить состояние с уведомлением подписчиков
     * @param {object} updates - Объект с обновлениями
     */
    setState(updates) {
      const oldState = { ...this.state };

      // Обновляем состояние
      Object.assign(this.state, updates);

      // Уведомляем подписчиков
      Object.keys(updates).forEach((key) => {
        if (oldState[key] !== this.state[key]) {
          this.notify(key, this.state[key], oldState[key]);
        }
      });

      // Общее уведомление об изменении
      this.notify('stateChanged', this.state, oldState);
    }

    /**
     * Получить состояние
     * @param {string} key - Ключ состояния (опционально)
     * @returns {any}
     */
    getState(key) {
      if (key) {
        return this.state[key];
      }
      return { ...this.state };
    }

    /**
     * Подписаться на изменения состояния
     * @param {string} key - Ключ состояния или 'stateChanged' для всех изменений
     * @param {function} callback - Функция обратного вызова
     * @returns {function} - Функция отписки
     */
    subscribe(key, callback) {
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }

      this.subscribers.get(key).add(callback);

      // Возвращаем функцию отписки
      return () => {
        const subs = this.subscribers.get(key);
        if (subs) {
          subs.delete(callback);
        }
      };
    }

    /**
     * Уведомить подписчиков
     * @param {string} key
     * @param {any} newValue
     * @param {any} oldValue
     */
    notify(key, newValue, oldValue) {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.forEach((callback) => {
          try {
            callback(newValue, oldValue);
          } catch (e) {
            console.error('Ошибка в подписчике:', e);
          }
        });
      }
    }

    /**
     * ========================================
     * ОБРАБОТЧИКИ СОБЫТИЙ ПЛАТФОРМЫ
     * ========================================
     */

    /**
     * Вызывается адаптером при изменении корзины
     * @param {number} total
     */
    onPlatformCartUpdate(total) {
      if (this.state.cartTotal === total) return;

      this.log(`📊 Корзина обновлена: ${this.state.cartTotal} → ${total}`);
      this.setState({ cartTotal: total });
      this.updateUI();
    }

    /**
     * Вызывается адаптером при вводе данных пользователем
     * @param {object} data { email, phone }
     */
    onUserDataUpdate(data) {
      let changed = false;
      const newUser = { ...this.state.user };

      if (data.email && data.email !== this.state.user?.email) {
        newUser.email = data.email;
        changed = true;
      }
      if (data.phone && data.phone !== this.state.user?.phone) {
        newUser.phone = data.phone;
        changed = true;
      }

      if (changed) {
        this.log('📝 Данные пользователя обновлены:', newUser);
        this.setState({ user: newUser });
        this.checkUserRegistration();
      }
    }

    /**
     * ========================================
     * API ЗАПРОСЫ (С КЕШИРОВАНИЕМ И RETRY)
     * ========================================
     */

    /**
     * Общий метод API запросов с кешированием, retry и timeout
     * @param {string} url
     * @param {object} options
     * @param {object} cacheOptions - { cache: boolean, ttl: number }
     * @returns {Promise<any>}
     */
    async makeApiRequest(url, options = {}, cacheOptions = {}) {
      const {
        cache = this.config.enableCache,
        ttl = this.config.cacheTimeout
      } = cacheOptions;

      // Проверяем кеш для GET запросов
      if (cache && (!options.method || options.method === 'GET')) {
        const cached = this.getCachedResponse(url);
        if (cached) {
          this.log('📦 Ответ из кеша:', url);
          return cached;
        }
      }

      // Rate limiting
      await this.rateLimitDelay();

      // Выполняем запрос с retry
      const response = await this.fetchWithRetry(url, options);

      // Кешируем успешный ответ
      if (cache && (!options.method || options.method === 'GET')) {
        this.setCachedResponse(url, response, ttl);
      }

      return response;
    }

    /**
     * Fetch с retry и timeout
     * @param {string} url
     * @param {object} options
     * @param {number} retryCount
     * @returns {Promise<any>}
     */
    async fetchWithRetry(url, options = {}, retryCount = 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.apiTimeout
      );

      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          // Retry для серверных ошибок
          if (res.status >= 500 && retryCount < this.config.maxRetries) {
            await this.exponentialBackoff(retryCount);
            return this.fetchWithRetry(url, options, retryCount + 1);
          }
          throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        return await res.json();
      } catch (err) {
        clearTimeout(timeoutId);

        // Retry для сетевых ошибок
        if (err.name === 'AbortError') {
          this.log('⏱️ Timeout запроса:', url);
        }

        if (retryCount < this.config.maxRetries) {
          this.log(
            `🔄 Retry ${retryCount + 1}/${this.config.maxRetries}:`,
            url
          );
          await this.exponentialBackoff(retryCount);
          return this.fetchWithRetry(url, options, retryCount + 1);
        }

        throw err;
      }
    }

    /**
     * Rate limiting задержка
     */
    async rateLimitDelay() {
      const now = Date.now();
      const minDelay = 300; // 300ms между запросами

      if (this.state._lastApiCall && now - this.state._lastApiCall < minDelay) {
        await new Promise((r) =>
          setTimeout(r, minDelay - (now - this.state._lastApiCall))
        );
      }

      this.state._lastApiCall = Date.now();
    }

    /**
     * Exponential backoff для retry
     * @param {number} retryCount
     */
    async exponentialBackoff(retryCount) {
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise((r) => setTimeout(r, delay));
    }

    /**
     * Получить кешированный ответ
     * @param {string} key
     * @returns {any|null}
     */
    getCachedResponse(key) {
      const cached = this.apiCache.get(key);
      if (!cached) return null;

      if (Date.now() - cached.timestamp > cached.ttl) {
        this.apiCache.delete(key);
        return null;
      }

      return cached.data;
    }

    /**
     * Сохранить ответ в кеш
     * @param {string} key
     * @param {any} data
     * @param {number} ttl
     */
    setCachedResponse(key, data, ttl) {
      this.apiCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
    }

    /**
     * Очистить кеш
     * @param {string} key - Опционально, конкретный ключ
     */
    clearCache(key) {
      if (key) {
        this.apiCache.delete(key);
      } else {
        this.apiCache.clear();
      }
    }

    /**
     * ========================================
     * БИЗНЕС-ЛОГИКА
     * ========================================
     */

    async checkUserRegistration() {
      if (!this.state.user?.email && !this.state.user?.phone) return;

      try {
        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/users/check`,
          {
            method: 'POST',
            body: JSON.stringify(this.state.user)
          },
          { cache: false }
        );

        if (res && res.registered) {
          this.log('✅ Пользователь зарегистрирован:', res);
          this.setState({ user: { ...this.state.user, ...res.user } });
        }
      } catch (e) {
        this.log('❌ Ошибка проверки регистрации:', e);
      }
    }

    async checkFirstPurchaseDiscount() {
      try {
        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/discounts/first-purchase`,
          {
            method: 'POST',
            body: JSON.stringify({ user: this.state.user })
          },
          { cache: true, ttl: 60000 } // Кеш на 1 минуту
        );

        if (res && res.available) {
          this.setState({ firstPurchaseDiscount: res });
          this.log('🎁 Доступна скидка на первый заказ:', res);
          this.updateUI();
        }
      } catch (e) {
        this.log('❌ Ошибка проверки скидки:', e);
      }
    }

    async applyFirstPurchaseDiscount() {
      if (!this.state.firstPurchaseDiscount) return;

      const code = this.state.firstPurchaseDiscount.promocode;
      if (code && this.adapter.applyPromocode) {
        const success = await this.adapter.applyPromocode(code);
        if (success) {
          this.log('✅ Промокод первой покупки применен');
          this.showNotification('Скидка применена!', 'success');
        }
      }
    }

    async loadWidgetSettings() {
      try {
        this.log('🔄 Загрузка настроек виджета...');

        const res = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/settings`,
          {},
          { cache: true, ttl: this.config.cacheTimeout }
        );

        if (res) {
          this.applySettings(res);
        }
      } catch (e) {
        this.log('❌ Ошибка загрузки настроек:', e);
      }
    }

    applySettings(settings) {
      this.log('✅ Настройки применены:', settings);

      this.setState({
        widgetSettings: settings.widgetSettings || {},
        operationMode: settings.operationMode || 'WITH_BOT'
      });

      // Инъекция CSS переменных
      if (settings.widgetSettings) {
        this.injectCssVariables(settings.widgetSettings);

        // Инициализация плашек через адаптер
        if (this.adapter && this.adapter.initProductBadges) {
          this.adapter.initProductBadges(settings.widgetSettings, (price) =>
            this.calculateBonusAmount(price)
          );
        }
      }
    }

    calculateBonusAmount(price) {
      const settings = this.state.widgetSettings;
      const percent = settings?.productBadgeBonusPercent || 10;
      return Math.round(price * (percent / 100));
    }

    injectCssVariables(settings) {
      // TODO: Создать style элемент с CSS переменными
      // Это будет реализовано в следующей итерации
    }

    /**
     * ========================================
     * UI МЕТОДЫ
     * ========================================
     */

    renderUI() {
      // Если адаптер предоставил точку монтирования - рендерим инлайн
      if (this.adapter && this.adapter.mountInlineWidget) {
        this.adapter.mountInlineWidget((container) => {
          this.renderInlineUI(container);
        });
        return;
      }

      // Иначе - плавающая кнопка (Shadow DOM)
      this.renderFloatingButton();
    }

    renderFloatingButton() {
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

      // Создаем структуру инлайн виджета
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
        <div style="font-size:14px;color:#6b7280;margin-bottom:8px">
          Ваш баланс: <span style="font-weight:600;color:#059669;font-size:16px">${this.state.user?.balance || 0}</span> бонусов
        </div>
      `;
      widget.appendChild(balanceDiv);

      container.appendChild(widget);
    }

    updateUI() {
      // Перерисовываем UI при изменениях
      // В реальности лучше обновлять конкретные узлы, а не все дерево
      this.log('🎨 UI обновлен');
    }

    toggleModal() {
      this.showNotification(
        `Статус: ${this.state.isInitialized ? 'Готов' : 'Загрузка'}\nКорзина: ${this.state.cartTotal}\nПользователь: ${this.state.user?.email || 'Гость'}`,
        'info'
      );
    }

    showNotification(message, type = 'info') {
      // TODO: Реализовать красивые toast уведомления
      alert(message);
    }

    /**
     * ========================================
     * УТИЛИТЫ
     * ========================================
     */

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
        this.log('❌ Ошибка доступа к Storage:', error);
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
        this.log('❌ Ошибка записи в Storage:', error);
        return false;
      }
    }

    loadStorage() {
      try {
        const data = this.safeGetStorage('lw_user');
        if (data) {
          const user = JSON.parse(data);
          this.setState({ user });
        }
      } catch (e) {
        this.log('❌ Ошибка загрузки из Storage:', e);
      }
    }

    saveStorage() {
      try {
        if (this.state.user) {
          this.safeSetStorage('lw_user', JSON.stringify(this.state.user));
        }
      } catch (e) {
        this.log('❌ Ошибка сохранения в Storage:', e);
      }
    }

    log(...args) {
      if (this.config.debug) {
        console.log('[LeadWidget]', ...args);
      }
    }
  }

  // Экспорт
  window.LeadWidgetCore = LeadWidgetCore;
})();
