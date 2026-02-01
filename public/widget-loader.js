/**
 * @file: widget-loader.js
 * @description: Автоматический загрузчик универсального виджета с определением платформы
 * @version: 1.0.0
 * @project: SaaS Bonus System - Universal Widget
 * @created: 2026-01-31
 *
 * ФУНКЦИОНАЛ:
 * - Автоопределение платформы (Tilda, Shopify, WooCommerce, Custom)
 * - Динамическая загрузка адаптера
 * - Инициализация Core с адаптером
 * - Обработка ошибок загрузки
 * - Fallback на custom адаптер
 *
 * ИСПОЛЬЗОВАНИЕ:
 * <script>
 *   window.LEAD_WIDGET_CONFIG = {
 *     projectId: 'your-project-id',
 *     apiUrl: 'https://your-api.com',
 *     debug: false
 *   };
 * </script>
 * <script src="https://your-cdn.com/widget-loader.js"></script>
 */

(function () {
  'use strict';

  /**
   * Конфигурация загрузчика
   */
  const LOADER_CONFIG = {
    // CDN базовый URL (можно переопределить через window.LEAD_WIDGET_CDN)
    cdnUrl: window.LEAD_WIDGET_CDN || 'https://cdn.example.com/widgets',

    // Версии файлов
    coreVersion: '3.1.0',
    adapterVersion: '3.0.0',

    // Timeout загрузки скриптов (10 секунд)
    loadTimeout: 10000,

    // Retry попытки
    maxRetries: 3
  };

  /**
   * Платформы и их адаптеры
   */
  const PLATFORMS = {
    TILDA: {
      name: 'tilda',
      adapter: 'tilda-adapter.js',
      className: 'TildaAdapter',
      detect: () => {
        return (
          typeof window.tcart !== 'undefined' ||
          typeof window.t_store !== 'undefined' ||
          document.querySelector('.t-records') !== null
        );
      }
    },
    SHOPIFY: {
      name: 'shopify',
      adapter: 'shopify-adapter.js',
      className: 'ShopifyAdapter',
      detect: () => {
        return (
          typeof window.Shopify !== 'undefined' ||
          document.querySelector('[data-shopify]') !== null
        );
      }
    },
    WOOCOMMERCE: {
      name: 'woocommerce',
      adapter: 'woocommerce-adapter.js',
      className: 'WooCommerceAdapter',
      detect: () => {
        return (
          typeof window.wc_add_to_cart_params !== 'undefined' ||
          document.body.classList.contains('woocommerce') ||
          document.querySelector('.woocommerce') !== null
        );
      }
    },
    CUSTOM: {
      name: 'custom',
      adapter: 'custom-adapter.js',
      className: 'CustomAdapter',
      detect: () => true // Всегда true как fallback
    }
  };

  /**
   * Класс загрузчика виджета
   */
  class WidgetLoader {
    constructor() {
      this.config = this.getConfig();
      this.platform = null;
      this.adapter = null;
      this.core = null;
      this.loadedScripts = new Set();
    }

    /**
     * Получить конфигурацию из window
     */
    getConfig() {
      const defaultConfig = {
        projectId: null,
        apiUrl: 'https://bonus.example.com',
        debug: false,
        platform: null // Можно форсировать платформу
      };

      return Object.assign(defaultConfig, window.LEAD_WIDGET_CONFIG || {});
    }

    /**
     * Главный метод инициализации
     */
    async init() {
      try {
        this.log('🚀 Инициализация загрузчика виджета...');

        // Валидация конфигурации
        if (!this.config.projectId) {
          throw new Error('LEAD_WIDGET_CONFIG.projectId не указан');
        }

        // 1. Определение платформы
        this.platform = this.detectPlatform();
        this.log(`✅ Платформа определена: ${this.platform.name}`);

        // 2. Загрузка Core
        await this.loadCore();
        this.log('✅ Core загружен');

        // 3. Загрузка адаптера
        await this.loadAdapter();
        this.log('✅ Адаптер загружен');

        // 4. Создание экземпляров
        this.createInstances();
        this.log('✅ Экземпляры созданы');

        // 5. Инициализация виджета
        await this.initWidget();
        this.log('✅ Виджет инициализирован');

        // Сохраняем в window для доступа
        window.LeadWidget = {
          core: this.core,
          adapter: this.adapter,
          platform: this.platform.name,
          version: LOADER_CONFIG.coreVersion
        };

        this.log('🎉 Виджет успешно загружен и готов к работе');
      } catch (error) {
        console.error('❌ Ошибка загрузки виджета:', error);
        this.handleError(error);
      }
    }

    /**
     * Определение платформы
     */
    detectPlatform() {
      // Если платформа форсирована в конфиге
      if (this.config.platform) {
        const forcedPlatform = Object.values(PLATFORMS).find(
          (p) => p.name === this.config.platform
        );
        if (forcedPlatform) {
          this.log(`⚙️ Платформа форсирована: ${forcedPlatform.name}`);
          return forcedPlatform;
        }
      }

      // Автоопределение
      for (const platform of Object.values(PLATFORMS)) {
        if (platform.name === 'custom') continue; // Custom проверяем последним

        if (platform.detect()) {
          return platform;
        }
      }

      // Fallback на custom
      this.log('⚠️ Платформа не определена, используется custom адаптер');
      return PLATFORMS.CUSTOM;
    }

    /**
     * Загрузка Core скрипта
     */
    async loadCore() {
      const coreUrl = `${LOADER_CONFIG.cdnUrl}/universal-widget.js?v=${LOADER_CONFIG.coreVersion}`;

      // Проверяем что Core еще не загружен
      if (typeof window.LeadWidgetCore !== 'undefined') {
        this.log('ℹ️ Core уже загружен');
        return;
      }

      await this.loadScript(coreUrl, 'LeadWidgetCore');
    }

    /**
     * Загрузка адаптера
     */
    async loadAdapter() {
      const adapterUrl = `${LOADER_CONFIG.cdnUrl}/${this.platform.adapter}?v=${LOADER_CONFIG.adapterVersion}`;

      // Проверяем что адаптер еще не загружен
      if (typeof window[this.platform.className] !== 'undefined') {
        this.log(`ℹ️ Адаптер ${this.platform.className} уже загружен`);
        return;
      }

      try {
        await this.loadScript(adapterUrl, this.platform.className);
      } catch (error) {
        // Если адаптер не найден, пробуем загрузить custom
        if (this.platform.name !== 'custom') {
          this.log(
            `⚠️ Адаптер ${this.platform.name} не найден, fallback на custom`
          );
          this.platform = PLATFORMS.CUSTOM;

          const customUrl = `${LOADER_CONFIG.cdnUrl}/${PLATFORMS.CUSTOM.adapter}?v=${LOADER_CONFIG.adapterVersion}`;
          await this.loadScript(customUrl, PLATFORMS.CUSTOM.className);
        } else {
          throw error;
        }
      }
    }

    /**
     * Загрузка скрипта с retry
     */
    async loadScript(url, globalName, retryCount = 0) {
      // Проверяем кеш загруженных скриптов
      if (this.loadedScripts.has(url)) {
        return;
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;

        // Timeout
        const timeoutId = setTimeout(() => {
          script.remove();
          reject(new Error(`Timeout загрузки ${url}`));
        }, LOADER_CONFIG.loadTimeout);

        script.onload = () => {
          clearTimeout(timeoutId);

          // Проверяем что глобальная переменная доступна
          if (globalName && typeof window[globalName] === 'undefined') {
            reject(new Error(`${globalName} не найден после загрузки ${url}`));
            return;
          }

          this.loadedScripts.add(url);
          this.log(`✅ Скрипт загружен: ${url}`);
          resolve();
        };

        script.onerror = async () => {
          clearTimeout(timeoutId);
          script.remove();

          // Retry
          if (retryCount < LOADER_CONFIG.maxRetries) {
            this.log(
              `🔄 Retry ${retryCount + 1}/${LOADER_CONFIG.maxRetries}: ${url}`
            );
            await new Promise((r) =>
              setTimeout(r, 1000 * Math.pow(2, retryCount))
            );

            try {
              await this.loadScript(url, globalName, retryCount + 1);
              resolve();
            } catch (e) {
              reject(e);
            }
          } else {
            reject(
              new Error(
                `Ошибка загрузки ${url} после ${LOADER_CONFIG.maxRetries} попыток`
              )
            );
          }
        };

        document.head.appendChild(script);
      });
    }

    /**
     * Создание экземпляров Core и Adapter
     */
    createInstances() {
      // Создаем экземпляр Core
      if (typeof window.LeadWidgetCore === 'undefined') {
        throw new Error('LeadWidgetCore не загружен');
      }

      // Создаем экземпляр адаптера
      const AdapterClass = window[this.platform.className];
      if (typeof AdapterClass === 'undefined') {
        throw new Error(`${this.platform.className} не загружен`);
      }

      // Сначала создаем Core без адаптера
      this.core = new window.LeadWidgetCore({
        projectId: this.config.projectId,
        apiUrl: this.config.apiUrl,
        debug: this.config.debug,
        adapter: null
      });

      // Создаем адаптер с ссылкой на Core
      this.adapter = new AdapterClass(this.core);

      // Устанавливаем адаптер в Core
      this.core.setAdapter(this.adapter);
    }

    /**
     * Инициализация виджета
     */
    async initWidget() {
      if (!this.core) {
        throw new Error('Core не создан');
      }

      await this.core.init();
    }

    /**
     * Обработка ошибок
     */
    handleError(error) {
      // Показываем пользователю уведомление об ошибке
      if (this.config.debug) {
        alert(`Ошибка загрузки виджета: ${error.message}`);
      }

      // Отправляем ошибку на сервер (если настроено)
      if (this.config.errorReportingUrl) {
        this.reportError(error);
      }
    }

    /**
     * Отправка ошибки на сервер
     */
    async reportError(error) {
      try {
        await fetch(this.config.errorReportingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: this.config.projectId,
            platform: this.platform?.name,
            error: {
              message: error.message,
              stack: error.stack
            },
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }

    /**
     * Логирование
     */
    log(...args) {
      if (this.config.debug) {
        console.log('[WidgetLoader]', ...args);
      }
    }
  }

  /**
   * Автоматическая инициализация при загрузке DOM
   */
  function autoInit() {
    // Проверяем что конфигурация задана
    if (!window.LEAD_WIDGET_CONFIG) {
      console.warn('⚠️ LEAD_WIDGET_CONFIG не найден, виджет не будет загружен');
      return;
    }

    // Создаем и запускаем загрузчик
    const loader = new WidgetLoader();
    loader.init();
  }

  // Запускаем автоинициализацию
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM уже загружен
    autoInit();
  }

  // Экспортируем класс для ручной инициализации
  window.WidgetLoader = WidgetLoader;
})();
