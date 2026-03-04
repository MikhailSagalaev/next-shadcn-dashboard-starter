/**
 * InSales Bonus Widget Loader
 * Загрузчик виджета бонусной системы для InSales
 *
 * Использование:
 * <script src="https://gupil.ru/insales-widget-loader.js" data-project-id="YOUR_PROJECT_ID"></script>
 */

(function () {
  'use strict';

  // Получаем projectId из data-атрибута
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var projectId = currentScript.getAttribute('data-project-id');

  if (!projectId) {
    console.error(
      '[InSales Bonus Widget] data-project-id attribute is required'
    );
    return;
  }

  // Базовый URL API
  var API_BASE_URL = currentScript.src.replace('/insales-widget-loader.js', '');

  // Загружаем настройки виджета
  fetch(API_BASE_URL + '/api/insales/widget-settings/' + projectId)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to load widget settings');
      }
      return response.json();
    })
    .then(function (data) {
      if (!data.success || !data.settings.widgetEnabled) {
        console.log('[InSales Bonus Widget] Widget is disabled');
        return;
      }

      // Сохраняем настройки глобально
      window.InSalesBonusWidget = window.InSalesBonusWidget || {};
      window.InSalesBonusWidget.settings = data.settings;
      window.InSalesBonusWidget.API_BASE_URL = API_BASE_URL;

      // Загружаем основной скрипт виджета
      var script = document.createElement('script');
      script.src = API_BASE_URL + '/insales-bonus-widget.js';
      script.async = true;
      script.onload = function () {
        console.log('[InSales Bonus Widget] Widget loaded successfully');

        // Инициализируем виджет
        if (window.InSalesBonusWidget && window.InSalesBonusWidget.init) {
          window.InSalesBonusWidget.init();
        }
      };
      script.onerror = function () {
        console.error('[InSales Bonus Widget] Failed to load widget script');
      };
      document.head.appendChild(script);

      // Загружаем стили
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = API_BASE_URL + '/insales-bonus-widget.css';
      document.head.appendChild(link);
    })
    .catch(function (error) {
      console.error('[InSales Bonus Widget] Error:', error);
    });
})();
