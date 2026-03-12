/**
 * @file: insales-api-client.ts
 * @description: Клиент для работы с InSales REST API
 * @project: SaaS Bonus System
 * @dependencies: InSales REST API
 * @created: 2026-03-02
 */

import { logger } from '@/lib/logger';
import type {
  InSalesApiClientConfig,
  InSalesApiResponse,
  InSalesClient,
  InSalesOrder
} from './types';

export class InSalesApiClient {
  private apiKey: string;
  private apiPassword: string;
  private shopDomain: string;
  private baseUrl: string;

  constructor(config: InSalesApiClientConfig) {
    this.apiKey = config.apiKey;
    this.apiPassword = config.apiPassword;
    this.shopDomain = config.shopDomain;
    this.baseUrl = `https://${config.shopDomain}`;
  }

  /**
   * Базовый метод для выполнения запросов к InSales API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<InSalesApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    // Basic Auth
    const auth = Buffer.from(`${this.apiKey}:${this.apiPassword}`).toString(
      'base64'
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error(
          'InSales API request failed',
          {
            endpoint,
            status: response.status,
            error: data
          },
          'insales-api-client'
        );

        return {
          error: data.message || 'InSales API request failed',
          status: response.status
        };
      }

      return {
        data,
        status: response.status
      };
    } catch (error) {
      logger.error(
        'InSales API request error',
        {
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'insales-api-client'
      );

      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500
      };
    }
  }

  /**
   * Получить заказ по ID
   */
  async getOrder(orderId: number): Promise<InSalesApiResponse<InSalesOrder>> {
    return this.request<InSalesOrder>(`/admin/orders/${orderId}.json`);
  }

  /**
   * Получить клиента по ID
   */
  async getClient(
    clientId: number
  ): Promise<InSalesApiResponse<InSalesClient>> {
    return this.request<InSalesClient>(`/admin/clients/${clientId}.json`);
  }

  /**
   * Обновить заказ
   */
  async updateOrder(
    orderId: number,
    data: Partial<InSalesOrder>
  ): Promise<InSalesApiResponse<InSalesOrder>> {
    return this.request<InSalesOrder>(`/admin/orders/${orderId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ order: data })
    });
  }

  /**
   * Получить список заказов
   */
  async getOrders(params?: {
    page?: number;
    per_page?: number;
    updated_since?: string;
  }): Promise<InSalesApiResponse<InSalesOrder[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page)
      searchParams.set('per_page', params.per_page.toString());
    if (params?.updated_since)
      searchParams.set('updated_since', params.updated_since);

    const query = searchParams.toString();
    const endpoint = `/admin/orders.json${query ? `?${query}` : ''}`;

    return this.request<InSalesOrder[]>(endpoint);
  }

  /**
   * Получить список клиентов
   */
  async getClients(params?: {
    page?: number;
    per_page?: number;
    email?: string;
    phone?: string;
  }): Promise<InSalesApiResponse<InSalesClient[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page)
      searchParams.set('per_page', params.per_page.toString());
    if (params?.email) searchParams.set('email', params.email);
    if (params?.phone) searchParams.set('phone', params.phone);

    const query = searchParams.toString();
    const endpoint = `/admin/clients.json${query ? `?${query}` : ''}`;

    return this.request<InSalesClient[]>(endpoint);
  }

  /**
   * Обновить клиента
   */
  async updateClient(
    clientId: number,
    data: Partial<InSalesClient> | { fields_values_attributes: any[] }
  ): Promise<InSalesApiResponse<InSalesClient>> {
    return this.request<InSalesClient>(`/admin/clients/${clientId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ client: data })
    });
  }

  /**
   * Проверить подключение к API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.request('/admin/account.json');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
