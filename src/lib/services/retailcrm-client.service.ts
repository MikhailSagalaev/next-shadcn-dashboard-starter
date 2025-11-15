/**
 * @file: src/lib/services/retailcrm-client.service.ts
 * @description: API клиент для интеграции с RetailCRM
 * @project: SaaS Bonus System
 * @dependencies: axios, logger
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export interface RetailCrmOrder {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  customer: {
    id: number;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  totalSumm: number;
  customFields?: Record<string, any>;
}

export interface RetailCrmCustomer {
  id: number;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  customFields?: Record<string, any>;
}

export interface RetailCrmApiResponse<T = any> {
  success: boolean;
  pagination?: {
    limit: number;
    totalCount: number;
    currentPage: number;
    totalPageCount: number;
  };
  [key: string]: any;
}

export class RetailCrmClientService {
  private apiClient: AxiosInstance;
  private projectId: string;
  private apiUrl: string;
  private apiKey: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    
    // Загружаем настройки интеграции из БД
    // В реальной реализации это должно быть кэшировано
  }

  /**
   * Инициализация клиента с настройками из БД
   */
  static async create(projectId: string): Promise<RetailCrmClientService> {
    const integration = await db.retailCrmIntegration.findUnique({
      where: { projectId },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Интеграция с RetailCRM не настроена или неактивна');
    }

    const client = new RetailCrmClientService(projectId);
    client.apiUrl = integration.apiUrl;
    client.apiKey = integration.apiKey;

    // Создаем Axios клиент
    client.apiClient = axios.create({
      baseURL: `${integration.apiUrl}/api/v5`,
      timeout: 30000,
      headers: {
        'X-API-KEY': integration.apiKey,
        'Content-Type': 'application/json',
      },
    });

    return client;
  }

  /**
   * Получение заказов из RetailCRM
   */
  async getOrders(filters?: {
    status?: string;
    sinceId?: number;
    limit?: number;
    page?: number;
  }): Promise<RetailCrmOrder[]> {
    try {
      const params: Record<string, any> = {
        limit: filters?.limit || 20,
        page: filters?.page || 1,
      };

      if (filters?.status) {
        params.status = filters.status;
      }

      if (filters?.sinceId) {
        params.sinceId = filters.sinceId;
      }

      const response = await this.apiClient.get<RetailCrmApiResponse<{ orders: RetailCrmOrder[] }>>('/orders', {
        params,
      });

      if (!response.data.success) {
        throw new Error('Ошибка получения заказов из RetailCRM');
      }

      return response.data.orders || [];
    } catch (error) {
      logger.error('Ошибка получения заказов из RetailCRM', {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Получение клиентов из RetailCRM
   */
  async getCustomers(filters?: {
    sinceId?: number;
    limit?: number;
    page?: number;
  }): Promise<RetailCrmCustomer[]> {
    try {
      const params: Record<string, any> = {
        limit: filters?.limit || 20,
        page: filters?.page || 1,
      };

      if (filters?.sinceId) {
        params.sinceId = filters.sinceId;
      }

      const response = await this.apiClient.get<RetailCrmApiResponse<{ customers: RetailCrmCustomer[] }>>('/customers', {
        params,
      });

      if (!response.data.success) {
        throw new Error('Ошибка получения клиентов из RetailCRM');
      }

      return response.data.customers || [];
    } catch (error) {
      logger.error('Ошибка получения клиентов из RetailCRM', {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Создание заказа в RetailCRM
   */
  async createOrder(orderData: {
    number: string;
    customerId?: number;
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
    totalSumm: number;
    customFields?: Record<string, any>;
  }): Promise<RetailCrmOrder> {
    try {
      const response = await this.apiClient.post<RetailCrmApiResponse<{ order: RetailCrmOrder }>>('/orders/create', {
        order: orderData,
      });

      if (!response.data.success) {
        throw new Error('Ошибка создания заказа в RetailCRM');
      }

      return response.data.order;
    } catch (error) {
      logger.error('Ошибка создания заказа в RetailCRM', {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Обновление заказа в RetailCRM
   */
  async updateOrder(orderId: number, orderData: Partial<RetailCrmOrder>): Promise<RetailCrmOrder> {
    try {
      const response = await this.apiClient.post<RetailCrmApiResponse<{ order: RetailCrmOrder }>>(`/orders/${orderId}/edit`, {
        order: orderData,
      });

      if (!response.data.success) {
        throw new Error('Ошибка обновления заказа в RetailCRM');
      }

      return response.data.order;
    } catch (error) {
      logger.error('Ошибка обновления заказа в RetailCRM', {
        projectId: this.projectId,
        orderId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Создание клиента в RetailCRM
   */
  async createCustomer(customerData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    customFields?: Record<string, any>;
  }): Promise<RetailCrmCustomer> {
    try {
      const response = await this.apiClient.post<RetailCrmApiResponse<{ customer: RetailCrmCustomer }>>('/customers/create', {
        customer: customerData,
      });

      if (!response.data.success) {
        throw new Error('Ошибка создания клиента в RetailCRM');
      }

      return response.data.customer;
    } catch (error) {
      logger.error('Ошибка создания клиента в RetailCRM', {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Обновление клиента в RetailCRM
   */
  async updateCustomer(customerId: number, customerData: Partial<RetailCrmCustomer>): Promise<RetailCrmCustomer> {
    try {
      const response = await this.apiClient.post<RetailCrmApiResponse<{ customer: RetailCrmCustomer }>>(`/customers/${customerId}/edit`, {
        customer: customerData,
      });

      if (!response.data.success) {
        throw new Error('Ошибка обновления клиента в RetailCRM');
      }

      return response.data.customer;
    } catch (error) {
      logger.error('Ошибка обновления клиента в RetailCRM', {
        projectId: this.projectId,
        customerId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      throw error;
    }
  }

  /**
   * Проверка соединения с RetailCRM
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/statistics/overview');
      return response.data.success === true;
    } catch (error) {
      logger.error('Ошибка проверки соединения с RetailCRM', {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'retailcrm-client',
      });
      return false;
    }
  }
}

