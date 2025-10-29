/**
 * @file: message-handler.test.ts
 * @description: Unit тесты для MessageHandler
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @author: AI Assistant + User
 */

import { MessageHandler } from '@/lib/services/workflow/handlers/message-handler';
import type { WorkflowNode, ExecutionContext } from '@/types/workflow';
import { VariableManager } from '@/lib/services/workflow/variable-manager';

// Mock fetch
global.fetch = jest.fn();

describe('MessageHandler', () => {
  let handler: MessageHandler;
  let mockContext: ExecutionContext;
  let mockVariableManager: jest.Mocked<VariableManager>;

  beforeEach(() => {
    handler = new MessageHandler();
    
    mockVariableManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
    } as any;

    mockContext = {
      projectId: 'test-project',
      workflowId: 'test-workflow',
      executionId: 'test-execution',
      userId: 'test-user',
      telegram: {
        chatId: '12345',
        userId: '67890',
        username: 'testuser',
        botToken: 'test-bot-token',
      },
      variables: mockVariableManager,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      },
      services: {
        db: {} as any,
        http: {} as any,
      },
    };

    (global.fetch as jest.Mock).mockClear();
  });

  describe('canHandle', () => {
    it('должен обрабатывать тип message', () => {
      expect(handler.canHandle('message')).toBe(true);
    });

    it('не должен обрабатывать другие типы', () => {
      expect(handler.canHandle('action.database_query')).toBe(false);
      expect(handler.canHandle('trigger.command')).toBe(false);
    });
  });

  describe('execute', () => {
    it('должен отправить простое текстовое сообщение', async () => {
      const node: WorkflowNode = {
        id: 'msg-1',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Тестовое сообщение',
          config: {
            message: {
              text: 'Привет, {{user.name}}!',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('Иван');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 123 } }),
      });

      const result = await handler.execute(node, mockContext);

      expect(result).toBe('msg-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Привет, Иван!'),
        })
      );
    });

    it('должен использовать fallback текст если конфигурация отсутствует', async () => {
      const node: WorkflowNode = {
        id: 'msg-2',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Пустое сообщение',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await handler.execute(node, mockContext);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Сообщение не настроено'),
        })
      );
    });

    it('должен выбросить ошибку если botToken отсутствует', async () => {
      const node: WorkflowNode = {
        id: 'msg-3',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Сообщение',
          config: {
            message: { text: 'Тест' },
          },
        },
      };

      const contextWithoutToken = {
        ...mockContext,
        telegram: {
          ...mockContext.telegram,
          botToken: undefined as any,
        },
      };

      await expect(handler.execute(node, contextWithoutToken)).rejects.toThrow(
        'Bot token is missing'
      );
    });

    it('должен обработать ошибку API Telegram', async () => {
      const node: WorkflowNode = {
        id: 'msg-4',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Сообщение с ошибкой',
          config: {
            message: { text: 'Тест' },
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid chat_id',
      });

      await expect(handler.execute(node, mockContext)).rejects.toThrow(
        'Telegram API error'
      );
    });
  });

  describe('validate', () => {
    it('должен пройти валидацию для корректной конфигурации', () => {
      const node: WorkflowNode = {
        id: 'msg-5',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Валидное сообщение',
          config: {
            message: {
              text: 'Привет!',
            },
          },
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('должен вернуть ошибку если текст отсутствует', () => {
      const node: WorkflowNode = {
        id: 'msg-6',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Невалидное сообщение',
          config: {
            message: {
              text: '',
            },
          },
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'text',
          message: expect.stringContaining('required'),
        })
      );
    });

    it('должен вернуть ошибку если конфигурация отсутствует', () => {
      const node: WorkflowNode = {
        id: 'msg-7',
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          label: 'Сообщение без конфига',
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

