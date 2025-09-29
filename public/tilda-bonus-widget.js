/**
 * @file: tilda-bonus-widget.js
 * @description: Готовый виджет для интеграции бонусной системы с Tilda
 * @project: SaaS Bonus System
 * @version: 2.6.0
 * @author: AI Assistant + User
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
      debug: false,
      debounceMs: 400
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
      originalCartTotal: 0 // изначальная сумма корзины без бонусов
    },

    // Инициализация виджета
    init: function (userConfig) {
      // Объединяем конфигурацию
      this.config = Object.assign({}, this.config, userConfig);

      // Проверяем обязательные параметры
      if (!this.config.projectId) {
        console.error('[TildaBonusWidget] Ошибка: projectId не указан');
        return;
      }

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

      this.state.initialized = true;
      this.log('Виджет инициализирован', this.config);
    },

    // Логирование (только в debug режиме)
    log: function () {
      if (this.config.debug) {
        console.log('[TildaBonusWidget]', ...arguments);
      }
    },

    // Создание UI элементов
    initUI: function () {
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

    // Очистка ресурсов для предотвращения утечек памяти
    cleanup: function () {
      this.log('Очистка ресурсов виджета');

      // Отменяем активные запросы
      if (this.state.activeFetchController) {
        try {
          this.state.activeFetchController.abort();
        } catch (_) {}
        this.state.activeFetchController = null;
      }

      // Очищаем таймеры
      if (this.state.balanceDebounceTimer) {
        clearTimeout(this.state.balanceDebounceTimer);
        this.state.balanceDebounceTimer = null;
      }
      if (this.state.cartOpenDebounceTimer) {
        clearTimeout(this.state.cartOpenDebounceTimer);
        this.state.cartOpenDebounceTimer = null;
      }

      // Отключаем observers
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
        originalCartTotal: 0
      };

      this.log('Ресурсы виджета очищены');
    },

    // Получить настройки проекта для плашки регистрации
    loadProjectSettings: async function () {
      try {
        const cacheBuster = Date.now(); // Предотвращаем кэширование
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут

        const response = await fetch(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/bot?t=${cacheBuster}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const settings = await response.json();
          return {
            welcomeBonusAmount: Number(settings?.welcomeBonusAmount || 0),
            botUsername: settings?.botUsername || null
          };
        } else {
          this.log('API вернул ошибку:', response.status, response.statusText);
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

        // Проверяем локальное хранилище сначала
        const cachedSettings = this.getCachedProjectSettings();
        if (cachedSettings) {
          this.log('📋 Используем кэшированные настройки:', cachedSettings);
          return cachedSettings;
        }

        this.log('🌐 Кэш пуст, загружаем из API...');

        // Если нет в кэше, пытаемся загрузить из API с упрощенным методом
        const settings = await this.loadProjectSettingsSimple();

        // Сохраняем в кэш на 1 час
        this.cacheProjectSettings(settings, 60 * 60 * 1000);

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
            botUsername: data?.botUsername || null
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
          timestamp: Date.now(),
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
        const botUsername = String(settings.botUsername || '').replace(
          /[<>'"&]/g,
          ''
        );

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
        promptDiv.innerHTML = `
          <div class="registration-prompt" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          ">
            <div class="registration-icon" style="font-size: 24px; margin-bottom: 8px;">🎁</div>
            <div class="registration-title" style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
              Зарегистрируйся и получи ${welcomeBonusAmount} бонусов!
            </div>
            <div class="registration-description" style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
              Зарегистрируйся в нашей бонусной программе
            </div>
            <div class="registration-action">
              ${
                botUsername
                  ? `<a href="https://t.me/${botUsername}" target="_blank" class="registration-button" style="
                      display: inline-block;
                      background: rgba(255,255,255,0.2);
                      color: white;
                      padding: 8px 16px;
                      border-radius: 6px;
                      text-decoration: none;
                      font-weight: 500;
                      transition: all 0.3s ease;
                      border: 1px solid rgba(255,255,255,0.3);
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                      Для участия в акции перейдите в бота
                    </a>`
                  : '<div style="font-size: 14px; opacity: 0.8;">Свяжитесь с администратором для регистрации</div>'
              }
            </div>
          </div>
        `;

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
        const cartWindow = document.querySelector('.t706__cartwin');
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
        self.log('🚨 Получено событие tcart:updated');
        // Автоматически корректируем бонусы при изменении корзины
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateBalanceDisplay();
        }, 100);
      });

      // Слушаем события изменения количества товаров
      document.addEventListener('click', (event) => {
        if (
          event.target.closest(
            '.t706__product-plus, .t706__product-minus, .t706__product-del'
          )
        ) {
          self.log('🚨 Клик по кнопке изменения количества товара');
          setTimeout(() => {
            self.adjustBonusesForCartChange();
            self.updateBalanceDisplay();
            self.log('✅ Обновляем виджет после изменения количества товаров');
          }, 200);
        }
      });

      // Слушаем события изменения количества через API Tilda
      document.addEventListener('tcart:quantity:changed', (event) => {
        self.log('🚨 Получено событие tcart:quantity:changed');
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateBalanceDisplay();
          self.forceUpdateCartDisplay();
        }, 150);
      });

      // Слушаем события пересчета корзины
      document.addEventListener('tcart:recalculated', (event) => {
        self.log('🚨 Получено событие tcart:recalculated');
        setTimeout(() => {
          self.adjustBonusesForCartChange();
          self.updateBalanceDisplay();
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

            if (shouldCheckBonuses && self.state.appliedBonuses > 0) {
              self.log(
                '🔄 Обнаружено изменение в корзине через MutationObserver'
              );
              setTimeout(() => {
                self.adjustBonusesForCartChange();
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
      const userContact = this.getUserContact();

      if (userContact && (userContact.email || userContact.phone)) {
        // У пользователя есть контактные данные - показываем виджет с балансом
        this.log('Пользователь авторизован - показываем виджет с балансом');
        this.hideRegistrationPrompt();
        this.ensureWidgetMounted();
        this.loadUserBalance(userContact);
      } else {
        // У пользователя нет контактных данных - показываем плашку регистрации
        this.log('Пользователь не авторизован - показываем плашку регистрации');
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

        // Восстанавливаем оригинальное поле промокода вместо виджета
        const widgetContainer = document.querySelector(
          '.bonus-widget-container'
        );
        if (widgetContainer && this.state.promoWrapper) {
          widgetContainer.parentNode.replaceChild(
            this.state.promoWrapper,
            widgetContainer
          );
          this.log(
            'Переключено на режим промокода - восстановлено поле промокода'
          );
        }
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
      // Из localStorage
      const savedEmail = localStorage.getItem('tilda_user_email');
      const savedPhone = localStorage.getItem('tilda_user_phone');

      if (savedEmail || savedPhone) {
        return { email: savedEmail, phone: savedPhone };
      }

      // Из полей формы
      const emailField = document.querySelector(
        'input[name="email"], input[type="email"]'
      );
      const phoneField = document.querySelector(
        'input[name="phone"], input[type="tel"]'
      );

      const email = emailField ? emailField.value : null;
      const phone = phoneField ? phoneField.value : null;

      if (email || phone) {
        return { email, phone };
      }

      return null;
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

        const response = await fetch(
          `${this.config.apiUrl}/api/projects/${this.config.projectId}/users/balance?${params}`,
          {
            method: 'GET',
            signal: controller.signal
          }
        );

        const data = await response.json();

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

        // Полностью очищаем промокод при любом изменении корзины
        this.clearAllPromocodes();

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

        this.log('✅ Промокод полностью удален из-за изменения корзины');
      } catch (error) {
        this.log('❌ Ошибка при корректировке бонусов:', error);
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

    // Применение бонусов
    applyBonuses: async function () {
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
