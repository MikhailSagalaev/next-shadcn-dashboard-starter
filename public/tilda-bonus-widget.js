/**
 * @file: tilda-bonus-widget.js
 * @description: Готовый виджет для интеграции бонусной системы с Tilda
 * @project: SaaS Bonus System
 * @version: 2.9.12
 * @author: AI Assistant + User
 * @architecture: Modular design with memory management, rate limiting, and graceful degradation
 */

(function () {
  'use strict';

  // Безопасная инициализация - проверяем что DOM готов
  function safeInit() {
    if (typeof document === 'undefined' || !document.body) {
      // DOM еще не готов, ждем
      if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', initWidget);
      }
      return;
    }
    initWidget();
  }

  function initWidget() {
    // Теперь DOM точно готов - можно безопасно работать с элементами
    console.log('🎯 TildaBonusWidget: DOM готов, виджет готов к инициализации');
  }

  // Глобальный объект для виджета
  window.TildaBonusWidget = {
    PROMO_HIDDEN_CLASS: 'bonus-promocode-hidden',
    // Конфигурация по умолчанию
    config: {
      projectId: null,
      apiUrl: 'https://bonus.example.com',
      bonusToRuble: 1,
      minOrderAmount: 100,
      debug: true, // ВКЛЮЧЕНО для отладки
      debounceMs: 400,
      maxRetries: 3,
      timeout: 10000,
      enableLogging: true, // ВКЛЮЧЕНО для отладки
      rateLimitMs: 1000, // Минимальный интервал между API запросами
      maxConcurrentRequests: 2 // Максимум одновременных запросов
    },

    capturePromoWrapperStyles: function (wrapper) {
      if (!wrapper || this.state.originalPromoStyles) {
        return;
      }
      try {
        const inlineStyle = wrapper.getAttribute('style') || '';
        const computedStyle = window.getComputedStyle(wrapper);
        this.state.originalPromoStyles = {
          inline: inlineStyle,
          display: computedStyle.display,
          width: computedStyle.width,
          position: computedStyle.position,
          margin: computedStyle.margin,
          padding: computedStyle.padding,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          boxSizing: computedStyle.boxSizing
        };
        this.log('✅ Сохранены оригинальные стили поля промокода Tilda');
      } catch (error) {
        this.log('⚠️ Ошибка сохранения стилей поля промокода:', error);
      }
    },

    hideTildaPromocodeField: function (wrapper) {
      if (!wrapper) {
        return;
      }
      wrapper.classList.add(this.PROMO_HIDDEN_CLASS);
      wrapper.setAttribute('aria-hidden', 'true');
      this.log('✅ Поле промокода скрыто без удаления из DOM');
    },

    showTildaPromocodeField: function (wrapper) {
      if (!wrapper) {
        return;
      }
      wrapper.classList.remove(this.PROMO_HIDDEN_CLASS);
      wrapper.removeAttribute('aria-hidden');

      // Если ранее в стиле был display:none, удаляем его
      const inlineStyle = wrapper.getAttribute('style');
      if (inlineStyle && /display\s*:\s*none/gi.test(inlineStyle)) {
        const sanitized = inlineStyle
          .replace(/display\s*:\s*none\s*!?[^;]*;?/gi, '')
          .trim();
        if (sanitized) {
          wrapper.setAttribute('style', sanitized);
        } else {
          wrapper.removeAttribute('style');
        }
      } else if (wrapper.style.display === 'none') {
        wrapper.style.removeProperty('display');
      }

      // На всякий случай убеждаемся, что элемент действительно видим
      try {
        const computedDisplay = window.getComputedStyle(wrapper).display;
        if (computedDisplay === 'none') {
          wrapper.style.setProperty('display', 'block', 'important');
        }
      } catch (error) {
        this.log('⚠️ Не удалось вычислить стиль поля промокода:', error);
      }

      this.log('✅ Поле промокода показано с сохранением обработчиков');
    },

    // Состояние
    state: {
      userEmail: null,
      userPhone: null,
      bonusBalance: 0,
      appliedBonuses: 0,
      initialized: false,
      balanceDebounceTimer: null,
      activeFetchController: null,
      cartOpenDebounceTimer: null,
      _bodyObserver: null,
      _cartObserver: null,
      mode: 'bonus',
      levelInfo: null, // информация об уровне пользователя
      originalCartTotal: 0, // изначальная сумма корзины без бонусов
      // Новые поля для управления памятью
      timers: new Set(), // Храним все активные таймеры
      observers: new Set(), // Храним все observers
      abortControllers: new Set(), // Храним все AbortController'ы
      isDestroyed: false, // Флаг уничтожения виджета
      // Rate limiting
      lastApiCall: 0, // Timestamp последнего API вызова
      activeRequests: 0, // Количество активных запросов
      requestQueue: [], // Очередь запросов для rate limiting
      apiAvailable: undefined, // Доступность API
      // Кэш DOM элементов для оптимизации
      domCache: new Map(), // Кэш найденных элементов
      // Архитектурные улучшения
      errorRecoveryAttempts: 0, // Количество попыток восстановления после ошибок
      lastErrorTime: 0, // Время последней ошибки
      healthCheckTimer: null, // Таймер проверки здоровья
      // Хранение оригинальных стилей поля промокода
      originalPromoStyles: null, // Сохраненные оригинальные стили .t-inputpromocode__wrapper
      intervals: [], // Массив интервалов для очистки
      eventListeners: [] // Массив обработчиков событий для очистки
    },

    // Инициализация виджета
    init: function (userConfig) {
      console.log('🎯 TildaBonusWidget: НАЧАЛО ИНИЦИАЛИЗАЦИИ');
      console.log('🎯 TildaBonusWidget: Опции:', userConfig);

      // Проверяем что DOM готов
      if (typeof document === 'undefined' || !document.body) {
        console.error(
          '❌ TildaBonusWidget: DOM не готов, откладываем инициализацию'
        );
        setTimeout(() => this.init(userConfig), 100);
        return;
      }

      // Объединяем конфигурацию
      this.config = Object.assign({}, this.config, userConfig);

      // Проверяем обязательные параметры
      if (!this.config.projectId) {
        console.error('[TildaBonusWidget] Ошибка: projectId не указан');
        return;
      }

      // Проверяем доступность API
      this.checkApiAvailability();

      // Запускаем периодическую очистку кэша
      this.scheduleCacheCleanup();

      // Перехватываем отправку формы для гарантированного добавления appliedBonuses
      this.interceptFormSubmission();
      this.setupTildaDataProxy();

      // Загружаем настройки виджета при инициализации (принудительно, без кэша)
      this.loadWidgetSettingsOnInit();

      // Если apiUrl не указан, определяем по src текущего скрипта
      try {
        if (!this.config.apiUrl) {
          var cur = document.currentScript;
          var el =
            cur ||
            document.querySelector('script[src*="tilda-bonus-widget.js"]');
          if (el && el.getAttribute('src')) {
            var u = new URL(el.getAttribute('src'), window.location.href);
            this.config.apiUrl = u.origin;
          } else {
            this.config.apiUrl = window.location.origin;
          }
        }
      } catch (_) {
        this.config.apiUrl = this.config.apiUrl || window.location.origin;
      }

      // Инициализируем UI
      this.initUI();

      // Виджет НЕ создаётся при init - он создаётся в зависимости от состояния:
      // 1. not_registered -> showRegistrationPrompt() (плашка ВМЕСТО виджета)
      // 2. registered_not_confirmed -> createWidget() + уведомление
      // 3. fully_activated -> createWidget() + баланс

      // Отслеживаем изменения в корзине
      this.observeCart();

      // Отслеживаем ввод email/телефона
      this.observeUserInput();

      // Отслеживаем авторизацию Tilda
      this.observeTildaAuth();

      // Загружаем сохраненные данные пользователя из localStorage
      this.loadUserDataFromStorage();

      this.state.initialized = true;
      this.log('Виджет инициализирован', this.config);
    },

    // Загрузка данных пользователя из localStorage при инициализации
    loadUserDataFromStorage: function () {
      try {
        const savedEmail = this.safeGetStorage('tilda_user_email');
        const savedPhone = this.safeGetStorage('tilda_user_phone');
        const savedAppliedBonuses = this.safeGetStorage(
          'tilda_applied_bonuses'
        );

        if (savedEmail && this.validateEmail(savedEmail)) {
          this.state.userEmail = savedEmail;
          this.log('📧 Загружен валидный email из localStorage');
        }

        if (savedPhone && this.validatePhone(savedPhone)) {
          this.state.userPhone = savedPhone;
          this.log('📱 Загружен валидный телефон из localStorage');
        }

        if (savedAppliedBonuses) {
          const bonusAmount = parseFloat(savedAppliedBonuses);
          if (!isNaN(bonusAmount) && bonusAmount >= 0 && bonusAmount <= 10000) {
            this.state.appliedBonuses = bonusAmount;
            this.log('💰 Загружены примененные бонусы:', bonusAmount);
          }
        }

        this.log('✅ Данные пользователя загружены и валидированы');
      } catch (error) {
        this.logError('Ошибка загрузки данных пользователя', error);
      }
    },

    // Безопасное логирование (только в режиме отладки)
    log: function () {
      if (
        this.config.debug &&
        this.config.enableLogging &&
        typeof console !== 'undefined'
      ) {
        try {
          // Фильтруем чувствительные данные
          const args = Array.from(arguments).map((arg) => {
            if (
              typeof arg === 'string' &&
              (arg.includes('@') || arg.match(/\d{10,}/))
            ) {
              return arg.replace(/./g, '*'); // Маскируем персональные данные
            }
            return arg;
          });
          console.log('[TildaBonusWidget]', ...args);
        } catch (e) {
          // Silent fail - не логируем ошибки логирования
        }
      }
    },

    // Логирование ошибок (всегда активно, но с фильтрами)
    logError: function (message, error) {
      if (!this.config.enableLogging) return;

      try {
        const safeMessage = message.replace(/./g, '*'); // Маскируем потенциально чувствительные сообщения
        console.error(
          '[TildaBonusWidget Error]',
          safeMessage,
          error?.message || 'Unknown error'
        );

        // Автоматическое восстановление после критических ошибок
        this.handleErrorRecovery(error);
      } catch (e) {
        // Silent fail
      }
    },

    // Система восстановления после ошибок
    handleErrorRecovery: function (error) {
      const now = Date.now();
      const timeSinceLastError = now - this.state.lastErrorTime;

      // Если прошло менее 5 минут с последней ошибки, увеличиваем счетчик
      if (timeSinceLastError < 5 * 60 * 1000) {
        this.state.errorRecoveryAttempts++;
      } else {
        this.state.errorRecoveryAttempts = 1;
      }

      this.state.lastErrorTime = now;

      // Если слишком много ошибок подряд, переходим в safe mode
      if (this.state.errorRecoveryAttempts >= 5) {
        this.log('🚨 Слишком много ошибок, переходим в безопасный режим');
        this.enterSafeMode();
        return;
      }

      // Для некоторых типов ошибок пытаемся восстановиться
      if (error?.name === 'TypeError' && error?.message?.includes('null')) {
        this.log('🔧 Пытаемся восстановить после null reference ошибки');
        this.safeSetTimeout(() => {
          this.validateState();
          this.cleanDomCache();
        }, 1000);
      }
    },

    // Безопасный режим работы
    enterSafeMode: function () {
      this.log('🛡️ Включаем безопасный режим');

      // Отключаем все observers и таймеры
      this.destroy();

      // Показываем упрощенное сообщение
      this.showSafeModeMessage();

      // Периодически пытаемся восстановиться
      this.scheduleRecoveryCheck();
    },

    // Показать сообщение безопасного режима
    showSafeModeMessage: function () {
      const message = document.createElement('div');
      message.id = 'tilda-bonus-safe-mode';
      message.innerHTML = `
        <div style="
          position: fixed;
          bottom: 20px;
          left: 20px;
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10001;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #856404;
          max-width: 300px;
        ">
          🔧 Виджет работает в безопасном режиме. Обновите страницу для восстановления.
        </div>
      `;

      document.body.appendChild(message);
    },

    // Планирование проверки восстановления
    scheduleRecoveryCheck: function () {
      this.safeSetTimeout(() => {
        if (!this.state.isDestroyed) {
          this.attemptRecovery();
        }
      }, 30 * 1000); // Проверяем каждые 30 секунд
    },

    // Попытка восстановления
    attemptRecovery: function () {
      try {
        this.log('🔄 Пытаемся восстановить нормальную работу...');

        // Проверяем основные компоненты
        const cartWindow = this.getCachedElement('.t706__cartwin', true);
        if (cartWindow) {
          // Если основные элементы доступны, пытаемся переинициализировать
          this.state.errorRecoveryAttempts = 0;
          this.init(this.config);
          return;
        }

        // Если не удалось, планируем следующую попытку
        this.scheduleRecoveryCheck();
      } catch (error) {
        this.logError('Не удалось восстановить работу', error);
        this.scheduleRecoveryCheck();
      }
    },

    // Безопасное создание таймера
    safeSetTimeout: function (callback, delay) {
      if (this.state.isDestroyed) return null;

      const timer = setTimeout(() => {
        if (!this.state.isDestroyed) {
          callback();
        }
        this.state.timers.delete(timer);
      }, delay);

      this.state.timers.add(timer);
      return timer;
    },

    // Безопасная очистка таймера
    safeClearTimeout: function (timer) {
      if (timer) {
        clearTimeout(timer);
        this.state.timers.delete(timer);
      }
    },

    // Безопасное создание AbortController
    createAbortController: function () {
      if (this.state.isDestroyed) return null;

      const controller = new AbortController();
      this.state.abortControllers.add(controller);

      // Автоматическая очистка при abort
      controller.signal.addEventListener('abort', () => {
        this.state.abortControllers.delete(controller);
      });

      return controller;
    },

    // Безопасное создание observer
    createObserver: function (callback, options) {
      if (this.state.isDestroyed) return null;

      const observer = new MutationObserver((mutations, obs) => {
        if (!this.state.isDestroyed) {
          callback(mutations, obs);
        }
      });

      this.state.observers.add(observer);
      return observer;
    },

    // Проверка доступности API
    checkApiAvailability: async function () {
      if (this.state.apiAvailable !== undefined) return this.state.apiAvailable;

      try {
        const testUrl = `${this.config.apiUrl}/api/health`;
        const response = await Promise.race([
          fetch(testUrl, { method: 'HEAD', mode: 'no-cors' }),
          new Promise((_, reject) =>
            this.safeSetTimeout(() => reject(new Error('timeout')), 3000)
          )
        ]);

        this.state.apiAvailable = true;
        this.log('✅ API доступен');
        return true;
      } catch (error) {
        this.state.apiAvailable = false;
        this.log('⚠️ API недоступен, переходим в offline режим');
        this.enterOfflineMode();
        return false;
      }
    },

    // Режим работы без API
    enterOfflineMode: function () {
      this.log('🔌 Переход в offline режим');

      // Показываем базовую информацию без API данных
      if (this.getUserContact()) {
        this.ensureWidgetMounted();
        this.showLoading(false);
        this.updateBalanceDisplay();
      } else {
        this.showRegistrationPrompt();
      }

      // Показываем сообщение о недоступности
      this.safeSetTimeout(() => {
        this.showOfflineMessage();
      }, 2000);
    },

    // Безопасный поиск DOM элементов с кэшированием
    getCachedElement: function (selector, refresh = false) {
      if (!refresh && this.state.domCache.has(selector)) {
        const cached = this.state.domCache.get(selector);
        if (cached.element && document.contains(cached.element)) {
          return cached.element;
        }
        // Элемент больше не существует, удаляем из кэша
        this.state.domCache.delete(selector);
      }

      try {
        const element = document.querySelector(selector);
        if (element) {
          this.state.domCache.set(selector, {
            element: element,
            timestamp: Date.now()
          });
        }
        return element;
      } catch (error) {
        this.logError('Error finding element', error);
        return null;
      }
    },

    // Очистка устаревшего кэша DOM элементов
    cleanDomCache: function () {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 минут

      for (const [selector, cached] of this.state.domCache.entries()) {
        if (
          now - cached.timestamp > maxAge ||
          !document.contains(cached.element)
        ) {
          this.state.domCache.delete(selector);
        }
      }
    },

    // Планирование периодической очистки кэша
    scheduleCacheCleanup: function () {
      this.safeSetTimeout(
        () => {
          if (!this.state.isDestroyed) {
            this.cleanDomCache();
            this.validateState(); // Проверяем корректность состояния
            this.scheduleCacheCleanup(); // Рекурсивный вызов
          }
        },
        5 * 60 * 1000
      ); // Каждые 5 минут
    },

    // Валидация состояния виджета
    validateState: function () {
      try {
        // Проверяем корректность числовых значений
        if (
          typeof this.state.bonusBalance !== 'number' ||
          isNaN(this.state.bonusBalance)
        ) {
          this.state.bonusBalance = 0;
        }
        if (
          typeof this.state.appliedBonuses !== 'number' ||
          isNaN(this.state.appliedBonuses)
        ) {
          this.state.appliedBonuses = 0;
        }
        if (
          typeof this.state.originalCartTotal !== 'number' ||
          isNaN(this.state.originalCartTotal)
        ) {
          this.state.originalCartTotal = 0;
        }

        // Проверяем строковые значения
        if (typeof this.state.userEmail !== 'string') {
          this.state.userEmail = null;
        }
        if (typeof this.state.userPhone !== 'string') {
          this.state.userPhone = null;
        }

        // Проверяем логические значения
        if (typeof this.state.initialized !== 'boolean') {
          this.state.initialized = false;
        }

        // Ограничиваем размеры коллекций для предотвращения memory leaks
        if (this.state.domCache.size > 100) {
          this.log('⚠️ Слишком большой DOM кэш, очищаем...');
          this.state.domCache.clear();
        }

        if (this.state.requestQueue.length > 10) {
          this.log('⚠️ Слишком большая очередь запросов, очищаем...');
          this.state.requestQueue = [];
        }
      } catch (error) {
        this.logError('Ошибка валидации состояния', error);
      }
    },

    // Показать сообщение о недоступности
    showOfflineMessage: function () {
      const message = document.createElement('div');
      message.id = 'tilda-bonus-offline-message';
      message.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10001;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #856404;
          max-width: 300px;
        ">
          🔄 Сервис бонусов временно недоступен. Попробуйте позже.
        </div>
      `;

      document.body.appendChild(message);

      // Автоматическое скрытие через 5 секунд
      this.safeSetTimeout(() => {
        if (message.parentNode) {
          message.remove();
        }
      }, 5000);
    },

    // Rate limited API запрос с retry logic
    makeApiRequest: async function (url, options = {}, retryCount = 0) {
      if (this.state.isDestroyed) return null;

      // Rate limiting
      const now = Date.now();
      const timeSinceLastCall = now - this.state.lastApiCall;

      if (timeSinceLastCall < this.config.rateLimitMs) {
        await new Promise((resolve) =>
          this.safeSetTimeout(
            resolve,
            this.config.rateLimitMs - timeSinceLastCall
          )
        );
      }

      // Проверка на максимум одновременных запросов
      if (this.state.activeRequests >= this.config.maxConcurrentRequests) {
        // Добавляем в очередь
        return new Promise((resolve, reject) => {
          this.state.requestQueue.push({
            url,
            options,
            retryCount,
            resolve,
            reject
          });
        });
      }

      this.state.lastApiCall = Date.now();
      this.state.activeRequests++;

      try {
        const controller = this.createAbortController();
        if (!controller) throw new Error('Cannot create AbortController');

        const fetchOptions = {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        };

        this.log('Making API request:', url);

        const response = await fetch(url, fetchOptions);
        this.state.activeRequests--;

        // Обработка очереди
        if (
          this.state.requestQueue.length > 0 &&
          this.state.activeRequests < this.config.maxConcurrentRequests
        ) {
          const nextRequest = this.state.requestQueue.shift();
          this.safeSetTimeout(() => {
            this.makeApiRequest(
              nextRequest.url,
              nextRequest.options,
              nextRequest.retryCount
            )
              .then(nextRequest.resolve)
              .catch(nextRequest.reject);
          }, 100);
        }

        // Проверка статуса ответа
        if (!response.ok) {
          // Для 404 пытаемся прочитать JSON ответ (API возвращает структурированную ошибку)
          if (response.status === 404) {
            try {
              const errorData = await response.json();
              this.log('📋 API вернул 404 с данными:', errorData);
              // Возвращаем данные ошибки для обработки в вызывающем коде
              return errorData;
            } catch (jsonError) {
              this.log('⚠️ Не удалось прочитать JSON из 404 ответа');
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }
          }

          if (response.status >= 500 && retryCount < this.config.maxRetries) {
            this.log(
              `API request failed with ${response.status}, retrying... (${retryCount + 1}/${this.config.maxRetries})`
            );
            await new Promise((resolve) =>
              this.safeSetTimeout(resolve, Math.pow(2, retryCount) * 1000)
            ); // Exponential backoff
            return this.makeApiRequest(url, options, retryCount + 1);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        this.state.activeRequests--;

        if (error.name === 'AbortError') {
          this.log('Request was aborted');
          return null;
        }

        // Retry на сетевые ошибки
        if (
          (error.name === 'TypeError' || error.name === 'NetworkError') &&
          retryCount < this.config.maxRetries
        ) {
          this.log(
            `Network error, retrying... (${retryCount + 1}/${this.config.maxRetries})`,
            error.message
          );
          await new Promise((resolve) =>
            this.safeSetTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
          return this.makeApiRequest(url, options, retryCount + 1);
        }

        this.logError('API request failed after retries', error);
        throw error;
      }
    },

    // Безопасное получение данных из localStorage
    safeGetStorage: function (key) {
      try {
        if (typeof Storage === 'undefined') return null;
        const value = localStorage.getItem(key);
        if (!value) return null;

        // Базовая валидация - проверяем на потенциально опасный контент
        if (value.length > 1000) return null; // Защита от oversized данных
        if (/<script|javascript:|data:/i.test(value)) return null; // Защита от XSS

        return value;
      } catch (error) {
        this.logError('Storage access error', error);
        return null;
      }
    },

    // Безопасная запись в localStorage
    safeSetStorage: function (key, value) {
      try {
        if (typeof Storage === 'undefined') return false;
        if (typeof value !== 'string') value = String(value);
        if (value.length > 1000) return false; // Ограничение размера

        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        this.logError('Storage write error', error);
        return false;
      }
    },

    // Валидация email
    validateEmail: function (email) {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
    },

    // Валидация телефона
    validatePhone: function (phone) {
      if (!phone || typeof phone !== 'string') return false;
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    },

    // Получить email пользователя из localStorage или куки
    getUserEmail: function () {
      try {
        // Проверяем localStorage
        const savedEmail = this.safeGetStorage('tilda_user_email');
        if (savedEmail && this.validateEmail(savedEmail)) {
          return savedEmail;
        }

        // Проверяем куки (на случай если данные хранятся там)
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if ((name === 'user_email' || name === 'tilda_user_email') && value) {
            const decodedValue = decodeURIComponent(value);
            if (this.validateEmail(decodedValue)) {
              return decodedValue;
            }
          }
        }

        return null;
      } catch (error) {
        this.logError('Error getting user email', error);
        return null;
      }
    },

    // Проверить, привязан ли Telegram
    isTelegramLinked: function () {
      try {
        // Проверяем localStorage на наличие признака привязки
        const telegramLinked = this.safeGetStorage('tilda_telegram_linked');
        if (telegramLinked === 'true') {
          return true;
        }

        // Дополнительная проверка - наличие telegram ID или username
        const telegramId = this.safeGetStorage('tilda_telegram_id');
        const telegramUsername = this.safeGetStorage('tilda_telegram_username');

        // Валидируем данные
        const isValidId =
          telegramId && /^\d+$/.test(telegramId) && telegramId.length < 20;
        const isValidUsername =
          telegramUsername && /^[a-zA-Z0-9_]{3,32}$/.test(telegramUsername);

        return !!(isValidId || isValidUsername);
      } catch (error) {
        this.logError('Error checking Telegram link', error);
        return false;
      }
    },

    // Создание UI элементов
    // Загрузка настроек виджета при инициализации (принудительно из БД)
    loadWidgetSettingsOnInit: function () {
      try {
        this.log('🔄 Загружаем настройки виджета при инициализации...');

        // Принудительно загружаем настройки из API (игнорируя кэш)
        this.loadProjectSettingsSimple()
          .then((settings) => {
            this.log(
              '✅ Настройки виджета загружены при инициализации:',
              settings
            );

            // Сохраняем настройки в state
            this.state.widgetSettings = settings.widgetSettings || {};

            // Применяем стили виджета
            if (settings.widgetSettings) {
              this.applyWidgetStyles(settings.widgetSettings);
            }

            // Обновляем кэш с новыми настройками
            this.cacheProjectSettings(settings, 5 * 60 * 1000); // 5 минут
          })
          .catch((error) => {
            this.log(
              '⚠️ Ошибка загрузки настроек виджета при инициализации:',
              error
            );
            // Пытаемся загрузить из кэша как fallback
            const cachedSettings = this.getCachedProjectSettings();
            if (cachedSettings && cachedSettings.widgetSettings) {
              this.log('📋 Используем настройки из кэша как fallback');
              this.state.widgetSettings = cachedSettings.widgetSettings || {};
              this.applyWidgetStyles(cachedSettings.widgetSettings);
            }
          });
      } catch (error) {
        this.log('❌ Критическая ошибка при загрузке настроек виджета:', error);
      }
    },

    initUI: function () {
      // Подключаем Google Fonts для кастомных шрифтов
      if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'preconnect';
        fontLink.href = 'https://fonts.googleapis.com';
        document.head.appendChild(fontLink);

        const fontLink2 = document.createElement('link');
        fontLink2.rel = 'preconnect';
        fontLink2.href = 'https://fonts.gstatic.com';
        fontLink2.crossOrigin = 'anonymous';
        document.head.appendChild(fontLink2);

        const fontLink3 = document.createElement('link');
        fontLink3.rel = 'stylesheet';
        fontLink3.href =
          'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&family=Rubik:wght@400;500;600;700&display=swap';
        document.head.appendChild(fontLink3);
      }

      // Стили для виджета с CSS-переменными для кастомизации
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --bonus-widget-bg: #ffffff;
          --bonus-widget-border: #e5e7eb;
          --bonus-widget-text: #1f2937;
          --bonus-widget-label: #6b7280;
          --bonus-widget-input-bg: #ffffff;
          --bonus-widget-input-border: #d1d5db;
          --bonus-widget-input-text: #111827;
          --bonus-widget-button-bg: #3b82f6;
          --bonus-widget-button-text: #ffffff;
          --bonus-widget-button-hover: #2563eb;
          --bonus-widget-balance: #059669;
          --bonus-widget-error: #dc2626;
          --bonus-widget-success: #059669;
          --bonus-widget-font-family: system-ui, -apple-system, sans-serif;
          --bonus-widget-font-size: 14px;
          --bonus-widget-label-font-size: 13px;
          --bonus-widget-button-font-size: 14px;
          --bonus-widget-balance-font-size: 16px;
          --bonus-widget-border-radius: 8px;
          --bonus-widget-padding: 16px;
          --bonus-widget-input-border-radius: 6px;
          --bonus-widget-input-padding: 8px 12px;
          --bonus-widget-button-border-radius: 6px;
          --bonus-widget-button-padding: 10px 20px;
          --bonus-widget-box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .bonus-widget-container {
          background: var(--bonus-widget-bg);
          border: 1px solid var(--bonus-widget-border);
          border-radius: var(--bonus-widget-border-radius);
          padding: var(--bonus-widget-padding);
          margin: 8px 0;
          font-family: var(--bonus-widget-font-family);
          color: var(--bonus-widget-text);
          font-size: var(--bonus-widget-font-size);
          box-shadow: var(--bonus-widget-box-shadow);
        }
        
        .bonus-widget-title {
          font-size: var(--bonus-widget-balance-font-size);
          font-weight: 600;
          color: var(--bonus-widget-text);
          margin-bottom: 8px;
        }
        .bonus-toggle{display:flex;gap:8px;margin-bottom:8px}
        .bonus-toggle-btn{
          flex:1;
          padding:8px 12px;
          border:1px solid var(--bonus-widget-border);
          background:var(--bonus-widget-input-bg);
          border-radius:var(--bonus-widget-input-border-radius);
          cursor:pointer;
          color:var(--bonus-widget-text);
          font-size:var(--bonus-widget-font-size);
        }
        .bonus-toggle-btn.active{
          background:var(--bonus-widget-button-bg);
          color:var(--bonus-widget-button-text);
          border-color:var(--bonus-widget-button-bg);
        }
        
        .bonus-balance { 
          font-size: var(--bonus-widget-label-font-size); 
          color: var(--bonus-widget-label); 
          margin-bottom: 8px; 
        }
        
        .bonus-balance-amount { 
          font-weight: 600; 
          color: var(--bonus-widget-balance);
          font-size: var(--bonus-widget-balance-font-size);
        }
        
        .bonus-input-group {
          display: flex !important;
          width: 100% !important;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .bonus-input { 
          flex: 1 !important; 
          width: auto !important; 
          padding: var(--bonus-widget-input-padding); 
          border: 1px solid var(--bonus-widget-input-border); 
          border-radius: var(--bonus-widget-input-border-radius); 
          font-size: var(--bonus-widget-font-size); 
          color: var(--bonus-widget-input-text);
          background: var(--bonus-widget-input-bg);
          font-family: var(--bonus-widget-font-family);
        }
        
        .bonus-button { 
          padding: var(--bonus-widget-button-padding); 
          background: var(--bonus-widget-button-bg); 
          color: var(--bonus-widget-button-text); 
          border: none; 
          border-radius: var(--bonus-widget-button-border-radius); 
          cursor: pointer; 
          font-size: var(--bonus-widget-button-font-size); 
          font-weight: 500; 
          transition: background .2s;
          font-family: var(--bonus-widget-font-family);
        }
        .bonus-button:hover { background: var(--bonus-widget-button-hover); }
        .bonus-button:disabled { opacity: .6; cursor: not-allowed; }
        
        .bonus-applied { 
          padding: 8px 12px; 
          border: 1px solid var(--bonus-widget-success); 
          border-radius: var(--bonus-widget-input-border-radius); 
          color: var(--bonus-widget-success); 
          background: var(--bonus-widget-input-bg); 
          font-size: var(--bonus-widget-label-font-size); 
        }
        .bonus-error { 
          padding: 8px 12px; 
          border: 1px solid var(--bonus-widget-error); 
          border-radius: var(--bonus-widget-input-border-radius); 
          color: var(--bonus-widget-error); 
          background: var(--bonus-widget-input-bg); 
          font-size: var(--bonus-widget-label-font-size); 
          margin-top: 8px; 
        }
        
        .bonus-loading {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #007bff;
          border-radius: 50%;
          animation: bonus-spin 1s linear infinite;
          margin-left: 8px;
        }
        
        @keyframes bonus-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Анимации для иконок */
        .pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .bounce {
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }

        .shake {
          animation: shake 0.5s infinite;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        /* Стили для плашки регистрации */
        .registration-prompt {
          text-align: center;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          margin-bottom: 12px;
        }

        .registration-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .registration-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 8px;
        }

        .registration-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.4;
          margin-bottom: 16px;
        }

        .registration-description strong {
          color: #059669;
          font-weight: 600;
        }

        .registration-action {
          margin-top: 12px;
        }

        .registration-button {
          display: inline-block;
          padding: 10px 16px;
          background: #000000;
          color: #ffffff;
          text-decoration: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .registration-button:hover {
          background: #333333;
        }

        /* Стили для inline плашки регистрации в поле промокода */
        .registration-prompt-inline {
          width: 100%;
          padding: 8px 0;
        }

        .registration-prompt-inline .registration-prompt {
          text-align: center;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }
        
        /* Дополнительный класс: скрываем поле промокода без display:none */
        .t-inputpromocode__wrapper.bonus-promocode-hidden {
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          pointer-events: none !important;
          overflow: hidden !important;
          border: 0 !important;
        }

        /* НЕ скрываем оригинальное поле промокода - оно нужно для работы */
      `;
      document.head.appendChild(style);
      // Контейнер создаём лениво — только когда пользователь найден
    },

    // Создание виджета (ТОЛЬКО для зарегистрированных пользователей)
    createWidget: function () {
      // Не вставляем повторно
      if (document.querySelector('.bonus-widget-container')) {
        console.log('✅ Виджет уже существует');
        return;
      }

      // Находим контейнер поля промокода
      const promocodeWrapper = document.querySelector(
        '.t-inputpromocode__wrapper'
      );
      if (!promocodeWrapper) {
        console.warn('⚠️ Контейнер поля промокода не найден');
        return;
      }

      const container = document.createElement('div');
      container.className = 'bonus-widget-container';
      container.innerHTML = `
        <div class="bonus-widget-title">Бонусная программа</div>
        <div class="bonus-toggle">
          <button id="bonus-tab" type="button" class="bonus-toggle-btn active" onclick="TildaBonusWidget.switchMode('bonus')">Списать бонусы</button>
          <button id="promo-tab" type="button" class="bonus-toggle-btn" onclick="TildaBonusWidget.switchMode('promo')">Промокод</button>
        </div>
        <div id="bonus-content-area">
          <div class="bonus-balance" style="display: none;">
            Ваш баланс: <span class="bonus-balance-amount">0</span> бонусов
          </div>
          <div id="bonus-section" class="bonus-input-group" style="display: none;">
            <input type="number" 
                   class="bonus-input" 
                   id="bonus-amount-input" 
                   placeholder="Количество бонусов" 
                   min="0">
            <button class="bonus-button" type="button"
                    id="apply-bonus-button" 
                    onclick="TildaBonusWidget.applyOrReapplyBonuses()">
              Применить бонусы
            </button>
          </div>
          <div id="verification-notice" style="display: none;"></div>
        </div>
        <div id="bonus-status"></div>
      `;

      // Вставляем виджет ПЕРЕД полем промокода
      promocodeWrapper.parentNode.insertBefore(container, promocodeWrapper);

      // Сохраняем оригинальные стили и скрываем поле промокода Tilda по умолчанию
      this.capturePromoWrapperStyles(promocodeWrapper);
      this.hideTildaPromocodeField(promocodeWrapper);
      this.state.promoWrapper = promocodeWrapper;

      console.log('✅ Виджет создан и добавлен перед полем промокода');
    },

    // Гарантированно вставить виджет, если его ещё нет
    ensureWidgetMounted: function () {
      // Виджет уже создан при инициализации, просто проверяем его наличие
      const exists = !!document.querySelector('.bonus-widget-container');
      if (!exists) {
        console.warn('⚠️ Виджет не найден, создаём заново');
        this.createWidget();
      }
      return !!document.querySelector('.bonus-widget-container');
    },

    // Показывает элементы управления виджета
    showWidgetControls: function () {
      const userState = this.getUserState();
      console.log('📊 showWidgetControls: userState =', userState);

      const bonusSection = document.getElementById('bonus-section');
      const balanceEl = document.querySelector('.bonus-balance');
      const verificationNotice = document.getElementById('verification-notice');

      if (userState === 'registered_not_confirmed') {
        // Показываем уведомление о необходимости верификации
        console.log(
          '⚠️ showWidgetControls: показываем уведомление о верификации'
        );
        if (bonusSection) bonusSection.style.display = 'none';
        if (balanceEl) balanceEl.style.display = 'none';
        if (verificationNotice) {
          verificationNotice.style.display = 'block';
          // Используем кастомную ссылку или ссылку на бота
          const verificationButtonUrl =
            this.state.widgetSettings?.registrationButtonUrl ||
            (this.state.botUsername
              ? `https://t.me/${this.state.botUsername}`
              : null);

          verificationNotice.innerHTML = `
            <div style="padding: 16px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #92400E; font-weight: 600;">⚠️ Требуется верификация</p>
              <p style="margin: 0 0 12px 0; color: #78350F; font-size: 14px;">Для использования бонусов подтвердите свой аккаунт в Telegram боте</p>
              ${verificationButtonUrl ? `<a href="${verificationButtonUrl}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #F59E0B; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Перейти в бота</a>` : ''}
            </div>
          `;
        }
      } else if (userState === 'fully_activated') {
        // Показываем баланс и форму
        console.log('✅ showWidgetControls: показываем баланс и форму');
        if (bonusSection) bonusSection.style.display = 'flex';
        if (balanceEl) balanceEl.style.display = 'block';
        if (verificationNotice) verificationNotice.style.display = 'none';
      }
    },

    // Полная очистка ресурсов для предотвращения утечек памяти
    destroy: function () {
      this.log('🧹 Начинаем полную очистку ресурсов виджета');

      // Устанавливаем флаг уничтожения
      this.state.isDestroyed = true;

      // Отменяем все активные AbortController'ы
      for (const controller of this.state.abortControllers) {
        try {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        } catch (error) {
          this.logError('Error aborting controller', error);
        }
      }
      this.state.abortControllers.clear();

      // Очищаем все таймеры
      for (const timer of this.state.timers) {
        try {
          clearTimeout(timer);
        } catch (error) {
          this.logError('Error clearing timer', error);
        }
      }
      this.state.timers.clear();

      // Отключаем все observers
      for (const observer of this.state.observers) {
        try {
          observer.disconnect();
        } catch (error) {
          this.logError('Error disconnecting observer', error);
        }
      }
      this.state.observers.clear();

      // Очищаем старые поля состояния для совместимости
      if (this.state.balanceDebounceTimer) {
        clearTimeout(this.state.balanceDebounceTimer);
        this.state.balanceDebounceTimer = null;
      }
      if (this.state.cartOpenDebounceTimer) {
        clearTimeout(this.state.cartOpenDebounceTimer);
        this.state.cartOpenDebounceTimer = null;
      }
      if (this.state.activeFetchController) {
        try {
          this.state.activeFetchController.abort();
        } catch (_) {}
        this.state.activeFetchController = null;
      }

      // Отключаем старые observers
      if (this.state._cartObserver) {
        try {
          this.state._cartObserver.disconnect();
        } catch (_) {}
        this.state._cartObserver = null;
      }
      if (this.state._bodyObserver) {
        try {
          this.state._bodyObserver.disconnect();
        } catch (_) {}
        this.state._bodyObserver = null;
      }

      // Очищаем состояние
      this.state = {
        userEmail: null,
        userPhone: null,
        bonusBalance: 0,
        appliedBonuses: 0,
        initialized: false,
        balanceDebounceTimer: null,
        activeFetchController: null,
        cartOpenDebounceTimer: null,
        _bodyObserver: null,
        _cartObserver: null,
        mode: 'bonus',
        levelInfo: null,
        originalCartTotal: 0,
        timers: new Set(),
        observers: new Set(),
        abortControllers: new Set(),
        isDestroyed: true,
        lastApiCall: 0,
        activeRequests: 0,
        requestQueue: [],
        apiAvailable: undefined,
        domCache: new Map(),
        errorRecoveryAttempts: 0,
        lastErrorTime: 0,
        healthCheckTimer: null
      };

      this.log('✅ Все ресурсы виджета полностью очищены');
    },

    // Псевдоним для обратной совместимости
    cleanup: function () {
      this.destroy();
    },

    // Получить настройки проекта для плашки регистрации
    loadProjectSettings: async function () {
      try {
        const cacheBuster = Date.now(); // Предотвращаем кэширование
        const settings = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/bot?t=${cacheBuster}`,
          {
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );

        if (settings) {
          return {
            welcomeBonusAmount: Number(settings?.welcomeBonusAmount || 0),
            botUsername: settings?.botUsername || null,
            widgetSettings: settings?.functionalSettings?.widgetSettings || {}
          };
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          this.log('Таймаут загрузки настроек проекта');
        } else {
          this.log('Ошибка загрузки настроек проекта:', error);
        }
      }
      // Возвращаем значения по умолчанию в случае ошибки
      this.log('Используем значения по умолчанию для настроек проекта');
      return { welcomeBonusAmount: 0, botUsername: null, widgetSettings: {} };
    },

    // Применить настройки стилей виджета через CSS переменные
    applyWidgetStyles: function (widgetSettings) {
      if (!widgetSettings) return;

      this.log('🎨 Применяем кастомные стили виджета:', widgetSettings);

      // Получаем root element для установки CSS переменных
      const root = document.documentElement;

      // Также получаем контейнер виджета для прямого применения стилей
      const widgetContainer = document.querySelector('.bonus-widget-container');

      // Применяем цвета
      if (widgetSettings.widgetBackgroundColor) {
        root.style.setProperty(
          '--bonus-widget-bg',
          widgetSettings.widgetBackgroundColor
        );
      }
      if (widgetSettings.widgetBorderColor) {
        root.style.setProperty(
          '--bonus-widget-border',
          widgetSettings.widgetBorderColor
        );
      }
      if (widgetSettings.widgetTextColor) {
        root.style.setProperty(
          '--bonus-widget-text',
          widgetSettings.widgetTextColor
        );
      }
      if (widgetSettings.widgetLabelColor) {
        root.style.setProperty(
          '--bonus-widget-label',
          widgetSettings.widgetLabelColor
        );
      }
      if (widgetSettings.widgetInputBackground) {
        root.style.setProperty(
          '--bonus-widget-input-bg',
          widgetSettings.widgetInputBackground
        );
      }
      if (widgetSettings.widgetInputBorder) {
        root.style.setProperty(
          '--bonus-widget-input-border',
          widgetSettings.widgetInputBorder
        );
      }
      if (widgetSettings.widgetInputText) {
        root.style.setProperty(
          '--bonus-widget-input-text',
          widgetSettings.widgetInputText
        );
      }
      if (widgetSettings.widgetButtonBackground) {
        root.style.setProperty(
          '--bonus-widget-button-bg',
          widgetSettings.widgetButtonBackground
        );
      }
      if (widgetSettings.widgetButtonText) {
        root.style.setProperty(
          '--bonus-widget-button-text',
          widgetSettings.widgetButtonText
        );
      }
      if (widgetSettings.widgetButtonHover) {
        root.style.setProperty(
          '--bonus-widget-button-hover',
          widgetSettings.widgetButtonHover
        );
      }
      if (widgetSettings.widgetBalanceColor) {
        root.style.setProperty(
          '--bonus-widget-balance',
          widgetSettings.widgetBalanceColor
        );
      }
      if (widgetSettings.widgetErrorColor) {
        root.style.setProperty(
          '--bonus-widget-error',
          widgetSettings.widgetErrorColor
        );
      }
      if (widgetSettings.widgetSuccessColor) {
        root.style.setProperty(
          '--bonus-widget-success',
          widgetSettings.widgetSuccessColor
        );
      }

      // Применяем шрифты
      if (widgetSettings.widgetFontFamily) {
        root.style.setProperty(
          '--bonus-widget-font-family',
          widgetSettings.widgetFontFamily
        );
      }
      if (widgetSettings.widgetFontSize) {
        root.style.setProperty(
          '--bonus-widget-font-size',
          widgetSettings.widgetFontSize
        );
      }
      if (widgetSettings.widgetLabelFontSize) {
        root.style.setProperty(
          '--bonus-widget-label-font-size',
          widgetSettings.widgetLabelFontSize
        );
      }
      if (widgetSettings.widgetButtonFontSize) {
        root.style.setProperty(
          '--bonus-widget-button-font-size',
          widgetSettings.widgetButtonFontSize
        );
      }
      if (widgetSettings.widgetBalanceFontSize) {
        root.style.setProperty(
          '--bonus-widget-balance-font-size',
          widgetSettings.widgetBalanceFontSize
        );
      }

      // Применяем размеры и отступы
      if (widgetSettings.widgetBorderRadius) {
        root.style.setProperty(
          '--bonus-widget-border-radius',
          widgetSettings.widgetBorderRadius
        );
      }
      if (widgetSettings.widgetPadding) {
        root.style.setProperty(
          '--bonus-widget-padding',
          widgetSettings.widgetPadding
        );
      }
      if (widgetSettings.widgetInputBorderRadius) {
        root.style.setProperty(
          '--bonus-widget-input-border-radius',
          widgetSettings.widgetInputBorderRadius
        );
      }
      if (widgetSettings.widgetInputPadding) {
        root.style.setProperty(
          '--bonus-widget-input-padding',
          widgetSettings.widgetInputPadding
        );
      }
      if (widgetSettings.widgetButtonBorderRadius) {
        root.style.setProperty(
          '--bonus-widget-button-border-radius',
          widgetSettings.widgetButtonBorderRadius
        );
      }
      if (widgetSettings.widgetButtonPadding) {
        root.style.setProperty(
          '--bonus-widget-button-padding',
          widgetSettings.widgetButtonPadding
        );
      }

      // Применяем тени
      if (widgetSettings.widgetBoxShadow) {
        root.style.setProperty(
          '--bonus-widget-box-shadow',
          widgetSettings.widgetBoxShadow
        );
      }

      // Также применяем стили напрямую к контейнеру виджета
      // для гарантированного применения даже если CSS переменные не работают
      if (widgetContainer) {
        if (widgetSettings.widgetBackgroundColor) {
          widgetContainer.style.setProperty(
            'background',
            widgetSettings.widgetBackgroundColor
          );
        }
        if (widgetSettings.widgetBorderColor) {
          widgetContainer.style.setProperty(
            'border-color',
            widgetSettings.widgetBorderColor
          );
        }
        if (widgetSettings.widgetTextColor) {
          widgetContainer.style.setProperty(
            'color',
            widgetSettings.widgetTextColor
          );
        }
        if (widgetSettings.widgetBorderRadius) {
          widgetContainer.style.setProperty(
            'border-radius',
            widgetSettings.widgetBorderRadius
          );
        }
        if (widgetSettings.widgetPadding) {
          widgetContainer.style.setProperty(
            'padding',
            widgetSettings.widgetPadding
          );
        }
        if (widgetSettings.widgetBoxShadow) {
          widgetContainer.style.setProperty(
            'box-shadow',
            widgetSettings.widgetBoxShadow
          );
        }
        if (widgetSettings.widgetFontFamily) {
          widgetContainer.style.setProperty(
            'font-family',
            widgetSettings.widgetFontFamily
          );
        }
        if (widgetSettings.widgetFontSize) {
          widgetContainer.style.setProperty(
            'font-size',
            widgetSettings.widgetFontSize
          );
        }
      }

      this.log('✅ Кастомные стили виджета применены');
    },

    // Скрыть плашку регистрации
    hideRegistrationPrompt: function () {
      const prompt = document.querySelector('.registration-prompt-inline');
      if (prompt) {
        prompt.remove();
        this.log('Скрыта плашка регистрации');
      }
      // Поле промокода не нужно восстанавливать, т.к. мы его не скрывали
    },

    // Показать сообщение об ошибке
    showErrorMessage: function (errorMessage) {
      try {
        this.log('🚨 Показываем сообщение об ошибке:', errorMessage);

        // Удаляем существующее сообщение если есть
        const existingError = document.querySelector('.user-error-message');
        if (existingError) {
          existingError.remove();
        }

        // Ищем контейнер поля промокода
        const promocodeWrapper = document.querySelector(
          '.t-inputpromocode__wrapper'
        );
        if (!promocodeWrapper) {
          this.log('Контейнер поля промокода не найден');
          return;
        }

        // Создаем сообщение об ошибке
        const errorDiv = document.createElement('div');
        errorDiv.className = 'user-error-message';
        errorDiv.style.cssText = `
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          text-align: center;
          font-size: 14px;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        `;

        errorDiv.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 16px;">⚠️</span>
            <span>${errorMessage}</span>
          </div>
        `;

        // Вставляем перед полем промокода
        promocodeWrapper.parentNode.insertBefore(errorDiv, promocodeWrapper);

        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
          if (errorDiv && errorDiv.parentNode) {
            errorDiv.remove();
          }
        }, 5000);
      } catch (error) {
        this.log('Ошибка при показе сообщения об ошибке:', error);
      }
    },

    // Показать плашку с приглашением зарегистрироваться
    showRegistrationPrompt: function () {
      try {
        this.log('🎯 Показываем плашку регистрации');

        // Удаляем существующую плашку если есть
        const existingPrompt = document.querySelector(
          '.registration-prompt-inline'
        );
        if (existingPrompt) {
          existingPrompt.remove();
        }

        // Ищем контейнер поля промокода
        const promocodeWrapper = document.querySelector(
          '.t-inputpromocode__wrapper'
        );
        if (!promocodeWrapper) {
          this.log('Контейнер поля промокода не найден');
          return;
        }

        // Асинхронно загружаем реальные настройки и показываем плашку
        this.loadProjectSettingsForPrompt()
          .then((settings) => {
            this.log(
              '✅ Настройки проекта загружены, показываем плашку:',
              settings
            );
            // Отрисовываем с реальными данными
            this.renderRegistrationPrompt(settings);
          })
          .catch((error) => {
            this.log('❌ Не удалось загрузить настройки проекта:', error);
            // Показываем плашку с базовыми данными
            const defaultSettings = {
              welcomeBonusAmount: 500, // Базовое значение
              botUsername: null,
              widgetSettings: {}
            };
            this.renderRegistrationPrompt(defaultSettings);
          });
      } catch (error) {
        this.log('Ошибка при показе плашки регистрации:', error);
      }
    },

    // Загружаем настройки для плашки с fallback
    loadProjectSettingsForPrompt: async function () {
      try {
        this.log('📡 Загружаем настройки проекта для плашки...');

        // Проверяем, нужно ли форсировать обновление (если прошло больше 30 секунд с последнего обновления)
        const forceRefresh = this.shouldForceRefreshSettings();

        if (!forceRefresh) {
          // Проверяем локальное хранилище сначала
          const cachedSettings = this.getCachedProjectSettings();
          if (cachedSettings) {
            this.log('📋 Используем кэшированные настройки:', cachedSettings);
            return cachedSettings;
          }
        }

        this.log('🌐 Загружаем свежие настройки из API...');

        // Загружаем свежие данные из API
        const settings = await this.loadProjectSettingsSimple();

        // Сохраняем в кэш с timestamp последней загрузки
        // Уменьшили TTL до 5 минут для быстрого обновления стилей после изменений в админке
        this.cacheProjectSettings(settings, 5 * 60 * 1000); // 5 минут

        this.log('✅ Настройки загружены и сохранены в кэш:', settings);
        return settings;
      } catch (error) {
        this.log('❌ Ошибка загрузки настроек проекта:', error);
        // Возвращаем значения по умолчанию
        const defaultSettings = {
          welcomeBonusAmount: 500, // Базовое значение
          botUsername: null,
          widgetSettings: {}
        };
        this.log('🔄 Используем значения по умолчанию:', defaultSettings);
        return defaultSettings;
      }
    },

    // Проверяем, нужно ли форсировать обновление настроек
    shouldForceRefreshSettings: function () {
      try {
        const cacheKey = `tilda_bonus_${this.config.projectId}_settings`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return true; // Нет кэша - нужно загрузить

        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const timeSinceLastLoad = now - (cacheData.lastLoad || 0);

        // Форсируем обновление если прошло больше 30 секунд с момента последней загрузки из API
        // Это позволяет быстро увидеть изменения стилей после их обновления в админке
        // Увеличено до 30 секунд для снижения нагрузки на API
        return timeSinceLastLoad > 30 * 1000;
      } catch (error) {
        this.log('Ошибка проверки необходимости обновления настроек:', error);
        return true; // В случае ошибки - обновляем
      }
    },

    // Упрощенная загрузка настроек без лишних заголовков
    loadProjectSettingsSimple: async function () {
      try {
        const cacheBuster = Date.now();
        const url = `${this.config.apiUrl}/api/projects/${this.config.projectId}/bot?t=${cacheBuster}`;

        this.log('🔗 Запрос к API:', url);

        // Простой fetch без сложных заголовков
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        });

        this.log('📊 Ответ API:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (response.ok) {
          const data = await response.json();
          this.log('📦 Данные от API:', data);

          const processedData = {
            welcomeBonusAmount: Number(data?.welcomeBonusAmount || 500),
            botUsername: data?.botUsername || null,
            widgetSettings: data?.widgetSettings || null
          };

          this.log('🔧 Обработанные настройки для плашки:', processedData);

          return processedData;
        } else {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        this.log('🚨 Ошибка при запросе к API:', error);
        throw error;
      }
    },

    // Кэширование настроек проекта
    cacheProjectSettings: function (settings, ttlMs) {
      try {
        const cacheData = {
          settings: settings,
          timestamp: Date.now(), // Время создания кэша
          lastLoad: Date.now(), // Время последней загрузки из API
          ttl: ttlMs
        };
        localStorage.setItem(
          `tilda_bonus_${this.config.projectId}_settings`,
          JSON.stringify(cacheData)
        );
      } catch (error) {
        this.log('Ошибка сохранения настроек в кэш:', error);
      }
    },

    // Получение настроек из кэша
    getCachedProjectSettings: function () {
      try {
        const cacheKey = `tilda_bonus_${this.config.projectId}_settings`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        const now = Date.now();

        // Проверяем срок действия кэша
        if (now - cacheData.timestamp > cacheData.ttl) {
          localStorage.removeItem(cacheKey);
          return null;
        }

        return cacheData.settings;
      } catch (error) {
        this.log('Ошибка чтения настроек из кэша:', error);
        return null;
      }
    },

    // Отрисовка плашки регистрации
    renderRegistrationPrompt: function (settings) {
      try {
        this.log('🎨 Отрисовываем плашку регистрации с настройками:', settings);

        // Экранируем данные для безопасности
        const welcomeBonusAmount = Number(settings.welcomeBonusAmount || 500);
        const botUsername = String(settings.botUsername || '')
          .replace(/[<>'"&]/g, '') // Экранируем HTML
          .replace('@', ''); // Убираем @ из имени бота

        // Сохраняем настройки в state для использования в других частях виджета
        this.state.widgetSettings = settings.widgetSettings || {};
        this.state.botUsername = botUsername;

        // Применяем стили виджета сразу после загрузки настроек
        if (settings.widgetSettings) {
          this.applyWidgetStyles(settings.widgetSettings);
        }

        // Используем настройки шаблона или значения по умолчанию
        const widgetSettings = settings.widgetSettings || {};
        const templates = {
          registrationTitle:
            widgetSettings.registrationTitle ||
            'Зарегистрируйся и получи {bonusAmount} бонусов!',
          registrationDescription:
            widgetSettings.registrationDescription ||
            'Зарегистрируйся в нашей бонусной программе',
          registrationButtonText:
            widgetSettings.registrationButtonText || 'Зарегистрироваться',
          registrationButtonUrl: widgetSettings.registrationButtonUrl || '', // Кастомная ссылка
          registrationFallbackText:
            widgetSettings.registrationFallbackText ||
            'Свяжитесь с администратором для регистрации'
        };

        this.log('🔧 Обработанные данные:', {
          welcomeBonusAmount,
          botUsername
        });

        // Ищем контейнер поля промокода (плашка показывается ВМЕСТО виджета)
        const promocodeWrapper = document.querySelector(
          '.t-inputpromocode__wrapper'
        );
        if (!promocodeWrapper) {
          console.error('❌ Контейнер поля промокода не найден');
          return;
        }

        // Удаляем существующую плашку
        const existingPrompt = promocodeWrapper.parentNode.querySelector(
          '.registration-prompt-inline'
        );
        if (existingPrompt) {
          existingPrompt.remove();
        }

        // Создаем плашку регистрации
        const promptDiv = document.createElement('div');
        promptDiv.className = 'registration-prompt-inline';
        // Используем стилевые настройки или значения по умолчанию
        const styles = {
          // Цветовые настройки
          backgroundColor: widgetSettings?.backgroundColor || '#667eea',
          backgroundGradient: widgetSettings?.backgroundGradient || '#764ba2',
          textColor: widgetSettings?.textColor || '#ffffff',
          titleColor: widgetSettings?.titleColor || '#ffffff',
          descriptionColor: widgetSettings?.descriptionColor || '#ffffff',
          fallbackTextColor: widgetSettings?.fallbackTextColor || '#ffffff',
          buttonTextColor: widgetSettings?.buttonTextColor || '#ffffff',
          buttonBackgroundColor:
            widgetSettings?.buttonBackgroundColor || 'rgba(255,255,255,0.2)',
          buttonBorderColor:
            widgetSettings?.buttonBorderColor || 'rgba(255,255,255,0.3)',
          buttonHoverColor:
            widgetSettings?.buttonHoverColor || 'rgba(255,255,255,0.3)',
          fallbackBackgroundColor:
            widgetSettings?.fallbackBackgroundColor || 'rgba(0,0,0,0.1)',

          // Размеры и отступы
          borderRadius: widgetSettings?.borderRadius || '12px',
          padding: widgetSettings?.padding || '16px',
          marginBottom: widgetSettings?.marginBottom || '12px',
          iconSize: widgetSettings?.iconSize || '24px',
          titleFontSize: widgetSettings?.titleFontSize || '18px',
          titleFontWeight: widgetSettings?.titleFontWeight || 'bold',
          descriptionFontSize: widgetSettings?.descriptionFontSize || '14px',
          buttonFontSize: widgetSettings?.buttonFontSize || '14px',
          buttonFontWeight: widgetSettings?.buttonFontWeight || '500',
          buttonPadding: widgetSettings?.buttonPadding || '8px 16px',
          buttonBorderRadius: widgetSettings?.buttonBorderRadius || '6px',
          fallbackFontSize: widgetSettings?.fallbackFontSize || '14px',
          fallbackPadding: widgetSettings?.fallbackPadding || '8px',
          fallbackBorderRadius: widgetSettings?.fallbackBorderRadius || '4px',

          // Эффекты и тени
          boxShadow: widgetSettings?.boxShadow || '0 4px 6px rgba(0,0,0,0.1)',
          buttonBoxShadow: widgetSettings?.buttonBoxShadow || 'none',
          iconAnimation: widgetSettings?.iconAnimation || 'jump', // По умолчанию: Прыжок (Jump)

          // Эмодзи и иконки
          iconEmoji: widgetSettings?.iconEmoji || '🎁',
          iconColor: widgetSettings?.iconColor || '#ffffff',

          // Шрифты
          fontFamily:
            widgetSettings?.fontFamily ||
            'system-ui, -apple-system, sans-serif',

          // Дополнительные настройки
          maxWidth: widgetSettings?.maxWidth || '100%',
          textAlign: widgetSettings?.textAlign || 'center',
          buttonWidth: widgetSettings?.buttonWidth || 'auto',
          buttonDisplay: widgetSettings?.buttonDisplay || 'inline-block',
          fontSize: widgetSettings?.fontSize || '14px'
        };

        // Собираем HTML для плашки с учетом настроек видимости
        let htmlContent = `
          <div class="registration-prompt" style="
            background: linear-gradient(135deg, ${styles.backgroundColor} 0%, ${styles.backgroundGradient} 100%);
            color: ${styles.textColor};
            padding: ${styles.padding};
            border-radius: ${styles.borderRadius};
            margin-bottom: ${styles.marginBottom};
            text-align: ${styles.textAlign};
            box-shadow: ${styles.boxShadow};
            max-width: ${styles.maxWidth};
            font-size: ${styles.fontSize};
            font-family: ${styles.fontFamily};
          ">`;

        // Иконка
        if (widgetSettings.showIcon) {
          htmlContent += `
            <div class="registration-icon" style="
              font-size: ${styles.iconSize};
              margin-bottom: 8px;
              color: ${styles.iconColor};
              ${styles.iconAnimation !== 'none' ? 'animation: ' + styles.iconAnimation + ' 2s infinite;' : ''}
            ">${styles.iconEmoji}</div>`;
        }

        // Заголовок
        if (widgetSettings.showTitle) {
          htmlContent += `
            <div class="registration-title" style="
              font-size: ${styles.titleFontSize};
              font-weight: ${styles.titleFontWeight};
              margin-bottom: 8px;
              color: ${styles.titleColor};
            ">${templates.registrationTitle.replace('{bonusAmount}', welcomeBonusAmount)}</div>`;
        }

        // Описание
        if (widgetSettings.showDescription) {
          htmlContent += `
            <div class="registration-description" style="
              font-size: ${styles.descriptionFontSize};
              margin-bottom: 12px;
              opacity: 0.9;
              color: ${styles.descriptionColor};
            ">${templates.registrationDescription}</div>`;
        }

        // Кнопка или текст без бота
        htmlContent += `<div class="registration-action">`;

        // Определяем ссылку для кнопки: кастомная ссылка или ссылка на бота
        const buttonUrl =
          templates.registrationButtonUrl ||
          (botUsername ? `https://t.me/${botUsername}` : null);

        if (widgetSettings.showButton && buttonUrl) {
          htmlContent += `
            <a href="${buttonUrl}" target="_blank" class="registration-button" style="
              display: ${styles.buttonDisplay};
              background: ${styles.buttonBackgroundColor};
              color: ${styles.buttonTextColor};
              padding: ${styles.buttonPadding};
              border-radius: ${styles.buttonBorderRadius};
              text-decoration: none;
              font-weight: ${styles.buttonFontWeight};
              font-size: ${styles.buttonFontSize};
              border: 1px solid ${styles.buttonBorderColor};
              width: ${styles.buttonWidth};
              box-shadow: ${styles.buttonBoxShadow};
              transition: all 0.3s ease;
            " onmouseover="this.style.background='${styles.buttonHoverColor}'" onmouseout="this.style.background='${styles.buttonBackgroundColor}'">
              ${templates.registrationButtonText}
            </a>`;
        } else if (widgetSettings.showFallbackText) {
          htmlContent += `
            <div style="
              font-size: ${styles.fallbackFontSize};
              color: ${styles.fallbackTextColor};
              background: ${styles.fallbackBackgroundColor};
              padding: ${styles.fallbackPadding};
              border-radius: ${styles.fallbackBorderRadius};
              opacity: 0.8;
            ">${templates.registrationFallbackText}</div>`;
        }

        htmlContent += `</div></div>`;

        promptDiv.innerHTML = htmlContent;

        // Добавляем плашку ПЕРЕД полем промокода
        promocodeWrapper.parentNode.insertBefore(promptDiv, promocodeWrapper);

        // Поле промокода остаётся видимым для неавторизованных (не скрываем его)
        promocodeWrapper.style.display = 'block';
        console.log(
          '✅ Плашка добавлена, поле промокода Tilda остаётся видимым'
        );

        this.log('✅ Плашка регистрации успешно отображена:', {
          welcomeBonusAmount,
          botUsername,
          hasButton: !!botUsername
        });
      } catch (error) {
        this.log('Ошибка показа плашки регистрации:', error);
      }
    },

    // Полностью скрыть/удалить виджет, если пользователь не найден/не авторизован
    removeWidget: function () {
      const container = document.querySelector('.bonus-widget-container');
      if (container && container.parentNode && this.state.promoWrapper) {
        // Восстанавливаем оригинальное поле промокода вместо виджета
        container.parentNode.replaceChild(this.state.promoWrapper, container);
        this.log('Виджет удалён, восстановлено поле промокода');
      } else if (container && container.parentNode) {
        // Если нет сохраненного promoWrapper, просто удаляем
        container.parentNode.removeChild(container);
        this.log('Виджет удалён (без восстановления поля промокода)');
      }
    },

    // Поиск места для вставки виджета
    findInsertPoint: function () {
      // Ищем блок с итоговой суммой или кнопку оформления
      const selectors = [
        '.t706__cartwin-promocode',
        '.t706__promocode',
        '.t706__cartwin-totalamount',
        '.t706__cartwin-bottom',
        '.t-form__submit',
        '[href*="tilda.cc/rec"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      }

      return null;
    },

    // Наблюдение за корзиной (без тяжёлого отслеживания style по всему документу)
    observeCart: function () {
      const attachCartObserver = () => {
        const cartWindow = this.getCachedElement('.t706__cartwin');
        if (!cartWindow) return false;
        const onChange = () => {
          const isOpen = cartWindow.style.display !== 'none';
          if (isOpen) this.onCartOpenDebounced();
        };
        // первичная проверка состояния
        onChange();
        this.state._cartObserver = new MutationObserver(onChange);
        this.state._cartObserver.observe(cartWindow, {
          attributes: true,
          attributeFilter: ['style']
        });
        return true;
      };

      if (!attachCartObserver()) {
        this.state._bodyObserver = new MutationObserver(() => {
          if (attachCartObserver() && this.state._bodyObserver) {
            this.state._bodyObserver.disconnect();
            this.state._bodyObserver = null;
          }
        });
        this.state._bodyObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      // Сохраняем ссылку на this для использования в event listener'ах
      const self = this;

      // Слушаем события обновления корзины Tilda
      document.addEventListener('tcart:updated', (event) => {
        self.log('🚨 КРИТИЧНО: Получено событие tcart:updated');

        // НЕМЕДЛЕННО удаляем промокод если были применены бонусы
        if (
          self.state.appliedBonuses > 0 &&
          window.tcart &&
          window.tcart.promocode
        ) {
          delete window.tcart.promocode;
          self.log(
            '✅ НЕМЕДЛЕННО удален window.tcart.promocode при tcart:updated'
          );
        }

        // Автоматически корректируем бонусы при изменении корзины
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateBalanceDisplay();
        }, 100);
      });

      // Слушаем события изменения количества товаров
      document.addEventListener('click', (event) => {
        // Логируем только в режиме отладки
        if (this.config.debug) {
          this.log('Клик обнаружен:', event.target.className);
        }

        if (
          event.target.closest(
            '.t706__product-plus, .t706__product-minus, .t706__product-del'
          )
        ) {
          console.log(
            '🎯 TildaBonusWidget: КЛИК ПО КНОПКЕ ИЗМЕНЕНИЯ КОЛИЧЕСТВА!'
          );
          self.log('🚨 КРИТИЧНО: Клик по кнопке изменения количества товара');
          self.log('🔥 НЕМЕДЛЕННО удаляем промокод');

          // НЕМЕДЛЕННО удаляем промокод при первом признаке изменения
          // Проверяем как наличие примененных бонусов в state, так и наличие промокода в tcart
          const hasAppliedBonuses = self.state.appliedBonuses > 0;
          const hasPromocode = window.tcart && window.tcart.promocode;

          if (hasAppliedBonuses || hasPromocode) {
            console.log(
              '🎯 TildaBonusWidget: Есть примененные бонусы или промокод, удаляем промокод',
              { hasAppliedBonuses, hasPromocode }
            );
            // Принудительно удаляем промокод БЕЗ задержки
            if (window.tcart && window.tcart.promocode) {
              console.log(
                '🎯 TildaBonusWidget: Найден промокод, удаляем:',
                window.tcart.promocode
              );
              delete window.tcart.promocode;
              self.log('✅ НЕМЕДЛЕННО удален window.tcart.promocode');
              console.log(
                '🎯 TildaBonusWidget: Промокод удален из window.tcart'
              );
            } else {
              console.log(
                '🎯 TildaBonusWidget: Промокод не найден в window.tcart'
              );
            }
          } else {
            console.log(
              '🎯 TildaBonusWidget: Нет примененных бонусов и промокода, пропускаем удаление'
            );
          }

          setTimeout(() => {
            self.adjustBonusesForCartChange();
            self.updateCartTotalAndMaxBonuses();
            self.log('✅ Обновляем виджет после изменения количества товаров');
          }, 200);
        }
      });

      // Слушаем события изменения количества через API Tilda
      document.addEventListener('tcart:quantity:changed', (event) => {
        self.log('🚨 Получено событие tcart:quantity:changed');
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateCartTotalAndMaxBonuses();
          self.forceUpdateCartDisplay();
        }, 150);
      });

      // Слушаем события пересчета корзины
      document.addEventListener('tcart:recalculated', (event) => {
        self.log('🚨 Получено событие tcart:recalculated');
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateCartTotalAndMaxBonuses();
        }, 100);
      });

      // Добавляем MutationObserver для надежного отслеживания изменений корзины
      const observeCartChanges = () => {
        const cartWindow = document.querySelector('.t706__cartwin');
        if (cartWindow) {
          // Наблюдаем за изменениями в корзине
          const cartObserver = new MutationObserver((mutations) => {
            let shouldCheckBonuses = false;

            mutations.forEach((mutation) => {
              // Проверяем изменения в дочерних элементах
              if (
                mutation.type === 'childList' &&
                mutation.addedNodes.length > 0
              ) {
                // Проверим, добавились ли элементы, связанные с товарами или суммой
                Array.from(mutation.addedNodes).forEach((node) => {
                  if (
                    node.nodeType === 1 &&
                    (node.classList?.contains('t706__product') ||
                      node.classList?.contains('t706__cartwin-totalamount') ||
                      node.querySelector?.(
                        '.t706__product, .t706__cartwin-totalamount'
                      ))
                  ) {
                    shouldCheckBonuses = true;
                  }
                });
              }

              // Проверяем изменения атрибутов
              if (
                mutation.type === 'attributes' &&
                (mutation.attributeName === 'data-total' ||
                  mutation.attributeName === 'data-quantity')
              ) {
                shouldCheckBonuses = true;
              }
            });

            if (shouldCheckBonuses) {
              self.log(
                '🔄 Обнаружено изменение в корзине через MutationObserver'
              );
              setTimeout(() => {
                self.adjustBonusesForCartChange();
                self.updateCartTotalAndMaxBonuses();
              }, 200);
            }
          });

          cartObserver.observe(cartWindow, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-total', 'data-quantity', 'class']
          });

          self.log('✅ MutationObserver для корзины установлен');
        }
      };

      // Запускаем наблюдение за корзиной
      observeCartChanges();
    },

    onCartOpenDebounced: function () {
      if (this.state.cartOpenDebounceTimer)
        clearTimeout(this.state.cartOpenDebounceTimer);
      this.state.cartOpenDebounceTimer = setTimeout(() => {
        try {
          this.onCartOpen();
        } catch (e) {
          this.log('onCartOpen error', e);
        }
      }, 250);
    },

    // Обработка открытия корзины
    onCartOpen: function () {
      this.log('Корзина открыта');

      // Обновляем изначальную сумму корзины при открытии
      const currentTotal = this.getCartTotal();
      if (currentTotal > 0 && this.state.originalCartTotal === 0) {
        this.state.originalCartTotal = currentTotal;
        this.log(
          'Установлена изначальная сумма корзины:',
          this.state.originalCartTotal
        );
      }

      // Определяем текущее состояние авторизации и показываем соответствующий UI
      this.updateWidgetState();
    },

    // Определяет и обновляет состояние виджета на основе данных пользователя
    updateWidgetState: function () {
      // Сначала проверяем tilda_members_profile из window или localStorage
      let profile = null;
      if (typeof window !== 'undefined' && window.tilda_members_profile) {
        profile = window.tilda_members_profile;
      } else if (this.config && this.config.projectId) {
        // Проверяем localStorage по projectId
        try {
          const localStorageKey = `tilda_members_profile${this.config.projectId}`;
          const profileFromStorage = localStorage.getItem(localStorageKey);
          if (profileFromStorage) {
            try {
              profile = JSON.parse(profileFromStorage);
              this.log(
                '📦 Профиль загружен из localStorage в updateWidgetState:',
                localStorageKey
              );
            } catch (parseError) {
              this.log('⚠️ Ошибка парсинга профиля:', parseError);
            }
          } else {
            // Пробуем найти любой ключ с tilda_members_profile
            const legacyKeys = Object.keys(localStorage).filter(
              (key) =>
                key.startsWith('tilda_members_profile') &&
                !key.includes('_timestamp')
            );
            if (legacyKeys.length > 0) {
              const legacyKey = legacyKeys[0];
              const legacyProfile = localStorage.getItem(legacyKey);
              if (legacyProfile) {
                try {
                  profile = JSON.parse(legacyProfile);
                  this.log(
                    '📦 Профиль загружен из localStorage (legacy) в updateWidgetState:',
                    legacyKey
                  );
                } catch (parseError) {
                  this.log('⚠️ Ошибка парсинга legacy профиля:', parseError);
                }
              }
            }
          }
        } catch (error) {
          this.log('⚠️ Ошибка чтения профиля из localStorage:', error);
        }
      }

      if (profile) {
        try {
          const email =
            profile.login && profile.login.trim() ? profile.login.trim() : null;
          const phone =
            profile.phone && profile.phone.trim() ? profile.phone.trim() : null;

          // Обновляем state если данные есть и еще не сохранены или изменились
          if (email && email !== this.state.userEmail) {
            this.state.userEmail = email;
            this.safeSetStorage('tilda_user_email', email);
            this.log(
              '📧 Обновлен email из tilda_members_profile в updateWidgetState'
            );
          }
          if (phone && phone !== this.state.userPhone) {
            this.state.userPhone = phone;
            this.safeSetStorage('tilda_user_phone', phone);
            this.log(
              '📱 Обновлен phone из tilda_members_profile в updateWidgetState'
            );
          }
          if (
            !email &&
            this.state.userEmail &&
            !localStorage.getItem('tilda_user_email')
          ) {
            this.state.userEmail = null;
          }
          if (
            !phone &&
            this.state.userPhone &&
            !localStorage.getItem('tilda_user_phone')
          ) {
            this.state.userPhone = null;
          }
        } catch (error) {
          this.log(
            '⚠️ Ошибка проверки tilda_members_profile в updateWidgetState:',
            error
          );
        }
      }

      // Проверяем данные в состоянии виджета (загруженные из localStorage)
      const hasStoredData = this.state.userEmail || this.state.userPhone;

      // Также проверяем данные через getUserContact() для дополнительной валидации
      const userContact = this.getUserContact();

      if (
        hasStoredData ||
        (userContact && (userContact.email || userContact.phone))
      ) {
        // У пользователя есть контактные данные - показываем виджет с балансом
        this.log('✅ Пользователь авторизован - показываем виджет с балансом', {
          hasStoredData,
          userContact: userContact
            ? {
                hasEmail: !!userContact.email,
                hasPhone: !!userContact.phone
              }
            : null
        });
        this.hideRegistrationPrompt();
        this.ensureWidgetMounted();

        // Применяем стили виджета для авторизованного пользователя
        // Загружаем настройки проекта если они еще не загружены
        if (
          !this.state.widgetSettings ||
          Object.keys(this.state.widgetSettings).length === 0
        ) {
          this.loadProjectSettingsForPrompt()
            .then((settings) => {
              this.state.widgetSettings = settings.widgetSettings || {};
              if (settings.widgetSettings) {
                this.applyWidgetStyles(settings.widgetSettings);
              }
            })
            .catch((error) => {
              this.log('Не удалось загрузить настройки виджета:', error);
            });
        } else {
          // Если настройки уже загружены, применяем их
          this.applyWidgetStyles(this.state.widgetSettings);
        }

        this.loadUserBalance(
          userContact || {
            email: this.state.userEmail,
            phone: this.state.userPhone
          }
        );
      } else {
        // У пользователя нет контактных данных - показываем плашку регистрации
        this.log(
          '❌ Пользователь не авторизован - показываем плашку регистрации'
        );
        this.removeWidget();
        this.showRegistrationPrompt();
      }
    },

    // Переключение режима: бонусы | промокод
    switchMode: function (mode) {
      console.log('🔄 switchMode: переключение на режим', mode);
      this.state.mode = mode === 'promo' ? 'promo' : 'bonus';

      const bonusTab = document.getElementById('bonus-tab');
      const promoTab = document.getElementById('promo-tab');
      const bonusContentArea = document.getElementById('bonus-content-area');
      const tildaPromoWrapper =
        this.state.promoWrapper ||
        document.querySelector('.t-inputpromocode__wrapper');

      if (!bonusTab || !promoTab) {
        console.warn('⚠️ switchMode: не найдены табы');
        return;
      }

      // Сохраняем оригинальные стили поля промокода при первом обращении
      this.capturePromoWrapperStyles(tildaPromoWrapper);

      // Очищаем промокод из window.tcart при переключении
      if (typeof window.tcart !== 'undefined' && window.tcart.promocode) {
        delete window.tcart.promocode;
        console.log('🧹 switchMode: очищен window.tcart.promocode');

        // Пересчитываем корзину
        if (typeof window.tcart__reDrawTotal === 'function') {
          try {
            window.tcart__reDrawTotal();
          } catch (e) {}
        }
      }

      if (this.state.mode === 'promo') {
        // Переключаемся на режим промокода Tilda
        console.log('🎫 switchMode: режим промокода');
        bonusTab.classList.remove('active');
        promoTab.classList.add('active');

        // Скрываем весь контент бонусов
        if (bonusContentArea) {
          bonusContentArea.style.display = 'none';
          console.log('✅ switchMode: скрыт bonus-content-area');
        }

        if (tildaPromoWrapper) {
          this.showTildaPromocodeField(tildaPromoWrapper);
        } else {
          console.warn(
            '⚠️ switchMode: поле промокода Tilda не найдено (.t-inputpromocode__wrapper)'
          );
        }
      } else {
        // Переключаемся на режим бонусов
        console.log('💰 switchMode: режим бонусов');
        promoTab.classList.remove('active');
        bonusTab.classList.add('active');

        // Показываем контент бонусов
        if (bonusContentArea) {
          bonusContentArea.style.display = 'block';
          console.log('✅ switchMode: показан bonus-content-area');
        }

        if (tildaPromoWrapper) {
          this.hideTildaPromocodeField(tildaPromoWrapper);
        }
      }

      // Сбрасываем применённые бонусы
      this.resetAppliedBonuses();
    },

    // Отслеживание авторизации Tilda
    observeTildaAuth: function () {
      const self = this;

      // Проверяем наличие tilda_members_profile при загрузке
      const checkTildaProfile = () => {
        let profile = null;

        // 1. Проверяем window.tilda_members_profile
        if (typeof window !== 'undefined' && window.tilda_members_profile) {
          profile = window.tilda_members_profile;
          self.log('✅ Найден window.tilda_members_profile');
        }

        // 2. Если window недоступен, проверяем localStorage по projectId
        if (!profile && self.config && self.config.projectId) {
          try {
            const localStorageKey = `tilda_members_profile${self.config.projectId}`;
            const profileFromStorage = localStorage.getItem(localStorageKey);
            if (profileFromStorage) {
              try {
                profile = JSON.parse(profileFromStorage);
                self.log('✅ Найден профиль в localStorage:', localStorageKey);
              } catch (parseError) {
                self.log(
                  '⚠️ Ошибка парсинга профиля из localStorage:',
                  parseError
                );
              }
            } else {
              // Пробуем найти любой ключ с tilda_members_profile
              const legacyKeys = Object.keys(localStorage).filter(
                (key) =>
                  key.startsWith('tilda_members_profile') &&
                  !key.includes('_timestamp')
              );
              if (legacyKeys.length > 0) {
                const legacyKey = legacyKeys[0];
                const legacyProfile = localStorage.getItem(legacyKey);
                if (legacyProfile) {
                  try {
                    profile = JSON.parse(legacyProfile);
                    self.log(
                      '✅ Найден профиль в localStorage (legacy):',
                      legacyKey
                    );
                  } catch (parseError) {
                    self.log('⚠️ Ошибка парсинга legacy профиля:', parseError);
                  }
                }
              }
            }
          } catch (error) {
            self.log('⚠️ Ошибка чтения профиля из localStorage:', error);
          }
        }

        // 3. Обрабатываем найденный профиль
        if (profile) {
          try {
            // Очищаем email и phone от пустых строк
            const email =
              profile.login && profile.login.trim()
                ? profile.login.trim()
                : null;
            const phone =
              profile.phone && profile.phone.trim()
                ? profile.phone.trim()
                : null;

            if (email || phone) {
              const currentEmail =
                self.state.userEmail ||
                localStorage.getItem('tilda_user_email') ||
                null;
              const currentPhone =
                self.state.userPhone ||
                localStorage.getItem('tilda_user_phone') ||
                null;

              // Проверяем, изменились ли данные (с учетом null и пустых строк)
              const emailChanged =
                email !== currentEmail && (email || currentEmail);
              const phoneChanged =
                phone !== currentPhone && (phone || currentPhone);

              // Если данные изменились или еще не были сохранены
              if (
                emailChanged ||
                phoneChanged ||
                (!currentEmail && !currentPhone && (email || phone))
              ) {
                self.log(
                  '🔄 Обнаружена авторизация Tilda через tilda_members_profile',
                  {
                    email: email ? email.substring(0, 3) + '***' : 'нет',
                    phone: phone ? phone.substring(0, 3) + '***' : 'нет',
                    hadEmail: !!currentEmail,
                    hadPhone: !!currentPhone
                  }
                );

                // Обновляем состояние
                if (email) {
                  self.state.userEmail = email;
                  self.safeSetStorage('tilda_user_email', email);
                } else {
                  // Если email пустой, очищаем из state и localStorage
                  self.state.userEmail = null;
                  localStorage.removeItem('tilda_user_email');
                }
                if (phone) {
                  self.state.userPhone = phone;
                  self.safeSetStorage('tilda_user_phone', phone);
                } else {
                  // Если phone пустой, очищаем из state и localStorage
                  self.state.userPhone = null;
                  localStorage.removeItem('tilda_user_phone');
                }

                // Обновляем виджет
                self.updateWidgetState();

                // Загружаем баланс
                if (email || phone) {
                  self.loadUserBalanceDebounced({
                    email: email || null,
                    phone: phone || null
                  });
                }
              } else {
                self.log('ℹ️ Данные tilda_members_profile не изменились');
              }
            } else {
              self.log('⚠️ tilda_members_profile не содержит email или phone');
            }
          } catch (error) {
            self.log('⚠️ Ошибка при проверке tilda_members_profile:', error);
          }
        } else {
          self.log(
            '⚠️ tilda_members_profile не доступен ни в window, ни в localStorage'
          );
          if (self.config && self.config.projectId) {
            self.log(
              '🔍 Искали в localStorage с ключом:',
              `tilda_members_profile${self.config.projectId}`
            );
          }
        }
      };

      // Проверяем сразу при инициализации
      checkTildaProfile();

      // Отслеживаем изменения window.tilda_members_profile через MutationObserver
      if (typeof window !== 'undefined') {
        let lastProfile = null;

        const observeProfile = () => {
          try {
            const currentProfile = window.tilda_members_profile;

            if (currentProfile) {
              // Очищаем значения от пустых строк для сравнения
              const currentLogin =
                currentProfile.login && currentProfile.login.trim()
                  ? currentProfile.login.trim()
                  : null;
              const currentPhone =
                currentProfile.phone && currentProfile.phone.trim()
                  ? currentProfile.phone.trim()
                  : null;
              const lastLogin =
                lastProfile?.login && lastProfile.login.trim()
                  ? lastProfile.login.trim()
                  : null;
              const lastPhone =
                lastProfile?.phone && lastProfile.phone.trim()
                  ? lastProfile.phone.trim()
                  : null;

              // Сравниваем только login и phone (с учетом null)
              if (currentLogin !== lastLogin || currentPhone !== lastPhone) {
                self.log(
                  '🔄 Обнаружено изменение window.tilda_members_profile'
                );
                checkTildaProfile();
                lastProfile = {
                  login: currentProfile.login || '',
                  phone: currentProfile.phone || ''
                };
              }
            } else if (lastProfile) {
              // Профиль был, но теперь его нет - очищаем состояние
              self.log('🔄 window.tilda_members_profile удален');
              self.state.userEmail = null;
              self.state.userPhone = null;
              localStorage.removeItem('tilda_user_email');
              localStorage.removeItem('tilda_user_phone');
              self.updateWidgetState();
              lastProfile = null;
            }
          } catch (error) {
            // Игнорируем ошибки
          }
        };

        // Проверяем периодически (каждые 2 секунды)
        const profileCheckInterval = setInterval(() => {
          if (!self.state.isDestroyed) {
            observeProfile();
          } else {
            clearInterval(profileCheckInterval);
          }
        }, 2000);

        // Сохраняем интервал для очистки
        if (!self.state.intervals) {
          self.state.intervals = [];
        }
        self.state.intervals.push(profileCheckInterval);
      }

      // Отслеживаем события storage (localStorage/cookies изменения)
      if (typeof window !== 'undefined' && window.addEventListener) {
        const storageHandler = (e) => {
          // Проверяем изменения в localStorage связанные с авторизацией Tilda
          if (
            e.key === 'tilda_user_email' ||
            e.key === 'tilda_user_phone' ||
            !e.key
          ) {
            self.log('🔄 Обнаружено изменение в localStorage');
            setTimeout(() => {
              self.updateWidgetState();
            }, 100);
          }
        };

        window.addEventListener('storage', storageHandler);

        // Сохраняем обработчик для удаления
        if (!self.state.eventListeners) {
          self.state.eventListeners = [];
        }
        self.state.eventListeners.push({
          element: window,
          event: 'storage',
          handler: storageHandler
        });
      }

      // Отслеживаем открытие корзины (когда пользователь может авторизоваться)
      const cartWindow = document.querySelector('.t706__cartwin');
      if (cartWindow) {
        const cartObserver = self.createObserver(
          () => {
            // При открытии корзины проверяем авторизацию
            if (
              cartWindow.style.display !== 'none' &&
              cartWindow.offsetParent !== null
            ) {
              setTimeout(() => {
                checkTildaProfile();
              }, 500);
            }
          },
          {
            attributes: true,
            attributeFilter: ['style', 'class']
          }
        );

        if (cartObserver) {
          cartObserver.observe(cartWindow, {
            attributes: true,
            attributeFilter: ['style', 'class']
          });
        }
      }

      self.log('✅ Отслеживание авторизации Tilda настроено');
    },

    // Наблюдение за вводом пользователя
    observeUserInput: function () {
      // Отслеживаем изменения в полях email и телефона
      document.addEventListener('input', (e) => {
        if (
          e.target.type === 'email' ||
          e.target.name === 'email' ||
          e.target.type === 'tel' ||
          e.target.name === 'phone'
        ) {
          this.onUserInputChange(e.target);
        }
      });

      // Отслеживаем клики по кнопке выхода
      document.addEventListener('click', (e) => {
        if (
          e.target.classList.contains('t706__auth__log-in-btn') ||
          e.target.classList.contains('js-cart-log-out') ||
          e.target.closest('.t706__auth__log-in-btn') ||
          e.target.closest('.js-cart-log-out')
        ) {
          this.log('🚪 Обнаружен клик по кнопке выхода');
          this.onUserLogout();
        }
      });
    },

    // Обработка выхода пользователя
    onUserLogout: function () {
      this.log('👋 Пользователь выходит из аккаунта');

      // Очищаем данные пользователя
      this.state.userEmail = '';
      this.state.userPhone = '';
      this.state.bonusBalance = 0;
      this.state.appliedBonuses = 0;

      // Очищаем localStorage
      localStorage.removeItem('tilda_user_email');
      localStorage.removeItem('tilda_user_phone');
      localStorage.removeItem('tilda_applied_bonuses');

      // Сбрасываем промокоды
      this.clearAllPromocodes();

      // Удаляем виджет перед показом плашки
      this.removeWidget();

      // Показываем плашку регистрации
      setTimeout(() => {
        this.showRegistrationPrompt();
      }, 100); // Небольшая задержка для корректного переключения

      this.log(
        '✅ Данные пользователя очищены, виджет удален, показана плашка регистрации'
      );
    },

    // Обработка изменения данных пользователя
    onUserInputChange: function (input) {
      const value = input.value.trim();
      if (!value) return;

      let hasNewData = false;

      if (input.type === 'email' || input.name === 'email') {
        if (this.state.userEmail !== value) {
          this.state.userEmail = value;
          localStorage.setItem('tilda_user_email', value);
          hasNewData = true;
        }
      } else if (input.type === 'tel' || input.name === 'phone') {
        if (this.state.userPhone !== value) {
          this.state.userPhone = value;
          localStorage.setItem('tilda_user_phone', value);
          hasNewData = true;
        }
      }

      // Обновляем состояние виджета только при изменении данных
      if (hasNewData) {
        this.log('📝 Новые контактные данные, обновляем состояние виджета');

        // Проверяем, показана ли сейчас плашка регистрации
        const registrationPrompt = document.querySelector(
          '.registration-prompt-inline'
        );
        if (registrationPrompt) {
          this.log('🔄 Переключаемся с плашки регистрации на виджет');
          this.hideRegistrationPrompt();
          this.ensureWidgetMounted();
        }

        // Обновляем состояние виджета
        this.updateWidgetState();

        // Загружаем баланс с дебаунсом (только если есть контактные данные)
        if (this.state.userEmail || this.state.userPhone) {
          this.loadUserBalanceDebounced({
            email: this.state.userEmail,
            phone: this.state.userPhone
          });
        }
      }
    },

    // Получение контактов пользователя
    getUserContact: function () {
      try {
        this.log('🔍 Ищем контактные данные пользователя...');

        // 1. Проверяем window.tilda_members_profile (приоритетно)
        let profile = null;
        if (typeof window !== 'undefined' && window.tilda_members_profile) {
          profile = window.tilda_members_profile;
          this.log('✅ Найден window.tilda_members_profile');
        }

        // 2. Если window.tilda_members_profile недоступен, проверяем localStorage
        // Tilda сохраняет профиль с ключом tilda_members_profile{projectId}
        if (!profile && this.config && this.config.projectId) {
          try {
            const localStorageKey = `tilda_members_profile${this.config.projectId}`;
            const profileFromStorage = localStorage.getItem(localStorageKey);
            if (profileFromStorage) {
              try {
                profile = JSON.parse(profileFromStorage);
                this.log('✅ Найден профиль в localStorage:', localStorageKey);
              } catch (parseError) {
                this.log(
                  '⚠️ Ошибка парсинга профиля из localStorage:',
                  parseError
                );
              }
            } else {
              // Также проверяем без projectId (старый формат)
              const legacyKeys = Object.keys(localStorage).filter((key) =>
                key.startsWith('tilda_members_profile')
              );
              if (legacyKeys.length > 0) {
                // Пробуем первый найденный ключ
                const legacyKey = legacyKeys[0];
                const legacyProfile = localStorage.getItem(legacyKey);
                if (legacyProfile) {
                  try {
                    profile = JSON.parse(legacyProfile);
                    this.log(
                      '✅ Найден профиль в localStorage (legacy):',
                      legacyKey
                    );
                  } catch (parseError) {
                    this.log('⚠️ Ошибка парсинга legacy профиля:', parseError);
                  }
                }
              }
            }
          } catch (error) {
            this.log('⚠️ Ошибка чтения профиля из localStorage:', error);
          }
        }

        // 3. Обрабатываем найденный профиль
        if (profile) {
          try {
            // Очищаем email и phone от пустых строк
            const email =
              profile.login && profile.login.trim()
                ? profile.login.trim()
                : null;
            const phone =
              profile.phone && profile.phone.trim()
                ? profile.phone.trim()
                : null;

            if (email || phone) {
              this.log('✅ Найдены контакты в window.tilda_members_profile:', {
                hasEmail: !!email,
                hasPhone: !!phone,
                emailValue: email ? email.substring(0, 3) + '***' : 'пусто',
                phoneValue: phone ? phone.substring(0, 3) + '***' : 'пусто'
              });

              // Сохраняем в localStorage для последующего использования
              if (email) {
                this.state.userEmail = email;
                this.safeSetStorage('tilda_user_email', email);
              } else {
                // Если email пустой, очищаем из state и localStorage
                this.state.userEmail = null;
                localStorage.removeItem('tilda_user_email');
              }
              if (phone) {
                this.state.userPhone = phone;
                this.safeSetStorage('tilda_user_phone', phone);
              } else {
                // Если phone пустой, очищаем из state и localStorage
                this.state.userPhone = null;
                localStorage.removeItem('tilda_user_phone');
              }

              return { email, phone };
            }
          } catch (error) {
            this.log('⚠️ Ошибка чтения tilda_members_profile:', error);
          }
        }

        // 2. Из localStorage
        const savedEmail = localStorage.getItem('tilda_user_email');
        const savedPhone = localStorage.getItem('tilda_user_phone');

        if (savedEmail || savedPhone) {
          this.log('📦 Найдены сохраненные контакты в localStorage:', {
            hasEmail: !!savedEmail,
            hasPhone: !!savedPhone
          });
          return { email: savedEmail, phone: savedPhone };
        }

        // 3. Из полей формы
        const emailField = document.querySelector(
          'input[name="email"], input[type="email"], input[name="Email"]'
        );
        const phoneField = document.querySelector(
          'input[name="phone"], input[type="tel"], input[name="Phone"], input[name="tildaspec-phone-part"]'
        );

        const email = emailField ? emailField.value.trim() : null;
        const phone = phoneField ? phoneField.value.trim() : null;

        this.log('🔍 Поиск в полях формы:', {
          emailField: !!emailField,
          phoneField: !!phoneField,
          hasEmail: !!(email && email.length > 0),
          hasPhone: !!(phone && phone.length > 0),
          emailValue: email ? email.substring(0, 3) + '***' : 'пусто',
          phoneValue: phone ? phone.substring(0, 3) + '***' : 'пусто'
        });

        if ((email && email.length > 0) || (phone && phone.length > 0)) {
          this.log('✅ Найдены контакты в полях формы');
          return { email, phone };
        }

        this.log('❌ Контактные данные не найдены');
        return null;
      } catch (error) {
        this.log('❌ Ошибка получения контактов:', error);
        return null;
      }
    },

    // Дебаунс-обёртка для загрузки баланса
    loadUserBalanceDebounced: function (contact) {
      if (this.state.balanceDebounceTimer) {
        clearTimeout(this.state.balanceDebounceTimer);
      }
      this.state.balanceDebounceTimer = setTimeout(() => {
        this.loadUserBalance(contact);
      }, this.config.debounceMs);
    },

    // Загрузка баланса пользователя
    loadUserBalance: async function (contact) {
      if (!contact || (!contact.email && !contact.phone)) return;

      try {
        this.showLoading(true);
        // Отменяем предыдущий запрос, если он ещё активен
        if (this.state.activeFetchController) {
          try {
            this.state.activeFetchController.abort();
          } catch (_) {}
        }
        const controller = new AbortController();
        this.state.activeFetchController = controller;

        const params = new URLSearchParams();
        if (contact.email) params.append('email', contact.email);
        if (contact.phone) params.append('phone', contact.phone);

        const data = await this.makeApiRequest(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/users/balance?${params}`
        );

        if (!data) return; // Request was aborted or failed

        if (data && data.success && data.user) {
          // Пользователь найден — монтируем виджет при необходимости и обновляем
          if (this.ensureWidgetMounted()) {
            // Всегда обновляем баланс из API, даже если он 0
            this.state.bonusBalance = Number(data.balance) || 0;
            this.state.levelInfo = data.levelInfo || null;

            this.log('📊 Баланс загружен из API:', {
              balance: this.state.bonusBalance,
              telegramLinked: data.user.telegramLinked,
              userId: data.user.id
            });

            // Применяем кастомные стили виджета если есть
            if (this.state.widgetSettings) {
              this.applyWidgetStyles(this.state.widgetSettings);
            }

            // Синхронизируем статус Telegram из API с localStorage
            if (data.user.telegramLinked) {
              this.safeSetStorage('tilda_telegram_linked', 'true');
              if (data.user.telegramId) {
                this.safeSetStorage(
                  'tilda_telegram_id',
                  String(data.user.telegramId)
                );
              }
              if (data.user.telegramUsername) {
                this.safeSetStorage(
                  'tilda_telegram_username',
                  data.user.telegramUsername
                );
              }
              this.log('✅ Синхронизирован статус Telegram из API');
            } else {
              // Если API говорит что не привязан, очищаем localStorage
              localStorage.removeItem('tilda_telegram_linked');
              localStorage.removeItem('tilda_telegram_id');
              localStorage.removeItem('tilda_telegram_username');
              this.log('⚠️ Telegram не привязан к аккаунту');
            }

            // Обновляем изначальную сумму корзины, если она ещё не установлена
            const currentTotal = this.getCartTotal();
            if (currentTotal > 0 && this.state.originalCartTotal === 0) {
              this.state.originalCartTotal = currentTotal;
              this.log(
                'Установлена изначальная сумма корзины при загрузке баланса:',
                this.state.originalCartTotal
              );
            }

            // Обновляем отображение баланса
            this.updateBalanceDisplay();

            // Обновляем UI виджета для правильного отображения статуса верификации
            // НЕ вызываем loadUserBalance снова, т.к. баланс уже загружен
            this.showWidgetControls();

            this.log(
              '✅ Баланс успешно загружен и применен:',
              this.state.bonusBalance,
              'Уровень:',
              this.state.levelInfo
            );
          }
        } else {
          // Пользователь не найден/не авторизован
          this.log('❌ Пользователь не найден в системе:', {
            hasData: !!data,
            success: data?.success,
            hasUser: !!data?.user,
            error: data?.error,
            details: data?.details
          });

          // Очищаем старые данные баланса
          this.state.bonusBalance = 0;
          this.updateBalanceDisplay();

          // Показываем плашку с приглашением зарегистрироваться
          // Пользователь не найден в системе бонусов - нужно зарегистрироваться через бота
          this.showRegistrationPrompt();
        }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          this.log('Запрос баланса отменён (новый ввод)');
        } else {
          this.log('Ошибка загрузки баланса:', error);

          // Проверяем, является ли это ошибкой 404 (пользователь не найден)
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes('404')) {
            this.log(
              '🔔 Пользователь не найден в системе (404), показываем плашку регистрации'
            );
            // Очищаем старые данные баланса
            this.state.bonusBalance = 0;
            this.updateBalanceDisplay();
            // Показываем плашку с приглашением зарегистрироваться
            this.showRegistrationPrompt();
          }
        }
      } finally {
        this.showLoading(false);
      }
    },

    // Обновление отображения баланса
    // Автоматическая корректировка бонусов при изменении корзины
    adjustBonusesForCartChange: function () {
      try {
        this.log('🔍 Проверяем необходимость корректировки бонусов');

        // Если нет примененных бонусов, ничего не делаем
        if (this.state.appliedBonuses <= 0) {
          this.log('ℹ️ Нет примененных бонусов, пропускаем');
          return;
        }

        // Проверяем, изменилась ли корзина
        const currentTotal = this.getCartTotal();
        this.log(
          `💰 Текущая сумма корзины: ${currentTotal}, сохраненная: ${this.state.originalCartTotal}`
        );

        // Если сумма корзины не изменилась значительно, возможно ничего не произошло
        if (Math.abs(currentTotal - this.state.originalCartTotal) < 0.01) {
          this.log(
            'ℹ️ Сумма корзины не изменилась, проверяем другие признаки изменений'
          );
          // Все равно проверяем, может быть изменилось количество товаров
        }

        this.log(
          '🚨 Обнаружено изменение корзины с примененными бонусами - удаляем промокод'
        );

        // Принудительное удаление промокода из Tilda
        this.forceDeletePromocode();

        // Сбрасываем состояние бонусов
        this.state.appliedBonuses = 0;
        localStorage.setItem('tilda_applied_bonuses', '0');

        // Обновляем отображение
        this.updateBalanceDisplay();

        // Показываем уведомление пользователю
        this.showInfo(
          'Бонусы отменены из-за изменения корзины. Примените заново при необходимости.'
        );

        // Обновляем сохраненную сумму корзины
        this.state.originalCartTotal = currentTotal;

        this.log('✅ Промокод принудительно удален из-за изменения корзины');
      } catch (error) {
        this.log('❌ Ошибка при корректировке бонусов:', error);
      }
    },

    // Обновление суммы корзины и максимальной суммы бонусов при изменении корзины
    updateCartTotalAndMaxBonuses: function () {
      try {
        this.log('🔄 Обновляем сумму корзины и максимум бонусов');

        // Всегда обновляем originalCartTotal на текущую сумму корзины
        const currentTotal = this.getCartTotal();
        if (currentTotal > 0) {
          this.state.originalCartTotal = currentTotal;
          this.log(`💰 Обновлена сумма корзины: ${currentTotal}`);
        }

        // Обновляем отображение баланса и максимальную сумму
        this.updateBalanceDisplay();
        this.log('✅ Максимальная сумма бонусов обновлена');
      } catch (error) {
        this.log('❌ Ошибка при обновлении суммы корзины:', error);
      }
    },

    updateBalanceDisplay: function () {
      const balanceElement = document.querySelector('.bonus-balance');
      const balanceAmount = document.querySelector('.bonus-balance-amount');
      const amountInput = document.getElementById('bonus-amount-input');
      const applyButton = document.getElementById('apply-bonus-button');

      if (this.state.bonusBalance > 0) {
        balanceElement.style.display = 'block';
        balanceAmount.textContent = Number(this.state.bonusBalance).toFixed(2);
        amountInput.style.display = 'block';
        applyButton.style.display = 'block';

        // Устанавливаем максимум для input с учетом уровня пользователя
        // Используем изначальную сумму корзины для корректного расчета максимума
        const originalCartTotal = this.getOriginalCartTotal();
        let maxBonuses = Math.min(this.state.bonusBalance, originalCartTotal);

        // Применяем ограничение по уровню пользователя
        if (this.state.levelInfo && this.state.levelInfo.paymentPercent < 100) {
          const maxByLevel =
            (originalCartTotal * this.state.levelInfo.paymentPercent) / 100;
          maxBonuses = Math.min(maxBonuses, maxByLevel);
        }

        amountInput.max = maxBonuses.toFixed(2);
        const levelText =
          this.state.levelInfo && this.state.levelInfo.paymentPercent < 100
            ? ` (до ${this.state.levelInfo.paymentPercent}%)`
            : '';
        amountInput.placeholder = `Макс: ${maxBonuses.toFixed(2)} бонусов${levelText}`;
      } else {
        balanceElement.style.display = 'none';
        amountInput.style.display = 'none';
        applyButton.style.display = 'none';
      }
    },

    // Получение текущей суммы корзины
    getCartTotal: function () {
      // Ищем элемент с общей суммой
      const totalElement = document.querySelector(
        '.t706__cartwin-totalamount-withoutdelivery, .t706__cartwin-totalamount'
      );
      if (totalElement) {
        const totalText = totalElement.textContent || '';
        const total = parseFloat(
          totalText.replace(/[^\d.,]/g, '').replace(',', '.')
        );
        return isNaN(total) ? 0 : Number(total.toFixed(2));
      }
      return 0;
    },

    // Получение изначальной суммы корзины (без примененных скидок/бонусов)
    getOriginalCartTotal: function () {
      // Если у нас есть сохраненная изначальная сумма, используем её
      if (this.state.originalCartTotal > 0) {
        return this.state.originalCartTotal;
      }

      // Иначе пытаемся получить текущую сумму корзины
      const currentTotal = this.getCartTotal();

      // Если бонусы уже применены, пытаемся вычислить изначальную сумму
      if (this.state.appliedBonuses > 0 && currentTotal > 0) {
        // Сохраняем текущую сумму как изначальную для будущих применений
        this.state.originalCartTotal = currentTotal + this.state.appliedBonuses;
        return this.state.originalCartTotal;
      }

      return currentTotal;
    },

    // Применение скидки через Tilda отключено в режиме бонусов — используйте вкладку «Промокод» для стандартного поведения
    applyDiscountViaTilda: function (_amountRubles) {
      return false;
    },

    // Применение промокода из поля ввода
    applyPromocode: function () {
      try {
        console.log('🎫 applyPromocode: НАЧАЛО');
        const input = document.getElementById('promo-code-input');
        console.log('📝 applyPromocode: input =', input);

        if (!input) {
          this.showError('Поле промокода не найдено');
          return;
        }

        const code = (input.value || '').trim();
        console.log('🔑 applyPromocode: code =', code);

        if (!code) {
          this.showError('Укажите промокод');
          return;
        }

        // Проверяем наличие функции Tilda
        if (typeof window.t_input_promocode__addPromocode !== 'function') {
          console.error(
            '❌ applyPromocode: функция t_input_promocode__addPromocode не найдена'
          );
          this.showError('Промокоды не поддерживаются в этой корзине');
          return;
        }

        console.log('✅ applyPromocode: применяем промокод через Tilda API');

        // Применяем промокод через Tilda API
        window.t_input_promocode__addPromocode({ promocode: code });

        // Пересчитываем корзину
        if (typeof window.tcart__calcPromocode === 'function') {
          window.tcart__calcPromocode();
          console.log('✅ applyPromocode: tcart__calcPromocode выполнен');
        }

        if (typeof window.tcart__reDrawTotal === 'function') {
          window.tcart__reDrawTotal();
          console.log('✅ applyPromocode: tcart__reDrawTotal выполнен');
        }

        if (typeof window.tcart__reDraw === 'function') {
          window.tcart__reDraw();
          console.log('✅ applyPromocode: tcart__reDraw выполнен');
        }

        this.showSuccess(`Промокод "${code}" применён`);
        console.log('✅ applyPromocode: УСПЕХ');
      } catch (e) {
        console.error('❌ applyPromocode: ошибка', e);
        this.showError('Ошибка применения промокода');
      }
    },

    // Очистка и повторное применение бонусов
    reapplyBonuses: function () {
      try {
        const currentAmount = this.state.appliedBonuses;
        if (currentAmount > 0) {
          this.log('Переприменяем бонусы:', currentAmount);

          // Полностью очищаем промокод и пересчитываем корзину
          this.clearAllPromocodes();

          // Ждем полной очистки, затем применяем бонусы заново
          setTimeout(() => {
            this.applyBonuses(currentAmount);
          }, 500); // Увеличиваем задержку
        }
      } catch (error) {
        this.log('Ошибка при переприменении бонусов:', error);
      }
    },

    // Переприменение бонусов с указанным количеством (для автоматической корректировки)
    reapplyBonusesWithAmount: function (amount) {
      try {
        if (amount <= 0) {
          this.clearAllPromocodes();
          return;
        }

        this.log('Переприменяем бонусы с количеством:', amount);

        // Полностью очищаем промокод и пересчитываем корзину
        this.clearAllPromocodes();

        // Ждем полной очистки, затем применяем бонусы заново с указанным количеством
        setTimeout(() => {
          this.applyBonusesDirect(amount);
        }, 500);
      } catch (error) {
        this.log('Ошибка при переприменении бонусов с количеством:', error);
      }
    },

    // Прямое применение бонусов без валидации (для автоматической корректировки)
    applyBonusesDirect: async function (amount) {
      try {
        this.showLoading(true);

        // Сохраняем примененные бонусы
        this.state.appliedBonuses = amount;
        localStorage.setItem('tilda_applied_bonuses', amount);

        // Добавляем скрытое поле с бонусами для отправки в webhook
        this.addHiddenBonusField(amount);

        // Применяем скидку через нативный механизм Тильды как промокод с фиксированным дискаунтом
        try {
          // Полностью очищаем все промокоды перед применением новых
          this.clearAllPromocodes();

          // Ждем очистки
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Применяем новый промокод с бонусами
          if (typeof window.t_input_promocode__addPromocode === 'function') {
            window.t_input_promocode__addPromocode({
              promocode: 'GUPIL',
              discountsum: amount
            });

            // Вызываем пересчет промокода
            if (typeof window.tcart__calcPromocode === 'function') {
              try {
                window.tcart__calcPromocode();
              } catch (_) {}
            }

            // Пересчитываем суммы с учетом скидок
            if (typeof window.tcart__calcAmountWithDiscounts === 'function') {
              try {
                window.tcart__calcAmountWithDiscounts();
              } catch (_) {}
            }

            // Полностью перерисовываем корзину
            if (typeof window.tcart__reDrawTotal === 'function') {
              try {
                window.tcart__reDrawTotal();
              } catch (_) {}
            }

            if (typeof window.tcart__reDraw === 'function') {
              try {
                window.tcart__reDraw();
              } catch (_) {}
            }
          } else {
            this.showError(
              'Не поддерживается применение промокодов в этой корзине'
            );
            return;
          }
        } catch (e) {
          this.log('applyPromocode error', e);
        }

        // Обновляем отображение
        this.updateBalanceDisplay();

        this.showLoading(false);
        this.showSuccess(`Применено ${amount} бонусов`);

        this.log('Бонусы успешно применены напрямую:', amount);
      } catch (error) {
        this.showLoading(false);
        this.showError('Ошибка применения бонусов');
        this.log('Ошибка прямого применения бонусов:', error);
      }
    },

    // Обновление скрытого поля с бонусами
    updateHiddenBonusField: function (amount) {
      try {
        // Удаляем старое поле
        const existingField = document.getElementById('tilda-applied-bonuses');
        if (existingField) {
          existingField.remove();
        }

        // Добавляем новое поле
        this.addHiddenBonusField(amount);
      } catch (error) {
        this.log('Ошибка обновления скрытого поля бонусов:', error);
      }
    },

    // Показ информационного сообщения
    showInfo: function (message) {
      try {
        // Создаем или обновляем информационное сообщение
        let infoElement = document.getElementById('bonus-info-message');
        if (!infoElement) {
          infoElement = document.createElement('div');
          infoElement.id = 'bonus-info-message';
          infoElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
          `;
          document.body.appendChild(infoElement);
        }

        infoElement.textContent = message;

        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
          if (infoElement && infoElement.parentNode) {
            infoElement.remove();
          }
        }, 5000);
      } catch (error) {
        this.log('Ошибка показа информационного сообщения:', error);
      }
    },

    // Полная очистка всех промокодов
    clearAllPromocodes: function () {
      try {
        this.log('Полностью очищаем все промокоды');

        // Удаляем промокод из объекта tcart (основной метод Tilda)
        if (window.tcart && window.tcart.promocode) {
          try {
            delete window.tcart.promocode;
            this.log('Удален промокод из window.tcart');
          } catch (_) {}
        }

        // Сбрасываем состояние виджета
        this.state.appliedBonuses = 0;

        // Сбрасываем скрытое поле applied_bonuses_field
        const appliedBonusesField = document.getElementById(
          'applied_bonuses_field'
        );
        if (appliedBonusesField) {
          appliedBonusesField.value = '0';
          this.log('Сброшено скрытое поле applied_bonuses_field');
        }

        // Сбрасываем отображение статуса бонусов
        const bonusStatus = document.getElementById('bonus-status');
        if (bonusStatus) {
          bonusStatus.innerHTML = '';
        }

        // Используем функции Tilda для пересчета и обновления
        if (typeof window.tcart__calcAmountWithDiscounts === 'function') {
          try {
            window.tcart__calcAmountWithDiscounts();
            this.log('Пересчитаны скидки в корзине');
          } catch (e) {
            this.log('Ошибка при пересчете скидок:', e);
          }
        }

        if (typeof window.tcart__reDrawTotal === 'function') {
          try {
            window.tcart__reDrawTotal();
            this.log('Перерисован итог корзины');
          } catch (e) {
            this.log('Ошибка при перерисовке итога:', e);
          }
        }

        if (typeof window.tcart__updateTotalProductsinCartObj === 'function') {
          try {
            window.tcart__updateTotalProductsinCartObj();
            this.log('Обновлено количество товаров в объекте корзины');
          } catch (e) {
            this.log('Ошибка при обновлении количества товаров:', e);
          }
        }

        // Дополнительно очищаем промокод через Tilda API (если доступно)
        if (typeof window.t_input_promocode__clearPromocode === 'function') {
          try {
            window.t_input_promocode__clearPromocode();
          } catch (e) {
            this.log('Ошибка при очистке промокода через Tilda API:', e);
          }
        }

        // Дополнительный пересчет через tcart__calcPromocode если доступен
        if (typeof window.tcart__calcPromocode === 'function') {
          try {
            window.tcart__calcPromocode();
            this.log('Выполнен дополнительный пересчет промокода');
          } catch (e) {
            this.log('Ошибка при дополнительном пересчете промокода:', e);
          }
        }

        // Обновляем отображение баланса и доступных бонусов
        this.updateBalanceDisplay();
        this.updateBonusInputMax();

        this.log('Промокоды полностью очищены');
      } catch (error) {
        this.log('Ошибка при очистке промокодов:', error);
      }
    },

    // Принудительное удаление промокода (более агрессивный метод)
    forceDeletePromocode: function () {
      try {
        this.log('🔥 ПРИНУДИТЕЛЬНОЕ удаление промокода - НАЧАЛО');

        // 1. ОБЯЗАТЕЛЬНО удаляем из window.tcart.promocode как просил пользователь
        if (window.tcart) {
          this.log('📦 window.tcart найден, проверяем промокод');

          if (window.tcart.promocode) {
            this.log('⚠️ Найден промокод:', window.tcart.promocode);
            delete window.tcart.promocode;
            this.log('✅ УДАЛЕН window.tcart.promocode');
          } else {
            this.log('ℹ️ window.tcart.promocode уже отсутствует');
          }

          // Также удаляем другие возможные поля промокода
          if (window.tcart.promo) {
            delete window.tcart.promo;
            this.log('✅ УДАЛЕН window.tcart.promo');
          }
          if (window.tcart.discount) {
            delete window.tcart.discount;
            this.log('✅ УДАЛЕН window.tcart.discount');
          }
          if (window.tcart.discountvalue) {
            delete window.tcart.discountvalue;
            this.log('✅ УДАЛЕН window.tcart.discountvalue');
          }
        } else {
          this.log('❌ window.tcart не найден!');
        }

        // 2. Очищаем ВСЕ поля ввода промокода
        const promocodeSelectors = [
          '.t-inputpromocode',
          'input[name="promocode"]',
          'input[name="promo"]',
          '#promocode',
          '#promo'
        ];

        promocodeSelectors.forEach((selector) => {
          const input = document.querySelector(selector);
          if (input) {
            input.value = '';
            this.log(`✅ Очищено поле ${selector}`);
          }
        });

        // 3. Принудительно вызываем ВСЕ функции пересчета Tilda
        const tildaFunctions = [
          'tcart__calcAmountWithDiscounts',
          'tcart__reDrawTotal',
          'tcart__updateTotalProductsinCartObj',
          'tcart__calcPromocode',
          't_input_promocode__clearPromocode'
        ];

        tildaFunctions.forEach((funcName) => {
          if (typeof window[funcName] === 'function') {
            try {
              window[funcName]();
              this.log(`✅ Принудительно вызвана ${funcName}`);
            } catch (e) {
              this.log(`❌ Ошибка принудительного вызова ${funcName}:`, e);
            }
          }
        });

        // 4. Полный сброс состояния виджета
        this.state.appliedBonuses = 0;
        this.state.originalCartTotal = this.getCartTotal();
        localStorage.setItem('tilda_applied_bonuses', '0');

        // 5. Очищаем ВСЕ скрытые поля
        const hiddenFields = [
          'applied_bonuses_field',
          'applied_bonuses',
          'bonus_amount',
          'promocode_field',
          'promo_field'
        ];

        hiddenFields.forEach((fieldId) => {
          const field = document.getElementById(fieldId);
          if (field) {
            field.value = '0';
            this.log(`✅ Принудительно очищено поле ${fieldId}`);
          }
        });

        // 6. Удаляем все элементы статуса промокода
        const statusSelectors = [
          '#bonus-status',
          '.bonus-status',
          '.promocode-status',
          '.t-promocode-status'
        ];

        statusSelectors.forEach((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.innerHTML = '';
            element.style.display = 'none';
          }
        });

        // 7. Принудительно обновляем отображение
        this.updateBalanceDisplay();

        this.log('🔥 ПРИНУДИТЕЛЬНОЕ удаление промокода ЗАВЕРШЕНО');
      } catch (error) {
        this.log(
          '❌ КРИТИЧЕСКАЯ ошибка принудительного удаления промокода:',
          error
        );
      }
    },

    // Универсальная функция применения/переприменения бонусов
    applyOrReapplyBonuses: function () {
      if (this.state.appliedBonuses > 0) {
        this.log('Бонусы уже применены, переприменяем');
        this.reapplyBonuses();
      } else {
        this.log('Бонусы не применены, применяем');
        this.applyBonuses();
      }
    },

    // Определение состояния пользователя
    getUserState: function () {
      // Проверяем localStorage и куки
      const userEmail = this.getUserEmail();
      const telegramLinked = this.isTelegramLinked();

      console.log('🔍 getUserState: userEmail =', userEmail);
      console.log('🔍 getUserState: telegramLinked =', telegramLinked);

      // Если Telegram привязан - пользователь активирован (даже без email)
      if (telegramLinked) {
        console.log('✅ getUserState: Telegram привязан → fully_activated');
        return 'fully_activated'; // 🟢 Telegram активирован
      }

      // Если есть email но нет Telegram
      if (userEmail && !telegramLinked) {
        console.log(
          '⚠️ getUserState: Email есть, но Telegram не привязан → registered_not_confirmed'
        );
        return 'registered_not_confirmed'; // 🟡 Ожидает привязки Telegram
      }

      // Нет ни email ни Telegram
      console.log('❌ getUserState: Нет email и Telegram → not_registered');
      return 'not_registered'; // 🔴 Не зарегистрирован
    },

    // Проверка возможности использования бонусов
    canSpendBonuses: function () {
      const userState = this.getUserState();
      return userState === 'fully_activated'; // Только подтвердившие пользователи
    },

    // Применение бонусов
    applyBonuses: async function () {
      console.log('🎯 applyBonuses: НАЧАЛО');

      // Проверяем, может ли пользователь тратить бонусы
      if (!this.canSpendBonuses()) {
        console.log('❌ applyBonuses: пользователь не может тратить бонусы');
        const userState = this.getUserState();
        console.log('👤 applyBonuses: userState =', userState);

        let errorMessage = '';
        if (userState === 'not_registered') {
          errorMessage =
            'Для использования бонусов необходимо зарегистрироваться и подтвердить аккаунт в Telegram боте';
        } else if (userState === 'registered_not_confirmed') {
          errorMessage =
            'Для использования бонусов необходимо подтвердить аккаунт в Telegram боте';
        } else {
          errorMessage = `Ошибка проверки пользователя (состояние: ${userState}). Обратитесь в поддержку.`;
        }

        this.showError(errorMessage);
        console.error('❌ applyBonuses: ', errorMessage);
        return;
      }

      const amountInput = document.getElementById('bonus-amount-input');
      console.log('📝 applyBonuses: amountInput =', amountInput);
      const amount = parseFloat(amountInput.value) || 0;
      console.log('💰 applyBonuses: amount =', amount);

      if (amount <= 0) {
        this.showError('Укажите количество бонусов');
        return;
      }

      if (amount > this.state.bonusBalance) {
        this.showError('Недостаточно бонусов');
        return;
      }

      // Используем изначальную сумму корзины для корректного расчета максимума
      const originalCartTotal = this.getOriginalCartTotal();
      let maxAllowed = originalCartTotal;

      // Применяем ограничение по уровню пользователя
      if (this.state.levelInfo && this.state.levelInfo.paymentPercent < 100) {
        const maxByLevel =
          (originalCartTotal * this.state.levelInfo.paymentPercent) / 100;
        maxAllowed = Math.min(maxAllowed, maxByLevel);

        if (amount > maxByLevel) {
          this.showError(
            `Ваш уровень "${this.state.levelInfo.name}" позволяет оплачивать только до ${this.state.levelInfo.paymentPercent}% заказа бонусами (макс: ${maxByLevel.toFixed(2)} бонусов)`
          );
          return;
        }
      }

      if (amount > maxAllowed) {
        this.showError(
          `Максимум можно использовать ${maxAllowed.toFixed(2)} бонусов`
        );
        return;
      }

      try {
        this.showLoading(true);

        // Сохраняем примененные бонусы (без автоматического оформления и без промокодов)
        this.state.appliedBonuses = amount;
        localStorage.setItem('tilda_applied_bonuses', amount);

        // КРИТИЧНО: Добавляем appliedBonuses во ВСЕ возможные места в объекте данных Tilda
        // Tilda использует данные из window.tcart для формирования JSON при отправке заказа
        // Нужно обновить данные ДО того, как Tilda начнет формировать JSON
        if (
          typeof window !== 'undefined' &&
          window.tcart &&
          typeof window.tcart === 'object'
        ) {
          // Основной объект tcart
          window.tcart.appliedBonuses = String(amount);
          this.log('✅ appliedBonuses добавлен в window.tcart:', amount);

          // Объект data внутри tcart (если существует)
          if (window.tcart.data && typeof window.tcart.data === 'object') {
            window.tcart.data.appliedBonuses = String(amount);
            this.log('✅ appliedBonuses добавлен в window.tcart.data');
          }

          // Также пробуем добавить в корневой уровень window.tcart как числовое значение
          window.tcart.appliedBonusesNumber = Number(amount);

          // Пробуем найти и обновить объект формы, который Tilda использует для сериализации
          // Tilda может хранить данные формы в разных местах
          if (
            window.tcart.formData &&
            typeof window.tcart.formData === 'object'
          ) {
            window.tcart.formData.appliedBonuses = String(amount);
            this.log('✅ appliedBonuses добавлен в window.tcart.formData');
          }

          // Проверяем, есть ли объект order или orderData
          if (window.tcart.order && typeof window.tcart.order === 'object') {
            window.tcart.order.appliedBonuses = String(amount);
            this.log('✅ appliedBonuses добавлен в window.tcart.order');
          }

          if (
            window.tcart.orderData &&
            typeof window.tcart.orderData === 'object'
          ) {
            window.tcart.orderData.appliedBonuses = String(amount);
            this.log('✅ appliedBonuses добавлен в window.tcart.orderData');
          }
        }

        // Добавляем скрытое поле с бонусами для отправки в webhook
        // Это должно обновить также объект данных формы Tilda
        this.addHiddenBonusField(amount);

        // Применяем скидку через нативный механизм Тильды как промокод с фиксированным дискаунтом
        try {
          // Полностью очищаем все промокоды перед применением новых
          this.clearAllPromocodes();

          // Ждем очистки
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Применяем новый промокод с бонусами
          if (typeof window.t_input_promocode__addPromocode === 'function') {
            window.t_input_promocode__addPromocode({
              promocode: 'GUPIL',
              discountsum: amount
            });

            // Вызываем пересчет промокода
            if (typeof window.tcart__calcPromocode === 'function') {
              try {
                window.tcart__calcPromocode();
              } catch (_) {}
            }

            // Пересчитываем суммы с учетом скидок (дополнительная функция Tilda)
            if (typeof window.tcart__calcAmountWithDiscounts === 'function') {
              try {
                window.tcart__calcAmountWithDiscounts();
              } catch (_) {}
            }

            // Полностью перерисовываем корзину
            if (typeof window.tcart__reDrawTotal === 'function') {
              try {
                window.tcart__reDrawTotal();
              } catch (_) {}
            }

            // Обновляем объекты товаров в корзине
            if (
              typeof window.tcart__updateTotalProductsinCartObj === 'function'
            ) {
              try {
                window.tcart__updateTotalProductsinCartObj();
              } catch (_) {}
            }

            // Перерисовываем весь интерфейс корзины
            if (typeof window.tcart__reDraw === 'function') {
              try {
                window.tcart__reDraw();
              } catch (_) {}
            }

            // Сохраняем состояние корзины
            if (typeof window.tcart__saveLocalObj === 'function') {
              try {
                window.tcart__saveLocalObj();
              } catch (_) {}
            }
          }
        } catch (_) {}

        // Принудительно обновляем отображение суммы в корзине
        this.forceUpdateCartDisplay();

        // КРИТИЧНО: После применения бонусов и перерисовки корзины обновляем поле appliedBonuses
        // Tilda может перерисовать форму и сбросить значение, поэтому обновляем несколько раз
        setTimeout(() => {
          this.addHiddenBonusField(amount);
        }, 100);

        setTimeout(() => {
          this.addHiddenBonusField(amount);
        }, 500);

        setTimeout(() => {
          this.addHiddenBonusField(amount);
        }, 1000);

        this.showSuccess(`Применено ${amount.toFixed(2)} бонусов.`);
      } catch (error) {
        this.showError('Ошибка применения бонусов');
        this.log('Ошибка:', error);
      } finally {
        this.showLoading(false);
      }
    },

    // Принудительное обновление отображения корзины
    forceUpdateCartDisplay: function () {
      try {
        // Обновляем счетчик товаров в корзине
        if (
          typeof window.tcart !== 'undefined' &&
          window.tcart.total !== undefined
        ) {
          const counter = document.querySelector('.t706__carticon-counter');
          if (counter) {
            counter.innerHTML = window.tcart.total;
          }
        }

        // Обновляем общую сумму
        const totalElements = document.querySelectorAll(
          '.t706__cartwin-totalamount, .t706__cartwin-totalamount-value'
        );
        totalElements.forEach((el) => {
          if (el && window.tcart && window.tcart.totalAmount !== undefined) {
            el.innerHTML = window.tcart.totalAmount;
          }
        });

        // Обновляем итоговую сумму
        const totalContent = document.querySelector(
          '.t706__cartwin-totalamount-content'
        );
        if (
          totalContent &&
          window.tcart &&
          window.tcart.totalAmount !== undefined
        ) {
          const label = totalContent.querySelector(
            '.t706__cartwin-totalamount-label'
          );
          const amount = totalContent.querySelector(
            '.t706__cartwin-totalamount'
          );
          if (label) label.innerHTML = 'Итоговая сумма: ';
          if (amount) {
            const price = amount.querySelector(
              '.t706__cartwin-prodamount-price'
            );
            const currency = amount.querySelector(
              '.t706__cartwin-prodamount-currency'
            );
            if (price) price.innerHTML = window.tcart.totalAmount;
            if (currency) currency.innerHTML = 'р.';
          }
        }

        // Обновляем информацию о скидке
        const discountElements = document.querySelectorAll(
          '.t706__cartwin-totalamount-info_value'
        );
        discountElements.forEach((el) => {
          if (el.innerHTML.includes('р.')) {
            el.innerHTML = `<div class="t706__cartwin-prodamount-price">${this.state.appliedBonuses}</div><div class="t706__cartwin-prodamount-currency">р.</div>`;
          }
        });

        // Принудительно триггерим событие обновления
        const event = new CustomEvent('tcart:updated', {
          detail: { bonuses: this.state.appliedBonuses }
        });
        document.dispatchEvent(event);

        this.log('Корзина принудительно обновлена');
      } catch (error) {
        this.log('Ошибка принудительного обновления корзины:', error);
      }
    },

    // Добавление скрытого поля с бонусами
    addHiddenBonusField: function (amount) {
      this.log('📝 Добавляем скрытое поле с бонусами:', amount);

      // КРИТИЧНО: Обновляем объект данных формы Tilda ДО добавления поля в DOM
      // Tilda может использовать объект данных формы для формирования JSON
      if (
        typeof window !== 'undefined' &&
        window.tcart &&
        typeof window.tcart === 'object'
      ) {
        // Обновляем все возможные места в window.tcart
        window.tcart.appliedBonuses = String(amount);

        if (window.tcart.data && typeof window.tcart.data === 'object') {
          window.tcart.data.appliedBonuses = String(amount);
        }

        if (
          window.tcart.formData &&
          typeof window.tcart.formData === 'object'
        ) {
          window.tcart.formData.appliedBonuses = String(amount);
        }

        if (window.tcart.order && typeof window.tcart.order === 'object') {
          window.tcart.order.appliedBonuses = String(amount);
        }

        if (
          window.tcart.orderData &&
          typeof window.tcart.orderData === 'object'
        ) {
          window.tcart.orderData.appliedBonuses = String(amount);
        }

        this.log('✅ appliedBonuses обновлен во всех объектах window.tcart');
      }

      // Удаляем все старые поля с бонусами
      const oldFields = document.querySelectorAll(
        '[name="appliedBonuses"], #applied_bonuses_field'
      );
      oldFields.forEach((field) => {
        this.log('🗑️ Удаляем старое поле:', field.id || field.name);
        field.remove();
      });

      // Создаем новое скрытое поле
      const hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.id = 'applied_bonuses_field';
      hiddenField.name = 'appliedBonuses';
      hiddenField.value = String(amount);

      this.log('✅ Создано поле:', {
        id: hiddenField.id,
        name: hiddenField.name,
        value: hiddenField.value
      });

      // Ищем форму корзины Tilda
      let form = document.querySelector('.t706__cartwin form');
      if (!form) {
        // Пробуем найти форму в модальном окне корзины
        form = document.querySelector('.t706__cartwin .t-form');
      }
      if (!form) {
        // Пробуем найти форму на странице
        form = document.querySelector('form[action*="cart"], form.t-form');
      }
      if (!form) {
        // Последний вариант - любая форма
        form = document.querySelector('.t-form, form');
      }

      if (form) {
        form.appendChild(hiddenField);
        this.log('✅ Поле добавлено в форму:', {
          formId: form.id,
          formClass: form.className,
          fieldValue: hiddenField.value
        });

        // Также добавляем в тело документа для гарантии (Tilda может копировать поля при отправке)
        const backupField = hiddenField.cloneNode(true);
        backupField.id = 'applied_bonuses_field_backup';
        document.body.appendChild(backupField);

        // Пробуем найти объект данных формы и обновить его напрямую
        // Tilda может хранить данные формы в разных местах
        if (form.dataset && typeof form.dataset === 'object') {
          form.dataset.appliedBonuses = String(amount);
        }

        // Проверяем наличие поля через секунду
        setTimeout(() => {
          const checkField = document.querySelector('[name="appliedBonuses"]');
          if (checkField) {
            this.log('✅ Поле примененных бонусов найдено в DOM:', {
              id: checkField.id,
              value: checkField.value,
              inForm: !!checkField.closest('form')
            });
          } else {
            this.log(
              '⚠️ Поле примененных бонусов не найдено в DOM после добавления!'
            );
          }
        }, 1000);
      } else {
        this.log('❌ Форма не найдена для добавления поля appliedBonuses!');
        // Добавляем в body как последний вариант
        document.body.appendChild(hiddenField);
        this.log('⚠️ Поле добавлено в body (не в форму)');
      }
    },

    // Перехват отправки формы для гарантированного добавления appliedBonuses
    interceptFormSubmission: function () {
      const self = this;

      // КРИТИЧНО: Перехватываем JSON.stringify для добавления appliedBonuses в JSON ДО сериализации
      // Tilda использует JSON.stringify для формирования JSON из объекта данных
      // ВАЖНО: Перехватываем только ОЧЕНЬ специфичные объекты заказов Tilda, чтобы не сломать работу виджета
      if (
        typeof window !== 'undefined' &&
        window.JSON &&
        !window.JSON.stringify.__tildaBonusIntercepted
      ) {
        const originalStringify = window.JSON.stringify;
        window.JSON.stringify = function (value, replacer, space) {
          try {
            // Если сериализуется объект, который может быть заказом Tilda
            if (value && typeof value === 'object') {
              // ОЧЕНЬ строгая проверка: это должен быть объект с payment И formname === 'Cart'
              // Или массив, где первый элемент имеет payment и formname === 'Cart'
              let isTildaOrder = false;

              if (Array.isArray(value)) {
                // Массив заказов Tilda
                if (
                  value.length > 0 &&
                  value[0] &&
                  typeof value[0] === 'object'
                ) {
                  isTildaOrder =
                    value[0].payment &&
                    typeof value[0].payment === 'object' &&
                    (value[0].formname === 'Cart' ||
                      value[0].formname === 'Order');
                }
              } else {
                // Одиночный заказ Tilda
                isTildaOrder =
                  value.payment &&
                  typeof value.payment === 'object' &&
                  (value.formname === 'Cart' || value.formname === 'Order');
              }

              // Применяем только если это точно заказ Tilda И есть примененные бонусы
              if (isTildaOrder && self.state && self.state.appliedBonuses > 0) {
                self.log(
                  '🔍 Перехвачен JSON.stringify для объекта заказа Tilda, добавляем appliedBonuses:',
                  self.state.appliedBonuses
                );

                // Создаем копию объекта для модификации
                let modifiedValue;

                if (Array.isArray(value)) {
                  // Если это массив, модифицируем первый элемент
                  modifiedValue = [...value];
                  if (
                    modifiedValue[0] &&
                    typeof modifiedValue[0] === 'object'
                  ) {
                    modifiedValue[0] = {
                      ...modifiedValue[0],
                      appliedBonuses: String(self.state.appliedBonuses)
                    };
                  }
                } else {
                  // Если это объект, добавляем appliedBonuses
                  modifiedValue = {
                    ...value,
                    appliedBonuses: String(self.state.appliedBonuses)
                  };
                }

                self.log(
                  '✅ appliedBonuses добавлен в объект перед JSON.stringify:',
                  {
                    appliedBonuses:
                      modifiedValue.appliedBonuses ||
                      (Array.isArray(modifiedValue) &&
                        modifiedValue[0]?.appliedBonuses),
                    hasPayment: !!(
                      modifiedValue.payment ||
                      (Array.isArray(modifiedValue) &&
                        modifiedValue[0]?.payment)
                    )
                  }
                );

                return originalStringify.call(
                  this,
                  modifiedValue,
                  replacer,
                  space
                );
              }
            }
          } catch (error) {
            // Если произошла ошибка при перехвате, просто вызываем оригинальный JSON.stringify
            self.log('⚠️ Ошибка при перехвате JSON.stringify:', error);
          }

          // Для всех остальных случаев вызываем оригинальный JSON.stringify
          return originalStringify.call(this, value, replacer, space);
        };

        // Помечаем, что перехват уже установлен, чтобы не устанавливать его дважды
        window.JSON.stringify.__tildaBonusIntercepted = true;

        self.log('✅ JSON.stringify перехвачен для добавления appliedBonuses');
      }

      // КРИТИЧНО: Устанавливаем механизм постоянного обновления поля appliedBonuses
      // Tilda может перерисовывать форму и сбрасывать значение, поэтому нужно постоянно проверять и обновлять
      const updateAppliedBonusesField = () => {
        if (self.state && self.state.appliedBonuses > 0) {
          // Находим все поля appliedBonuses и обновляем их значение
          const fields = document.querySelectorAll('[name="appliedBonuses"]');
          fields.forEach((field) => {
            if (field.value !== String(self.state.appliedBonuses)) {
              field.value = String(self.state.appliedBonuses);
              self.log('🔄 Обновлено значение поля appliedBonuses:', {
                id: field.id,
                oldValue: field.value,
                newValue: String(self.state.appliedBonuses)
              });
            }
          });

          // Если поле не найдено, добавляем его
          if (fields.length === 0) {
            self.addHiddenBonusField(self.state.appliedBonuses);
          }
        }
      };

      // Обновляем поле при каждом изменении состояния
      let fieldWatcherInterval = null;
      const startFieldWatcher = () => {
        // Останавливаем предыдущий интервал, если он существует
        if (fieldWatcherInterval) {
          clearInterval(fieldWatcherInterval);
        }

        // Проверяем каждые 500ms
        fieldWatcherInterval = setInterval(updateAppliedBonusesField, 500);

        // Также обновляем при событиях Tilda
        ['tcart:updated', 'tcart:reDraw', 'tcart:calcAmount'].forEach(
          (eventName) => {
            document.addEventListener(eventName, updateAppliedBonusesField);
          }
        );

        // Сохраняем интервал для возможной остановки
        if (typeof self.fieldWatcherInterval === 'undefined') {
          self.fieldWatcherInterval = fieldWatcherInterval;
        }
      };

      startFieldWatcher();
      self.log(
        '✅ Запущен механизм постоянного обновления поля appliedBonuses'
      );

      // Перехватываем отправку всех форм на странице
      document.addEventListener(
        'submit',
        function (e) {
          if (self.state && self.state.appliedBonuses > 0) {
            self.log(
              '📤 Перехвачена отправка формы, добавляем appliedBonuses:',
              self.state.appliedBonuses
            );

            // СНАЧАЛА обновляем все существующие поля
            updateAppliedBonusesField();

            // Затем добавляем/обновляем поле в форме
            self.addHiddenBonusField(self.state.appliedBonuses);

            // Также добавляем поле напрямую в форму, которая отправляется
            const form = e.target;
            if (form && form.tagName === 'FORM') {
              // Удаляем старое поле если есть
              const existingField = form.querySelector(
                '[name="appliedBonuses"]'
              );
              if (existingField) {
                existingField.remove();
              }

              // Создаем и добавляем новое поле
              const bonusField = document.createElement('input');
              bonusField.type = 'hidden';
              bonusField.name = 'appliedBonuses';
              bonusField.value = String(self.state.appliedBonuses);
              form.appendChild(bonusField);

              self.log(
                '✅ Поле appliedBonuses добавлено в отправляемую форму:',
                {
                  value: bonusField.value,
                  formId: form.id || form.className
                }
              );
            }
          }
        },
        true
      ); // Используем capture phase для раннего перехвата

      // Перехватываем события Tilda для отправки заказа
      if (typeof window !== 'undefined') {
        // Перехватываем tcart__sendOrder если существует
        const originalSendOrder = window.tcart__sendOrder;
        if (typeof originalSendOrder === 'function') {
          window.tcart__sendOrder = function (...args) {
            if (self.state.appliedBonuses > 0) {
              self.log(
                '📤 Перехвачен tcart__sendOrder, добавляем appliedBonuses:',
                self.state.appliedBonuses
              );

              // КРИТИЧНО: Обновляем window.tcart.data ДО вызова оригинальной функции
              // Tilda может формировать JSON из этого объекта
              if (window.tcart && typeof window.tcart === 'object') {
                window.tcart.appliedBonuses = String(self.state.appliedBonuses);

                if (
                  window.tcart.data &&
                  typeof window.tcart.data === 'object'
                ) {
                  window.tcart.data.appliedBonuses = String(
                    self.state.appliedBonuses
                  );
                }

                if (
                  window.tcart.formData &&
                  typeof window.tcart.formData === 'object'
                ) {
                  window.tcart.formData.appliedBonuses = String(
                    self.state.appliedBonuses
                  );
                }

                if (
                  window.tcart.order &&
                  typeof window.tcart.order === 'object'
                ) {
                  window.tcart.order.appliedBonuses = String(
                    self.state.appliedBonuses
                  );
                }

                if (
                  window.tcart.orderData &&
                  typeof window.tcart.orderData === 'object'
                ) {
                  window.tcart.orderData.appliedBonuses = String(
                    self.state.appliedBonuses
                  );
                }

                self.log('✅ window.tcart обновлен перед tcart__sendOrder');
              }

              self.addHiddenBonusField(self.state.appliedBonuses);
            }
            return originalSendOrder.apply(this, args);
          };
        }

        // Перехватываем отправку через AJAX/FormData если используется
        const originalFetch = window.fetch;
        if (originalFetch) {
          window.fetch = function (...args) {
            // Проверяем, это ли запрос формы корзины
            const url = args[0];
            const options = args[1] || {};

            if (
              typeof url === 'string' &&
              (url.includes('cart') ||
                url.includes('order') ||
                url.includes('checkout') ||
                url.includes('webhook'))
            ) {
              if (self.state.appliedBonuses > 0) {
                self.log(
                  '📤 Перехвачен fetch запрос формы, добавляем appliedBonuses:',
                  self.state.appliedBonuses
                );

                // КРИТИЧНО: Обновляем window.tcart ДО обработки body
                // Tilda может формировать JSON из window.tcart в момент fetch
                if (window.tcart && typeof window.tcart === 'object') {
                  window.tcart.appliedBonuses = String(
                    self.state.appliedBonuses
                  );

                  if (
                    window.tcart.data &&
                    typeof window.tcart.data === 'object'
                  ) {
                    window.tcart.data.appliedBonuses = String(
                      self.state.appliedBonuses
                    );
                  }

                  if (
                    window.tcart.formData &&
                    typeof window.tcart.formData === 'object'
                  ) {
                    window.tcart.formData.appliedBonuses = String(
                      self.state.appliedBonuses
                    );
                  }

                  if (
                    window.tcart.order &&
                    typeof window.tcart.order === 'object'
                  ) {
                    window.tcart.order.appliedBonuses = String(
                      self.state.appliedBonuses
                    );
                  }

                  if (
                    window.tcart.orderData &&
                    typeof window.tcart.orderData === 'object'
                  ) {
                    window.tcart.orderData.appliedBonuses = String(
                      self.state.appliedBonuses
                    );
                  }

                  self.log('✅ window.tcart обновлен перед fetch');
                }

                // Если это FormData, добавляем appliedBonuses
                if (options.body instanceof FormData) {
                  // Проверяем, есть ли поле 'data' или 'json' с JSON данными
                  const jsonField =
                    options.body.get('data') ||
                    options.body.get('json') ||
                    options.body.get('order');
                  if (jsonField && typeof jsonField === 'string') {
                    try {
                      const jsonData = JSON.parse(jsonField);
                      jsonData.appliedBonuses = String(
                        self.state.appliedBonuses
                      );
                      options.body.set('data', JSON.stringify(jsonData));
                      self.log(
                        '✅ appliedBonuses добавлен в JSON внутри FormData'
                      );
                    } catch {
                      // Если не удалось распарсить, добавляем как отдельное поле
                      options.body.append(
                        'appliedBonuses',
                        String(self.state.appliedBonuses)
                      );
                      self.log(
                        '✅ appliedBonuses добавлен как отдельное поле в FormData'
                      );
                    }
                  } else {
                    options.body.append(
                      'appliedBonuses',
                      String(self.state.appliedBonuses)
                    );
                    self.log('✅ appliedBonuses добавлен в FormData');
                  }
                } else if (typeof options.body === 'string') {
                  // Если это строка (JSON или URL-encoded), добавляем параметр
                  try {
                    const body = JSON.parse(options.body);
                    body.appliedBonuses = String(self.state.appliedBonuses);
                    options.body = JSON.stringify(body);
                    self.log('✅ appliedBonuses добавлен в JSON body');
                  } catch {
                    // Если не JSON, добавляем как URL-encoded параметр
                    if (options.body.includes('=')) {
                      options.body += `&appliedBonuses=${encodeURIComponent(self.state.appliedBonuses)}`;
                    } else {
                      options.body = `appliedBonuses=${encodeURIComponent(self.state.appliedBonuses)}&${options.body}`;
                    }
                    self.log('✅ appliedBonuses добавлен в URL-encoded body');
                  }
                }
              }
            }

            return originalFetch.apply(this, args);
          };
        }
      }

      this.log('✅ Обработчики перехвата отправки формы установлены');
    },

    // Установка Proxy для перехвата формирования объекта данных формы Tilda
    setupTildaDataProxy: function () {
      const self = this;

      if (typeof window === 'undefined') return;

      // Проверяем, не установлен ли уже Proxy (чтобы не ломать Tilda)
      if (window.__tildaBonusProxySetup) {
        this.log('ℹ️ Proxy уже настроен ранее, пропускаем');
        return;
      }

      // Пробуем установить Proxy для window.tcart.data (если он существует)
      // Это позволит автоматически добавлять appliedBonuses при обращении к объекту
      const setupProxyForTcartData = () => {
        if (
          window.tcart &&
          window.tcart.data &&
          typeof window.tcart.data === 'object'
        ) {
          // Проверяем, не установлен ли уже Proxy
          if (window.tcart.data.__isTildaBonusProxy) {
            return; // Уже установлен
          }

          try {
            // Создаем Proxy для автоматического добавления appliedBonuses
            const originalData = window.tcart.data;

            // ВАЖНО: Используем более безопасный подход - только добавляем toJSON, если его нет
            if (typeof Proxy !== 'undefined') {
              const proxy = new Proxy(originalData, {
                get: function (target, prop) {
                  // При получении объекта для сериализации добавляем appliedBonuses
                  if (prop === 'toJSON') {
                    return function () {
                      const result = {};
                      for (const key in target) {
                        if (target.hasOwnProperty(key)) {
                          result[key] = target[key];
                        }
                      }
                      if (self.state && self.state.appliedBonuses > 0) {
                        result.appliedBonuses = String(
                          self.state.appliedBonuses
                        );
                        self.log(
                          '✅ Proxy: appliedBonuses добавлен в объект данных через toJSON'
                        );
                      }
                      return result;
                    };
                  }
                  return target[prop];
                },
                set: function (target, prop, value) {
                  target[prop] = value;
                  return true;
                }
              });

              // Помечаем, что это Proxy
              proxy.__isTildaBonusProxy = true;

              window.tcart.data = proxy;
              self.log('✅ Proxy установлен для window.tcart.data');
            }
          } catch (error) {
            // Если Proxy не поддерживается или произошла ошибка, просто обновляем данные напрямую
            self.log(
              '⚠️ Не удалось установить Proxy для window.tcart.data, используем прямой подход:',
              error
            );
          }
        }
      };

      // Пробуем установить Proxy сразу, если window.tcart уже существует
      if (window.tcart) {
        setupProxyForTcartData();
      }

      // Также пробуем установить Proxy после загрузки Tilda (через некоторое время)
      setTimeout(setupProxyForTcartData, 1000);
      setTimeout(setupProxyForTcartData, 3000);

      // Помечаем, что Proxy настройка запущена
      window.__tildaBonusProxySetup = true;

      this.log('✅ Механизм Proxy для перехвата данных формы Tilda настроен');
    },

    // Обновление визуального отображения суммы
    updateCartVisualTotal: function (newTotal) {
      const totalElement = document.querySelector(
        '.t706__cartwin-totalamount-withoutdelivery, .t706__cartwin-totalamount'
      );
      if (totalElement) {
        // Сохраняем оригинальную сумму
        if (!totalElement.dataset.originalAmount) {
          totalElement.dataset.originalAmount = totalElement.textContent;
        }

        // Обновляем отображение
        totalElement.innerHTML = `
          <s style="color: #999; font-size: 0.9em;">${totalElement.dataset.originalAmount}</s>
          <br>
          ${newTotal} ₽
        `;
      }
    },

    // Отображение загрузки
    showLoading: function (show) {
      const button = document.getElementById('apply-bonus-button');
      if (button) {
        button.disabled = show;
        button.innerHTML = show
          ? 'Применение...<span class="bonus-loading"></span>'
          : 'Применить бонусы';
      }
    },

    // Отображение успеха
    showSuccess: function (message) {
      const status = document.getElementById('bonus-status');
      status.innerHTML = `<div class="bonus-applied">✓ ${message}</div>`;
    },

    // Отображение ошибки
    showError: function (message) {
      const status = document.getElementById('bonus-status');
      status.innerHTML = `<div class="bonus-error">✗ ${message}</div>`;

      // Убираем через 3 секунды
      setTimeout(() => {
        status.innerHTML = '';
      }, 3000);
    },

    // Сброс примененных бонусов
    resetAppliedBonuses: function () {
      this.state.appliedBonuses = 0;
      localStorage.removeItem('tilda_applied_bonuses');

      const totalElement = document.querySelector(
        '.t706__cartwin-totalamount-withoutdelivery, .t706__cartwin-totalamount'
      );
      if (totalElement && totalElement.dataset.originalAmount) {
        totalElement.textContent = totalElement.dataset.originalAmount;
      }

      const status = document.getElementById('bonus-status');
      if (status) status.innerHTML = '';
    }
  };

  // Безопасная инициализация виджета
  safeInit();
})();
