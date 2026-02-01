/**
 * @file: universal-widget.test.ts
 * @description: Unit тесты для Universal Widget Core
 * @project: SaaS Bonus System - Universal Widget
 * @created: 2026-01-31
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock adapter для тестирования
class MockAdapter {
  getCartTotal = vi.fn(() => 5000);
  getContactInfo = vi.fn(() => ({
    email: 'test@example.com',
    phone: '+79991234567'
  }));
  applyPromocode = vi.fn(async () => true);
  observeCart = vi.fn();
  observeContactInput = vi.fn();
  getCartItems = vi.fn(() => []);
}

// Mock LeadWidgetCore
class LeadWidgetCoreMock {
  config: any;
  adapter: any;
  state: Map<string, any>;
  subscribers: Map<string, Set<Function>>;
  cache: Map<string, { data: any; timestamp: number }>;
  requestQueue: Promise<any>[];
  lastRequestTime: number;

  constructor(config: any) {
    this.config = {
      projectId: null,
      apiUrl: 'https://example.com/api',
      debug: false,
      cacheTTL: 60000, // 1 минута
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 10000,
      rateLimitMs: 300,
      ...config
    };

    this.adapter = null;
    this.state = new Map();
    this.subscribers = new Map();
    this.cache = new Map();
    this.requestQueue = [];
    this.lastRequestTime = 0;
  }

  // Adapter management
  setAdapter(adapter: any): void {
    if (!this.validateAdapter(adapter)) {
      throw new Error('Invalid adapter: missing required methods');
    }
    this.adapter = adapter;
  }

  getAdapter(): any {
    return this.adapter;
  }

  validateAdapter(adapter: any): boolean {
    const requiredMethods = [
      'getCartTotal',
      'getContactInfo',
      'applyPromocode',
      'observeCart',
      'observeContactInput'
    ];

    return requiredMethods.every(
      (method) => typeof adapter[method] === 'function'
    );
  }

  // State management
  setState(updates: Record<string, any>): void {
    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = this.state.get(key);
      this.state.set(key, value);
      this.notify(key, value, oldValue);
    });
  }

  getState(key: string): any {
    return this.state.get(key);
  }

  subscribe(key: string, callback: Function): void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
  }

  notify(key: string, newValue: any, oldValue: any): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => callback(newValue, oldValue));
    }
  }

  // Cache management
  getCachedResponse(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCachedResponse(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  // API requests with retry and rate limiting
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<any> {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.config.rateLimitMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.rateLimitMs - timeSinceLastRequest)
        );
      }
      this.lastRequestTime = Date.now();

      // Timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async refreshBonuses(): Promise<void> {
    if (!this.adapter) {
      throw new Error('Adapter not set');
    }

    const contactInfo = this.adapter.getContactInfo();
    if (!contactInfo.email && !contactInfo.phone) {
      return;
    }

    const cacheKey = `bonuses_${contactInfo.email || contactInfo.phone}`;
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      this.setState({ userBonuses: cached.bonuses });
      return;
    }

    const url = `${this.config.apiUrl}/bonuses?email=${contactInfo.email}`;
    const data = await this.fetchWithRetry(url);

    this.setCachedResponse(cacheKey, data);
    this.setState({ userBonuses: data.bonuses });
  }

  async applyPromocode(code: string): Promise<any> {
    if (!this.adapter) {
      throw new Error('Adapter not set');
    }

    const url = `${this.config.apiUrl}/promocodes/apply`;
    const data = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (data.success) {
      await this.adapter.applyPromocode(code);
    }

    return data;
  }
}

describe('LeadWidgetCore', () => {
  let widget: LeadWidgetCoreMock;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    widget = new LeadWidgetCoreMock({
      projectId: 'test-project',
      apiUrl: 'https://example.com/api'
    });
    mockAdapter = new MockAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Adapter Management', () => {
    it('должен установить адаптер', () => {
      widget.setAdapter(mockAdapter);
      expect(widget.getAdapter()).toBe(mockAdapter);
    });

    it('должен выбросить ошибку при невалидном адаптере', () => {
      const invalidAdapter = {
        getCartTotal: () => 0
        // Отсутствуют другие обязательные методы
      };

      expect(() => {
        widget.setAdapter(invalidAdapter);
      }).toThrow('Invalid adapter');
    });

    it('должен валидировать адаптер', () => {
      expect(widget.validateAdapter(mockAdapter)).toBe(true);

      const invalidAdapter = {};
      expect(widget.validateAdapter(invalidAdapter)).toBe(false);
    });
  });

  describe('State Management', () => {
    it('должен установить состояние', () => {
      widget.setState({ userBonuses: 1000 });
      expect(widget.getState('userBonuses')).toBe(1000);
    });

    it('должен обновить несколько значений состояния', () => {
      widget.setState({
        userBonuses: 1000,
        userName: 'Test User',
        userEmail: 'test@example.com'
      });

      expect(widget.getState('userBonuses')).toBe(1000);
      expect(widget.getState('userName')).toBe('Test User');
      expect(widget.getState('userEmail')).toBe('test@example.com');
    });

    it('должен уведомить подписчиков при изменении состояния', () => {
      const callback = vi.fn();
      widget.subscribe('userBonuses', callback);

      widget.setState({ userBonuses: 1000 });

      expect(callback).toHaveBeenCalledWith(1000, undefined);
    });

    it('должен передать старое и новое значение в callback', () => {
      const callback = vi.fn();
      widget.setState({ userBonuses: 500 });
      widget.subscribe('userBonuses', callback);

      widget.setState({ userBonuses: 1000 });

      expect(callback).toHaveBeenCalledWith(1000, 500);
    });

    it('должен поддерживать несколько подписчиков', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      widget.subscribe('userBonuses', callback1);
      widget.subscribe('userBonuses', callback2);

      widget.setState({ userBonuses: 1000 });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('должен кешировать ответы', () => {
      const data = { bonuses: 1000 };
      widget.setCachedResponse('test-key', data);

      const cached = widget.getCachedResponse('test-key');
      expect(cached).toEqual(data);
    });

    it('должен вернуть null для несуществующего ключа', () => {
      const cached = widget.getCachedResponse('non-existent');
      expect(cached).toBeNull();
    });

    it('должен удалить устаревший кеш', () => {
      const data = { bonuses: 1000 };
      widget.config.cacheTTL = 100; // 100ms
      widget.setCachedResponse('test-key', data);

      // Ждем истечения TTL
      return new Promise((resolve) => {
        setTimeout(() => {
          const cached = widget.getCachedResponse('test-key');
          expect(cached).toBeNull();
          resolve(undefined);
        }, 150);
      });
    });

    it('должен очистить весь кеш', () => {
      widget.setCachedResponse('key1', { data: 1 });
      widget.setCachedResponse('key2', { data: 2 });

      widget.clearCache();

      expect(widget.getCachedResponse('key1')).toBeNull();
      expect(widget.getCachedResponse('key2')).toBeNull();
    });
  });

  describe('API Requests', () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = vi.fn();
    });

    it('должен выполнить успешный запрос', async () => {
      const mockResponse = { bonuses: 1000 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await widget.fetchWithRetry(
        'https://example.com/api/test'
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('должен повторить запрос при ошибке', async () => {
      const mockResponse = { bonuses: 1000 };
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

      widget.config.retryDelay = 10; // Ускоряем для теста

      const result = await widget.fetchWithRetry(
        'https://example.com/api/test'
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('должен выбросить ошибку после максимального количества попыток', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      widget.config.retryDelay = 10;
      widget.config.retryAttempts = 2;

      await expect(
        widget.fetchWithRetry('https://example.com/api/test')
      ).rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('должен применить rate limiting', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      widget.config.rateLimitMs = 100;

      const start = Date.now();
      await widget.fetchWithRetry('https://example.com/api/test1');
      await widget.fetchWithRetry('https://example.com/api/test2');
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('refreshBonuses()', () => {
    beforeEach(() => {
      widget.setAdapter(mockAdapter);
      global.fetch = vi.fn();
    });

    it('должен обновить бонусы пользователя', async () => {
      const mockResponse = { bonuses: 1500 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await widget.refreshBonuses();

      expect(widget.getState('userBonuses')).toBe(1500);
      expect(mockAdapter.getContactInfo).toHaveBeenCalled();
    });

    it('должен использовать кеш при повторном запросе', async () => {
      const mockResponse = { bonuses: 1500 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await widget.refreshBonuses();
      await widget.refreshBonuses();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(widget.getState('userBonuses')).toBe(1500);
    });

    it('не должен делать запрос если нет контактов', async () => {
      mockAdapter.getContactInfo.mockReturnValueOnce({ email: '', phone: '' });

      await widget.refreshBonuses();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку если адаптер не установлен', async () => {
      widget.adapter = null;

      await expect(widget.refreshBonuses()).rejects.toThrow('Adapter not set');
    });
  });

  describe('applyPromocode()', () => {
    beforeEach(() => {
      widget.setAdapter(mockAdapter);
      global.fetch = vi.fn();
    });

    it('должен применить промокод', async () => {
      const mockResponse = { success: true, discount: 500 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await widget.applyPromocode('TEST123');

      expect(result).toEqual(mockResponse);
      expect(mockAdapter.applyPromocode).toHaveBeenCalledWith('TEST123');
    });

    it('не должен вызывать adapter.applyPromocode при неуспешном ответе', async () => {
      const mockResponse = { success: false, error: 'Invalid code' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await widget.applyPromocode('INVALID');

      expect(mockAdapter.applyPromocode).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку если адаптер не установлен', async () => {
      widget.adapter = null;

      await expect(widget.applyPromocode('TEST123')).rejects.toThrow(
        'Adapter not set'
      );
    });
  });
});
