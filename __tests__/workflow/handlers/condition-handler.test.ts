/**
 * @file: condition-handler.test.ts
 * @description: Unit тесты для ConditionHandler
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @author: AI Assistant + User
 */

import { ConditionHandler } from '@/lib/services/workflow/handlers/condition-handler';
import type { WorkflowNode, ExecutionContext } from '@/types/workflow';
import { VariableManager } from '@/lib/services/workflow/variable-manager';

describe('ConditionHandler', () => {
  let handler: ConditionHandler;
  let mockContext: ExecutionContext;
  let mockVariableManager: jest.Mocked<VariableManager>;

  beforeEach(() => {
    handler = new ConditionHandler();

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
  });

  describe('canHandle', () => {
    it('должен обрабатывать тип flow.condition', () => {
      expect(handler.canHandle('flow.condition')).toBe(true);
    });

    it('не должен обрабатывать другие типы', () => {
      expect(handler.canHandle('message')).toBe(false);
      expect(handler.canHandle('action.database_query')).toBe(false);
    });
  });

  describe('execute', () => {
    it('должен вернуть "true" для истинного условия (equals)', async () => {
      const node: WorkflowNode = {
        id: 'cond-1',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка статуса',
          config: {
            'flow.condition': {
              leftOperand: '{{user.status}}',
              operator: 'equals',
              rightOperand: 'active',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('active');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('true');
    });

    it('должен вернуть "false" для ложного условия (equals)', async () => {
      const node: WorkflowNode = {
        id: 'cond-2',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка статуса',
          config: {
            'flow.condition': {
              leftOperand: '{{user.status}}',
              operator: 'equals',
              rightOperand: 'active',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('inactive');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('false');
    });

    it('должен корректно работать с оператором "greater_than"', async () => {
      const node: WorkflowNode = {
        id: 'cond-3',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка баланса',
          config: {
            'flow.condition': {
              leftOperand: '{{user.balance}}',
              operator: 'greater_than',
              rightOperand: '100',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('150');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('true');
    });

    it('должен корректно работать с оператором "less_than"', async () => {
      const node: WorkflowNode = {
        id: 'cond-4',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка возраста',
          config: {
            'flow.condition': {
              leftOperand: '{{user.age}}',
              operator: 'less_than',
              rightOperand: '18',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('16');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('true');
    });

    it('должен корректно работать с оператором "contains"', async () => {
      const node: WorkflowNode = {
        id: 'cond-5',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка текста',
          config: {
            'flow.condition': {
              leftOperand: '{{message.text}}',
              operator: 'contains',
              rightOperand: 'привет',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('Привет, мир!');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('true');
    });

    it('должен корректно работать с оператором "not_equals"', async () => {
      const node: WorkflowNode = {
        id: 'cond-6',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Проверка не равно',
          config: {
            'flow.condition': {
              leftOperand: '{{user.role}}',
              operator: 'not_equals',
              rightOperand: 'admin',
            },
          },
        },
      };

      mockVariableManager.get.mockResolvedValue('user');

      const result = await handler.execute(node, mockContext);
      expect(result).toBe('true');
    });

    it('должен выбросить ошибку если конфигурация отсутствует', async () => {
      const node: WorkflowNode = {
        id: 'cond-7',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Условие без конфига',
        },
      };

      await expect(handler.execute(node, mockContext)).rejects.toThrow(
        'Condition configuration is missing'
      );
    });
  });

  describe('validate', () => {
    it('должен пройти валидацию для корректной конфигурации', () => {
      const node: WorkflowNode = {
        id: 'cond-8',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Валидное условие',
          config: {
            'flow.condition': {
              leftOperand: '{{user.status}}',
              operator: 'equals',
              rightOperand: 'active',
            },
          },
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('должен вернуть ошибку если leftOperand отсутствует', () => {
      const node: WorkflowNode = {
        id: 'cond-9',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Невалидное условие',
          config: {
            'flow.condition': {
              leftOperand: '',
              operator: 'equals',
              rightOperand: 'active',
            },
          },
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'leftOperand',
        })
      );
    });

    it('должен вернуть ошибку если operator невалидный', () => {
      const node: WorkflowNode = {
        id: 'cond-10',
        type: 'flow.condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Невалидный оператор',
          config: {
            'flow.condition': {
              leftOperand: '{{user.status}}',
              operator: 'invalid_operator' as any,
              rightOperand: 'active',
            },
          },
        },
      };

      const result = handler.validate(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'operator',
        })
      );
    });
  });
});

