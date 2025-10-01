/**
 * @file: src/lib/services/bot-flow-executor/external-api-integration.ts
 * @description: Интеграция с внешними API для потоков бота
 * @project: SaaS Bonus System
 * @dependencies: Grammy, FlowExecutor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';

export interface ApiRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
  timeout?: number;
  retries?: number;
  auth?: {
    type: 'bearer' | 'basic' | 'api_key' | 'custom';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
  responseMapping?: {
    successPath?: string;
    errorPath?: string;
    dataPath?: string;
  };
}

export interface ApiResponse {
  success: boolean;
  status: number;
  data: any;
  error?: string;
  headers: Record<string, string>;
  duration: number;
}

export class ExternalApiIntegration {
  private static instance: ExternalApiIntegration;
  private requestCache = new Map<
    string,
    { response: ApiResponse; timestamp: number }
  >();
  private maxCacheSize = 100;
  private cacheTTL = 300000; // 5 минут

  static getInstance(): ExternalApiIntegration {
    if (!ExternalApiIntegration.instance) {
      ExternalApiIntegration.instance = new ExternalApiIntegration();
    }
    return ExternalApiIntegration.instance;
  }

  /**
   * Выполнение API запроса
   */
  async executeRequest(request: ApiRequest): Promise<ApiResponse> {
    const startTime = Date.now();

    try {
      // Проверка кэша для GET запросов
      if (request.method === 'GET') {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          logger.info('Using cached API response', {
            requestId: request.id,
            url: request.url
          });
          return cached;
        }
      }

      // Подготовка запроса
      const url = this.buildUrl(request);
      const headers = this.buildHeaders(request);
      const body = this.buildBody(request);

      logger.info('Executing API request', {
        requestId: request.id,
        method: request.method,
        url: request.url,
        hasAuth: !!request.auth
      });

      // Выполнение запроса с повторными попытками
      let lastError: Error | null = null;
      const maxRetries = request.retries || 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.makeHttpRequest(
            request.method,
            url,
            headers,
            body,
            request.timeout || 30000
          );

          const duration = Date.now() - startTime;
          const apiResponse = this.parseResponse(response, duration);

          // Кэширование успешных GET запросов
          if (request.method === 'GET' && apiResponse.success) {
            const cacheKey = this.generateCacheKey(request);
            this.setCachedResponse(cacheKey, apiResponse);
          }

          logger.info('API request completed', {
            requestId: request.id,
            status: apiResponse.status,
            duration,
            success: apiResponse.success
          });

          return apiResponse;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Экспоненциальная задержка
            logger.warn('API request failed, retrying', {
              requestId: request.id,
              attempt: attempt + 1,
              maxRetries,
              delay,
              error: lastError.message
            });
            await this.delay(delay);
          }
        }
      }

      // Все попытки исчерпаны
      const duration = Date.now() - startTime;
      logger.error('API request failed after all retries', {
        requestId: request.id,
        error: lastError?.message,
        duration
      });

      return {
        success: false,
        status: 0,
        data: null,
        error: lastError?.message || 'Unknown error',
        headers: {},
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('API request execution error', {
        requestId: request.id,
        error: errorMessage,
        duration
      });

      return {
        success: false,
        status: 0,
        data: null,
        error: errorMessage,
        headers: {},
        duration
      };
    }
  }

  /**
   * Выполнение HTTP запроса
   */
  private async makeHttpRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  /**
   * Парсинг ответа API
   */
  private parseResponse(response: Response, duration: number): ApiResponse {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      success: response.ok,
      status: response.status,
      headers,
      duration,
      data: null, // Будет заполнено после парсинга
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  }

  /**
   * Получение и парсинг тела ответа
   */
  async getResponseData(
    response: ApiResponse,
    rawResponse: Response
  ): Promise<ApiResponse> {
    try {
      const contentType = response.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        response.data = await rawResponse.json();
      } else if (contentType.includes('text/')) {
        response.data = await rawResponse.text();
      } else {
        response.data = await rawResponse.blob();
      }

      return response;
    } catch (error) {
      logger.warn('Failed to parse response data', {
        error: error instanceof Error ? error.message : String(error),
        contentType: response.headers['content-type']
      });

      response.data = null;
      response.error = 'Failed to parse response';
      return response;
    }
  }

  /**
   * Построение полного URL с query параметрами
   */
  private buildUrl(request: ApiRequest): string {
    let url = request.url;

    if (request.queryParams && Object.keys(request.queryParams).length > 0) {
      const urlObj = new URL(url);
      Object.entries(request.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlObj.searchParams.set(key, String(value));
        }
      });
      url = urlObj.toString();
    }

    return url;
  }

  /**
   * Построение заголовков запроса
   */
  private buildHeaders(request: ApiRequest): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SaaS-Bonus-System-Bot/1.0',
      ...request.headers
    };

    // Добавление аутентификации
    if (request.auth) {
      switch (request.auth.type) {
        case 'bearer':
          if (request.auth.token) {
            headers['Authorization'] = `Bearer ${request.auth.token}`;
          }
          break;

        case 'basic':
          if (request.auth.username && request.auth.password) {
            const credentials = btoa(
              `${request.auth.username}:${request.auth.password}`
            );
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;

        case 'api_key':
          if (request.auth.apiKey) {
            const headerName = request.auth.headerName || 'X-API-Key';
            headers[headerName] = request.auth.apiKey;
          }
          break;

        case 'custom':
          // Пользовательские заголовки уже добавлены выше
          break;
      }
    }

    return headers;
  }

  /**
   * Построение тела запроса
   */
  private buildBody(request: ApiRequest): any {
    if (request.method === 'GET' || request.method === 'DELETE') {
      return null;
    }

    return request.body;
  }

  /**
   * Генерация ключа кэша
   */
  private generateCacheKey(request: ApiRequest): string {
    const keyData = {
      method: request.method,
      url: request.url,
      queryParams: request.queryParams,
      headers: request.headers
    };

    return btoa(JSON.stringify(keyData));
  }

  /**
   * Получение кэшированного ответа
   */
  private getCachedResponse(cacheKey: string): ApiResponse | null {
    const cached = this.requestCache.get(cacheKey);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.requestCache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  /**
   * Сохранение ответа в кэш
   */
  private setCachedResponse(cacheKey: string, response: ApiResponse): void {
    // Очистка старых записей если превышен лимит
    if (this.requestCache.size >= this.maxCacheSize) {
      const oldestKey = this.requestCache.keys().next().value;
      this.requestCache.delete(oldestKey);
    }

    this.requestCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.requestCache.clear();
    logger.info('API response cache cleared');
  }

  /**
   * Получение статистики кэша
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.requestCache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0 // TODO: Реализовать подсчет hit rate
    };
  }

  /**
   * Задержка выполнения
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ ПРЕДОПРЕДЕЛЕННЫЕ ИНТЕГРАЦИИ ============

  /**
   * Интеграция с Telegram Bot API
   */
  static async sendTelegramMessage(
    botToken: string,
    chatId: string | number,
    text: string,
    options?: any
  ): Promise<ApiResponse> {
    const request: ApiRequest = {
      id: `telegram_send_${Date.now()}`,
      method: 'POST',
      url: `https://api.telegram.org/bot${botToken}/sendMessage`,
      body: {
        chat_id: chatId,
        text,
        ...options
      }
    };

    return ExternalApiIntegration.getInstance().executeRequest(request);
  }

  /**
   * Интеграция с внешним сервисом уведомлений
   */
  static async sendNotification(
    serviceUrl: string,
    notification: {
      title: string;
      message: string;
      recipient: string;
      type: 'email' | 'sms' | 'push';
    }
  ): Promise<ApiResponse> {
    const request: ApiRequest = {
      id: `notification_${Date.now()}`,
      method: 'POST',
      url: `${serviceUrl}/notifications`,
      body: notification,
      auth: {
        type: 'bearer',
        token: process.env.NOTIFICATION_SERVICE_TOKEN
      }
    };

    return ExternalApiIntegration.getInstance().executeRequest(request);
  }

  /**
   * Интеграция с платежным шлюзом
   */
  static async processPayment(
    gatewayUrl: string,
    payment: {
      amount: number;
      currency: string;
      description: string;
      customerId: string;
    }
  ): Promise<ApiResponse> {
    const request: ApiRequest = {
      id: `payment_${Date.now()}`,
      method: 'POST',
      url: `${gatewayUrl}/payments`,
      body: payment,
      auth: {
        type: 'api_key',
        apiKey: process.env.PAYMENT_GATEWAY_KEY,
        headerName: 'X-API-Key'
      }
    };

    return ExternalApiIntegration.getInstance().executeRequest(request);
  }

  /**
   * Интеграция с CRM системой
   */
  static async updateCustomerData(
    crmUrl: string,
    customerId: string,
    data: Record<string, any>
  ): Promise<ApiResponse> {
    const request: ApiRequest = {
      id: `crm_update_${customerId}`,
      method: 'PUT',
      url: `${crmUrl}/customers/${customerId}`,
      body: data,
      auth: {
        type: 'bearer',
        token: process.env.CRM_API_TOKEN
      }
    };

    return ExternalApiIntegration.getInstance().executeRequest(request);
  }

  /**
   * Интеграция с сервисом аналитики
   */
  static async trackEvent(
    analyticsUrl: string,
    event: {
      eventName: string;
      userId: string;
      properties: Record<string, any>;
      timestamp?: string;
    }
  ): Promise<ApiResponse> {
    const request: ApiRequest = {
      id: `analytics_${Date.now()}`,
      method: 'POST',
      url: `${analyticsUrl}/events`,
      body: event,
      auth: {
        type: 'api_key',
        apiKey: process.env.ANALYTICS_API_KEY
      }
    };

    return ExternalApiIntegration.getInstance().executeRequest(request);
  }
}

// Экспорт синглтона
export const externalApi = ExternalApiIntegration.getInstance();
