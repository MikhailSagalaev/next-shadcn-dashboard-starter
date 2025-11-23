/**
 * @file: src/lib/services/chat-manager.service.ts
 * @description: Сервис для управления чатами из различных мессенджеров
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger, Grammy
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ChatChannelType, ChatStatus } from '@prisma/client';

export interface CreateChatChannelInput {
  projectId: string;
  type: ChatChannelType;
  name: string;
  credentials: Record<string, any>;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface CreateChatInput {
  projectId: string;
  channelId: string;
  externalId: string;
  userId?: string;
  status?: ChatStatus;
  metadata?: Record<string, any>;
}

export interface CreateChatMessageInput {
  chatId: string;
  externalId?: string;
  message: string;
  direction: 'INCOMING' | 'OUTGOING';
  senderName?: string;
  senderId?: string;
  metadata?: Record<string, any>;
}

export class ChatManagerService {
  /**
   * Создание канала чата
   */
  static async createChannel(data: CreateChatChannelInput) {
    try {
      const channel = await db.chatChannel.create({
        data: {
          projectId: data.projectId,
          type: data.type,
          name: data.name,
          credentials: data.credentials, // В реальности нужно зашифровать
          isActive: data.isActive ?? true,
          metadata: data.metadata
        }
      });

      logger.info('Канал чата создан', {
        channelId: channel.id,
        projectId: data.projectId,
        type: data.type,
        component: 'chat-manager-service'
      });

      return channel;
    } catch (error) {
      logger.error('Ошибка создания канала чата', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Создание или получение чата
   */
  static async getOrCreateChat(data: CreateChatInput) {
    try {
      // Ищем существующий чат
      let chat = await db.chat.findFirst({
        where: {
          projectId: data.projectId,
          channelId: data.channelId,
          externalId: data.externalId
        },
        include: {
          channel: true,
          user: true,
          messages: {
            take: 50,
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!chat) {
        // Создаем новый чат
        chat = await db.chat.create({
          data: {
            projectId: data.projectId,
            channelId: data.channelId,
            externalId: data.externalId,
            userId: data.userId,
            status: data.status || 'OPEN',
            metadata: data.metadata
          },
          include: {
            channel: true,
            user: true,
            messages: {
              take: 50,
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        });
      }

      return chat;
    } catch (error) {
      logger.error('Ошибка создания/получения чата', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Получение списка чатов
   */
  static async getChats(
    projectId: string,
    filters?: {
      channelId?: string;
      status?: ChatStatus;
      userId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    try {
      const {
        channelId,
        status,
        userId,
        page = 1,
        pageSize = 20
      } = filters || {};

      const where: any = {
        projectId
      };

      if (channelId) {
        where.channelId = channelId;
      }

      if (status) {
        where.status = status;
      }

      if (userId) {
        where.userId = userId;
      }

      const [chats, total] = await Promise.all([
        db.chat.findMany({
          where,
          include: {
            channel: true,
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true
              }
            },
            _count: {
              select: {
                messages: true
              }
            }
          },
          orderBy: {
            lastMessageAt: 'desc'
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        db.chat.count({ where })
      ]);

      return {
        chats,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('Ошибка получения списка чатов', {
        projectId,
        filters,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Получение сообщений чата
   */
  static async getChatMessages(
    projectId: string,
    chatId: string,
    options?: { limit?: number; offset?: number }
  ) {
    try {
      // Проверяем, что чат принадлежит проекту
      const chat = await db.chat.findFirst({
        where: {
          id: chatId,
          projectId
        }
      });

      if (!chat) {
        throw new Error('Чат не найден');
      }

      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      const messages = await db.chatMessage.findMany({
        where: { chatId },
        orderBy: {
          createdAt: 'asc'
        },
        skip: offset,
        take: limit
      });

      return messages;
    } catch (error) {
      logger.error('Ошибка получения сообщений чата', {
        chatId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Добавление сообщения в чат
   */
  static async addMessageToChat(
    projectId: string,
    chatId: string,
    data: CreateChatMessageInput
  ) {
    try {
      // Проверяем, что чат принадлежит проекту
      const chat = await db.chat.findFirst({
        where: {
          id: chatId,
          projectId
        }
      });

      if (!chat) {
        throw new Error('Чат не найден');
      }

      const message = await db.chatMessage.create({
        data: {
          chatId,
          externalId: data.externalId,
          message: data.message,
          direction: data.direction,
          senderName: data.senderName,
          senderId: data.senderId,
          metadata: data.metadata
        }
      });

      // Обновляем информацию о последнем сообщении в чате
      await db.chat.update({
        where: { id: chatId },
        data: {
          lastMessage: data.message,
          lastMessageAt: new Date(),
          unreadCount:
            data.direction === 'INCOMING' ? { increment: 1 } : undefined
        }
      });

      logger.info('Сообщение добавлено в чат', {
        chatId,
        messageId: message.id,
        direction: data.direction,
        component: 'chat-manager-service'
      });

      return message;
    } catch (error) {
      logger.error('Ошибка добавления сообщения в чат', {
        chatId,
        projectId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Обновление статуса чата
   */
  static async updateChatStatus(
    chatId: string,
    status: ChatStatus
  ): Promise<void> {
    try {
      await db.chat.update({
        where: { id: chatId },
        data: { status }
      });

      logger.info('Статус чата обновлен', {
        chatId,
        status,
        component: 'chat-manager-service'
      });
    } catch (error) {
      logger.error('Ошибка обновления статуса чата', {
        chatId,
        status,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Отметка сообщений как прочитанных
   */
  static async markAsRead(chatId: string): Promise<void> {
    try {
      await db.chat.update({
        where: { id: chatId },
        data: {
          unreadCount: 0
        }
      });
    } catch (error) {
      logger.error('Ошибка отметки чата как прочитанного', {
        chatId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }

  /**
   * Отправка сообщения через канал
   */
  static async sendMessage(
    projectId: string,
    chatId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const chat = await db.chat.findFirst({
        where: {
          id: chatId,
          projectId
        },
        include: {
          channel: true
        }
      });

      if (!chat) {
        throw new Error('Чат не найден');
      }

      // Добавляем сообщение в БД
      await this.addMessageToChat(projectId, chatId, {
        chatId,
        message,
        direction: 'OUTGOING',
        metadata
      });

      // Отправляем сообщение через соответствующий канал
      // TODO: Реализовать отправку через Telegram, WhatsApp, VK, Instagram, Messenger, MAX
      switch (chat.channel.type) {
        case 'TELEGRAM':
          // Интеграция с Telegram через bot manager
          break;
        case 'WHATSAPP':
          // Интеграция с WhatsApp API
          break;
        case 'VK':
          // Интеграция с VK API
          break;
        case 'INSTAGRAM':
          // Интеграция с Instagram API
          break;
        case 'MESSENGER':
          // Интеграция с Messenger API
          break;
        case 'VIBER':
          // Интеграция с Viber API
          break;
      }

      logger.info('Сообщение отправлено', {
        chatId,
        channelType: chat.channel.type,
        component: 'chat-manager-service'
      });
    } catch (error) {
      logger.error('Ошибка отправки сообщения', {
        chatId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'chat-manager-service'
      });
      throw error;
    }
  }
}
