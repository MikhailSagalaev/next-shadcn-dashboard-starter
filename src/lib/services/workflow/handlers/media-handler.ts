/**
 * @file: src/lib/services/workflow/handlers/media-handler.ts
 * @description: Обработчики для медиа-сообщений (фото, видео, документы)
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { ProjectVariablesService } from '@/lib/services/project-variables.service';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';
import {
  sendPlatformMedia,
  sendPlatformAction,
  sendPlatformMessage
} from '../platform-messaging';

/**
 * Конфигурация для отправки фото
 */
export interface PhotoMessageConfig {
  photo: string; // URL или file_id
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  has_spoiler?: boolean;
  disable_notification?: boolean;
}

/**
 * Обработчик для message.photo
 */
export class PhotoMessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.photo';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.photo'] as PhotoMessageConfig;

      if (!config) {
        throw new Error('Photo message configuration is missing');
      }

      // Разрешаем переменные в caption
      let caption = '';
      if (config.caption) {
        const additionalVariables: Record<string, string> = {
          username: context.telegram.username || '',
          first_name: context.telegram.firstName || '',
          user_id: context.telegram.userId || '',
          chat_id: context.telegram.chatId || ''
        };

        caption = await ProjectVariablesService.replaceVariablesInText(
          context.projectId,
          config.caption,
          additionalVariables
        );
      }

      // Разрешаем переменные в photo URL/file_id
      const photo = this.resolveValue(config.photo, context) as string;

      this.logStep(context, node, 'Sending photo message', 'info', {
        photo: photo.substring(0, 50),
        hasCaption: !!caption
      });

      // Отправляем фото через платформо-независимый хелпер
      await sendPlatformMedia(context, 'photo', photo, {
        caption,
        parseMode: config.parse_mode || 'HTML',
        hasSpoiler: config.has_spoiler
      });

      this.logStep(context, node, 'Photo sent successfully', 'info');

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to send photo', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Photo message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.photo || typeof config.photo !== 'string') {
      errors.push('Photo URL or file_id is required and must be a string');
    }

    if (config.caption && typeof config.caption !== 'string') {
      errors.push('Caption must be a string');
    }

    if (
      config.parse_mode &&
      !['HTML', 'Markdown', 'MarkdownV2'].includes(config.parse_mode)
    ) {
      errors.push('parse_mode must be one of: HTML, Markdown, MarkdownV2');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Конфигурация для отправки видео
 */
export interface VideoMessageConfig {
  video: string; // URL или file_id
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  has_spoiler?: boolean;
  supports_streaming?: boolean;
  disable_notification?: boolean;
}

/**
 * Обработчик для message.video
 */
export class VideoMessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.video';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.video'] as VideoMessageConfig;

      if (!config) {
        throw new Error('Video message configuration is missing');
      }

      // Разрешаем переменные в caption
      let caption = '';
      if (config.caption) {
        const additionalVariables: Record<string, string> = {
          username: context.telegram.username || '',
          first_name: context.telegram.firstName || ''
        };

        caption = await ProjectVariablesService.replaceVariablesInText(
          context.projectId,
          config.caption,
          additionalVariables
        );
      }

      const video = this.resolveValue(config.video, context) as string;

      this.logStep(context, node, 'Sending video message', 'info', {
        video: video.substring(0, 50),
        hasCaption: !!caption
      });

      // Отправляем видео через платформо-независимый хелпер
      await sendPlatformMedia(context, 'video', video, {
        caption,
        parseMode: config.parse_mode || 'HTML',
        hasSpoiler: config.has_spoiler
      });

      this.logStep(context, node, 'Video sent successfully', 'info');

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to send video', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Video message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.video || typeof config.video !== 'string') {
      errors.push('Video URL or file_id is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Конфигурация для отправки документа
 */
export interface DocumentMessageConfig {
  document: string; // URL или file_id
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  thumbnail?: string;
  disable_content_type_detection?: boolean;
  disable_notification?: boolean;
}

/**
 * Обработчик для message.document
 */
export class DocumentMessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.document';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      const config = node.data?.config?.[
        'message.document'
      ] as DocumentMessageConfig;

      if (!config) {
        throw new Error('Document message configuration is missing');
      }

      let caption = '';
      if (config.caption) {
        const additionalVariables: Record<string, string> = {
          username: context.telegram.username || '',
          first_name: context.telegram.firstName || ''
        };

        caption = await ProjectVariablesService.replaceVariablesInText(
          context.projectId,
          config.caption,
          additionalVariables
        );
      }

      const document = this.resolveValue(config.document, context) as string;

      this.logStep(context, node, 'Sending document message', 'info', {
        document: document.substring(0, 50)
      });

      // Отправляем документ через платформо-независимый хелпер
      await sendPlatformMedia(context, 'document', document, {
        caption,
        parseMode: config.parse_mode || 'HTML'
      });

      this.logStep(context, node, 'Document sent successfully', 'info');

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to send document', 'error', {
        error
      });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Document message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.document || typeof config.document !== 'string') {
      errors.push('Document URL or file_id is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для message.edit
 */
export class EditMessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.edit';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.edit'];

      if (!config) {
        throw new Error('Edit message configuration is missing');
      }

      const messageId = this.resolveValue(config.message_id, context);
      let newText = config.text;

      if (newText) {
        const additionalVariables: Record<string, string> = {
          username: context.telegram.username || '',
          first_name: context.telegram.firstName || ''
        };

        newText = await ProjectVariablesService.replaceVariablesInText(
          context.projectId,
          newText,
          additionalVariables
        );
      }

      this.logStep(context, node, 'Editing message', 'info', { messageId });

      // Редактируем сообщение через платформо-независимый хелпер
      await sendPlatformAction(context, 'edit_text', {
        messageId: String(messageId),
        text: newText,
        parseMode: config.parse_mode || 'HTML'
      });

      this.logStep(context, node, 'Message edited successfully', 'info');

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to edit message', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Edit message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.message_id) {
      errors.push('message_id is required');
    }

    if (!config.text || typeof config.text !== 'string') {
      errors.push('New text is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для message.delete
 */
export class DeleteMessageHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'message.delete';
  }

  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<string | null> {
    try {
      const config = node.data?.config?.['message.delete'];

      if (!config) {
        throw new Error('Delete message configuration is missing');
      }

      const messageId = this.resolveValue(config.message_id, context);

      this.logStep(context, node, 'Deleting message', 'info', { messageId });

      // Удаляем сообщение через платформо-независимый хелпер
      await sendPlatformAction(context, 'delete', {
        messageId: String(messageId)
      });

      this.logStep(context, node, 'Message deleted successfully', 'info');

      return null;
    } catch (error) {
      this.logStep(context, node, 'Failed to delete message', 'error', {
        error
      });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Delete message configuration is required');
      return { isValid: false, errors };
    }

    if (!config.message_id) {
      errors.push('message_id is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
