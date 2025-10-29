/**
 * @file: action-handlers.test.ts
 * @description: Unit тесты для Action Handlers
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @author: AI Assistant + User
 */

import {
  ApiRequestHandler,
  CheckUserLinkedHandler,
  GetUserBalanceHandler,
} from '@/lib/services/workflow/handlers/action-handlers';
import type { WorkflowNode, ExecutionContext } from '@/types/workflow';
import { VariableManager } from '@/lib/services/workflow/variable-manager';
import { db } from '@/lib/db';

// Mock fetch
global.fetch = jest.fn();

// Mock db
jest.mock('@/lib/db');

describe('Action Handlers', () => {
  let mockContext: ExecutionContext;
  let mockVariableManager: jest.Mocked<VariableManager>;

  beforeEach(() => {
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
        db: db as any,
        http: {} as any,
      },
    };

    (global.fetch as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  describe('ApiRequestHandler', () => {
    let handler: ApiRequestHandler;

    beforeEach(() => {
      handler = new ApiRequestHandler();
    });

    it('должен выполнить GET запрос', async () => {
      const node: WorkflowNode = {
        id: 'api-1',
        type: 'action.api_request',
        position: { x: 0, y: 0 },
        data: {
          label: 'API запрос',
          config: {
            'action.api_request': {
              url: 'https://api.example.com/users',
              method: 'GET',
              headers: {},
              body: '',
              saveToVariable: 'apiResponse',
            },
          },
        },
      };

      const mockResponse = { users: [{ id: 1, name: 'John' }] };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await handler.execute(node, mockContext);

      expect(result).toBe('api-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(mockVariableManager.set).toHaveBeenCalledWith(
        'apiResponse',
        mockResponse
      );
    });

    it('должен выполнить POST запрос с телом', async () => {
      const node: WorkflowNode = {
        id: 'api-2',
        type: 'action.api_request',
        position: { x: 0, y: 0 },
        data: {
          label: 'POST запрос',
          config: {
            'action.api_request': {
              url: 'https://api.example.com/users',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{"name": "{{user.name}}"}',
              saveToVariable: 'createResult',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('Alice');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 2, name: 'Alice' }),
        text: async () => '{"id": 2, "name": "Alice"}',
      });

      await handler.execute(node, mockContext);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Alice'),
        })
      );
    });

    it('должен обработать ошибку HTTP', async () => {
      const node: WorkflowNode = {
        id: 'api-3',
        type: 'action.api_request',
        position: { x: 0, y: 0 },
        data: {
          label: 'Неудачный запрос',
          config: {
            'action.api_request': {
              url: 'https://api.example.com/error',
              method: 'GET',
              headers: {},
              body: '',
              saveToVariable: 'errorResponse',
            },
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(handler.execute(node, mockContext)).rejects.toThrow(
        'HTTP error'
      );
    });
  });

  describe('CheckUserLinkedHandler', () => {
    let handler: CheckUserLinkedHandler;

    beforeEach(() => {
      handler = new CheckUserLinkedHandler();
    });

    it('должен вернуть "true" если пользователь связан', async () => {
      const node: WorkflowNode = {
        id: 'check-1',
        type: 'action.check_user_linked',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка связи',
          config: {
            'action.check_user_linked': {
              telegramUserId: '{{telegram.userId}}',
              saveToVariable: 'isLinked',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('67890');

      (db.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        telegramId: BigInt(67890),
        projectId: 'test-project',
      });

      const result = await handler.execute(node, mockContext);

      expect(result).toBe('true');
      expect(mockVariableManager.set).toHaveBeenCalledWith('isLinked', true);
    });

    it('должен вернуть "false" если пользователь не связан', async () => {
      const node: WorkflowNode = {
        id: 'check-2',
        type: 'action.check_user_linked',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка связи',
          config: {
            'action.check_user_linked': {
              telegramUserId: '{{telegram.userId}}',
              saveToVariable: 'isLinked',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('99999');

      (db.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await handler.execute(node, mockContext);

      expect(result).toBe('false');
      expect(mockVariableManager.set).toHaveBeenCalledWith('isLinked', false);
    });
  });

  describe('GetUserBalanceHandler', () => {
    let handler: GetUserBalanceHandler;

    beforeEach(() => {
      handler = new GetUserBalanceHandler();
    });

    it('должен получить баланс пользователя', async () => {
      const node: WorkflowNode = {
        id: 'balance-1',
        type: 'action.get_user_balance',
        position: { x: 0, y: 0 },
        data: {
          label: 'Получить баланс',
          config: {
            'action.get_user_balance': {
              userId: '{{user.id}}',
              saveToVariable: 'userBalance',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('user-123');

      (db.bonus.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 500 },
      });

      const result = await handler.execute(node, mockContext);

      expect(result).toBe('balance-1');
      expect(mockVariableManager.set).toHaveBeenCalledWith('userBalance', 500);
      expect(db.bonus.aggregate).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          expiresAt: { gt: expect.any(Date) },
        },
        _sum: { amount: true },
      });
    });

    it('должен вернуть 0 если бонусов нет', async () => {
      const node: WorkflowNode = {
        id: 'balance-2',
        type: 'action.get_user_balance',
        position: { x: 0, y: 0 },
        data: {
          label: 'Получить баланс',
          config: {
            'action.get_user_balance': {
              userId: '{{user.id}}',
              saveToVariable: 'userBalance',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('user-456');

      (db.bonus.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });

      await handler.execute(node, mockContext);

      expect(mockVariableManager.set).toHaveBeenCalledWith('userBalance', 0);
    });
  });
});

