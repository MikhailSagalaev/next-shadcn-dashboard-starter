/**
 * @file: tilda-bonus-widget.js
 * @description: Готовый виджет для интеграции бонусной системы с Tilda
 * @project: SaaS Bonus System
 * @version: 2.9.10
 * @author: AI Assistant + User
 * @architecture: Modular design with memory management, rate limiting, and graceful degradation
 */

(function () {
  'use strict';

  // Глобальный объект для виджета
  window.TildaBonusWidget = {
    // Конфигурация по умолчанию
    config: {
      projectId: null,
      apiUrl: 'https://bonus.example.com',
      bonusToRuble: 1,
      minOrderAmount: 100,
      debug: false, // ВЫКЛЮЧЕНО для продакшена
      debounceMs: 400,
      maxRetries: 3,
      timeout: 10000,
      enableLogging: false, // Полностью отключаем логирование в продакшене
      rateLimitMs: 1000, // Минимальный интервал между API запросами
      maxConcurrentRequests: 2 // Максимум одновременных запросов
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
      healthCheckTimer: null // Таймер проверки здоровья
    },

    // Инициализация виджета
    init: function (userConfig) {
      console.log('🎯 TildaBonusWidget: НАЧАЛО ИНИЦИАЛИЗАЦИИ');
      console.log('🎯 TildaBonusWidget: Опции:', userConfig);

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

      // Отслеживаем изменения в корзине
      this.observeCart();

      // Отслеживаем ввод email/телефона
      this.observeUserInput();

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
            'X-Requested-With': 'XMLHttpRequest',
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

      // Стили для виджета
      const style = document.createElement('style');
      style.textContent = `
        .bonus-widget-container {
          background: #fff;
          border: 1px solid #000;
          border-radius: 10px;
          padding: 12px;
          margin: 8px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #000;
        }
        
        .bonus-widget-title {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          margin-bottom: 8px;
        }
        .bonus-toggle{display:flex;gap:8px;margin-bottom:8px}
        .bonus-toggle-btn{flex:1;padding:8px 12px;border:1px solid #000;background:#fff;border-radius:8px;cursor:pointer;color:#000}
        .bonus-toggle-btn.active{background:#000;color:#fff}
        
        .bonus-balance { font-size: 13px; color: #000; margin-bottom: 8px; }
        
        .bonus-balance-amount { font-weight: 600; }
        
        .bonus-input-group {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .bonus-input { flex: 1; padding: 10px 12px; border: 1px solid #000; border-radius: 8px; font-size: 14px; color:#000 }
        
        .bonus-button { padding: 10px 16px; background:#000; color:#fff; border:1px solid #000; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; transition: background .2s }
        .bonus-button:hover { background:#222 }
        .bonus-button:disabled { opacity:.6; cursor:not-allowed }
        
        .bonus-applied { padding:8px 12px; border:1px solid #000; border-radius:8px; color:#000; background:#fff; font-size:13px }
        .bonus-error { padding:8px 12px; border:1px solid #000; border-radius:8px; color:#000; background:#fff; font-size:13px; margin-top:8px }
        
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
      `;
      document.head.appendChild(style);
      // Контейнер создаём лениво — только когда пользователь найден
    },

    // Создание виджета
    createWidget: function () {
      // Не вставляем повторно
      if (document.querySelector('.bonus-widget-container')) {
        this.log('Виджет уже добавлен, пропускаем');
        return;
      }

      // Находим контейнер поля промокода
      const promocodeWrapper = document.querySelector(
        '.t-inputpromocode__wrapper'
      );
      if (!promocodeWrapper) {
        this.log('Контейнер поля промокода не найден');
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
        <div class="bonus-balance" style="display: none;">
          Ваш баланс: <span class="bonus-balance-amount">0</span> бонусов
        </div>
        <div id="bonus-section" class="bonus-input-group">
          <input type="number" 
                 class="bonus-input" 
                 id="bonus-amount-input" 
                 placeholder="Количество бонусов" 
                 min="0"
                 style="display: none;">
          <button class="bonus-button" type="button"
                  id="apply-bonus-button" 
                  onclick="TildaBonusWidget.applyOrReapplyBonuses()"
                  style="display: none;">
            Применить бонусы
          </button>
        </div>
        <!-- Стандартный блок промокода Тильды будет показан/скрыт переключателем -->
        <div id="bonus-status"></div>
      `;

      // Вставляем виджет вместо поля промокода
      promocodeWrapper.parentNode.replaceChild(container, promocodeWrapper);
      this.state.promoWrapper = promocodeWrapper; // Сохраняем ссылку на оригинальный wrapper

      this.log('Виджет добавлен вместо поля промокода');

      // Показываем баланс и элементы управления
      this.showWidgetControls();
    },

    // Гарантированно вставить виджет, если его ещё нет
    ensureWidgetMounted: function () {
      if (!document.querySelector('.bonus-widget-container')) {
        this.createWidget();
      }
      return !!document.querySelector('.bonus-widget-container');
    },

    // Показывает элементы управления виджета
    showWidgetControls: function () {
      const balanceEl = document.querySelector('.bonus-balance');
      const inputEl = document.getElementById('bonus-amount-input');
      const buttonEl = document.getElementById('apply-bonus-button');

      if (balanceEl) balanceEl.style.display = 'block';
      if (inputEl) inputEl.style.display = 'block';
      if (buttonEl) buttonEl.style.display = 'block';
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
            botUsername: settings?.botUsername || null
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
      return { welcomeBonusAmount: 0, botUsername: null };
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
              botUsername: null
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
        this.cacheProjectSettings(settings, 30 * 60 * 1000); // 30 минут

        this.log('✅ Настройки загружены и сохранены в кэш:', settings);
        return settings;
      } catch (error) {
        this.log('❌ Ошибка загрузки настроек проекта:', error);
        // Возвращаем значения по умолчанию
        const defaultSettings = {
          welcomeBonusAmount: 500, // Базовое значение
          botUsername: null
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
            widgetSettings.registrationButtonText ||
            'Для участия в акции перейдите в бота',
          registrationFallbackText:
            widgetSettings.registrationFallbackText ||
            'Свяжитесь с администратором для регистрации'
        };

        this.log('🔧 Обработанные данные:', {
          welcomeBonusAmount,
          botUsername
        });

        // Ищем контейнер поля промокода
        const promocodeWrapper = document.querySelector(
          '.t-inputpromocode__wrapper'
        );
        if (!promocodeWrapper) {
          this.log('❌ Контейнер поля промокода не найден при отрисовке');
          return;
        }

        // Удаляем существующую плашку перед добавлением новой
        const existingPrompt = promocodeWrapper.querySelector(
          '.registration-prompt-inline'
        );
        if (existingPrompt) {
          existingPrompt.remove();
          this.log('🗑️ Удалена существующая плашка');
        }

        // Создаем плашку регистрации внутри поля промокода
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
          iconAnimation: widgetSettings?.iconAnimation || 'none',

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

        if (widgetSettings.showButton && botUsername) {
          htmlContent += `
            <a href="https://t.me/${botUsername}" target="_blank" class="registration-button" style="
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

        // НЕ скрываем поле промокода - плашка должна быть дополнительным элементом
        // Добавляем плашку ПЕРЕД полем промокода, а не заменяем его
        promocodeWrapper.insertBefore(promptDiv, promocodeWrapper.firstChild);

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
        console.log('🎯 TildaBonusWidget: КЛИК ОБНАРУЖЕН');
        console.log('🎯 TildaBonusWidget: Цель клика:', event.target);
        console.log(
          '🎯 TildaBonusWidget: Классы цели:',
          event.target.className
        );

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
      this.state.mode = mode === 'promo' ? 'promo' : 'bonus';
      var bonusTab = document.getElementById('bonus-tab');
      var promoTab = document.getElementById('promo-tab');
      var bonusSection = document.getElementById('bonus-section');
      if (!bonusTab || !promoTab || !bonusSection) return;

      if (this.state.mode === 'promo') {
        // Переключаемся на режим промокода
        bonusTab.classList.remove('active');
        promoTab.classList.add('active');
        bonusSection.style.display = 'none';

        // НЕ восстанавливаем поле промокода - просто скрываем секцию бонусов
        // Виджет остается на месте, но показывает только табы
        this.log('Переключено на режим промокода - скрыта секция бонусов');
      } else {
        // Переключаемся на режим бонусов
        promoTab.classList.remove('active');
        bonusTab.classList.add('active');

        // Восстанавливаем виджет вместо поля промокода
        const promoWrapper = document.querySelector(
          '.t-inputpromocode__wrapper'
        );
        if (
          promoWrapper &&
          !document.querySelector('.bonus-widget-container')
        ) {
          this.state.promoWrapper = promoWrapper;
          this.createWidget();
          this.log('Переключено на режим бонусов - восстановлен виджет');
        }
        bonusSection.style.display = 'flex';
      }
      // Переключение режима всегда сбрасывает ранее применённые бонусы/визуальные изменения
      this.resetAppliedBonuses();
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

        // Из localStorage
        const savedEmail = localStorage.getItem('tilda_user_email');
        const savedPhone = localStorage.getItem('tilda_user_phone');

        if (savedEmail || savedPhone) {
          this.log('📦 Найдены сохраненные контакты в localStorage:', {
            hasEmail: !!savedEmail,
            hasPhone: !!savedPhone
          });
          return { email: savedEmail, phone: savedPhone };
        }

        // Из полей формы
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
            this.state.bonusBalance = data.balance || 0;
            this.state.levelInfo = data.levelInfo || null;

            // Обновляем изначальную сумму корзины, если она ещё не установлена
            const currentTotal = this.getCartTotal();
            if (currentTotal > 0 && this.state.originalCartTotal === 0) {
              this.state.originalCartTotal = currentTotal;
              this.log(
                'Установлена изначальная сумма корзины при загрузке баланса:',
                this.state.originalCartTotal
              );
            }

            this.updateBalanceDisplay();
            this.log(
              'Баланс загружен:',
              this.state.bonusBalance,
              'Уровень:',
              this.state.levelInfo
            );
          }
        } else {
          // Пользователь не найден/не авторизован — показываем плашку с приглашением зарегистрироваться
          this.showRegistrationPrompt();
        }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          this.log('Запрос баланса отменён (новый ввод)');
        } else {
          this.log('Ошибка загрузки баланса:', error);
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
        balanceAmount.textContent = this.state.bonusBalance;
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
        var input = document.getElementById('promo-code-input');
        if (!input) return;
        var code = (input.value || '').trim();
        if (!code) {
          var ps = document.getElementById('promo-status');
          if (ps) {
            ps.style.display = 'block';
            ps.innerHTML = 'Укажите промокод';
            setTimeout(function () {
              ps.style.display = 'none';
            }, 2000);
          }
          return;
        }
        if (typeof window.t_input_promocode__addPromocode === 'function') {
          window.t_input_promocode__addPromocode({ promocode: code });
          if (typeof window.tcart__calcPromocode === 'function') {
            try {
              window.tcart__calcPromocode();
            } catch (_) {}
          }
          if (typeof window.tcart__reDraw === 'function') {
            try {
              window.tcart__reDraw();
            } catch (_) {}
          }
          this.showSuccess('Промокод применён');
        } else {
          this.showError('Промокоды не поддерживаются в этой корзине');
        }
      } catch (e) {
        this.showError('Ошибка применения промокода');
        this.log('applyPromocode error', e);
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

      if (!userEmail && !telegramLinked) {
        return 'not_registered'; // 🔴 Состояние 1
      } else if (userEmail && !telegramLinked) {
        return 'registered_not_confirmed'; // 🟡 Состояние 2
      } else if (userEmail && telegramLinked) {
        return 'fully_activated'; // 🟢 Состояние 3
      }
      return 'unknown';
    },

    // Проверка возможности использования бонусов
    canSpendBonuses: function () {
      const userState = this.getUserState();
      return userState === 'fully_activated'; // Только подтвердившие пользователи
    },

    // Применение бонусов
    applyBonuses: async function () {
      // Проверяем, может ли пользователь тратить бонусы
      if (!this.canSpendBonuses()) {
        const userState = this.getUserState();
        if (userState === 'not_registered') {
          this.showError(
            'Для использования бонусов необходимо зарегистрироваться и подтвердить аккаунт в Telegram боте'
          );
        } else if (userState === 'registered_not_confirmed') {
          this.showError(
            'Для использования бонусов необходимо подтвердить аккаунт в Telegram боте'
          );
        }
        return;
      }

      const amountInput = document.getElementById('bonus-amount-input');
      const amount = parseFloat(amountInput.value) || 0;

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
      // Удаляем старое поле если есть
      const oldField = document.getElementById('applied_bonuses_field');
      if (oldField) oldField.remove();

      // Создаем новое скрытое поле
      const hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.id = 'applied_bonuses_field';
      hiddenField.name = 'appliedBonuses';
      hiddenField.value = amount;

      // Добавляем в форму
      const form = document.querySelector('.t-form, form');
      if (form) {
        form.appendChild(hiddenField);
      }
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

  // Автоматическая инициализация при загрузке
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Виджет будет инициализирован вручную через TildaBonusWidget.init()
    });
  }
})();
