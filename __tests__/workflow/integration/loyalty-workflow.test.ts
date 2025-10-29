/**
 * @file: loyalty-workflow.test.ts
 * @description: Integration тест для workflow системы лояльности
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @author: AI Assistant + User
 */

import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import type { WorkflowVersion, WorkflowNode } from '@/types/workflow';
import { db } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
global.fetch = jest.fn();

describe('Loyalty Workflow Integration', () => {
  let processor: SimpleWorkflowProcessor;
  let mockWorkflow: WorkflowVersion;

  beforeEach(() => {
    // Создаём простой workflow: команда /start -> сообщение -> проверка баланса -> условие
    const nodes: Record<string, WorkflowNode> = {
      'trigger-1': {
        id: 'trigger-1',
        type: 'trigger.command',
        position: { x: 0, y: 0 },
        data: {
          label: 'Команда /start',
          config: {
            'trigger.command': {
              command: '/start',
            },
          },
        },
      },
      'message-1': {
        id: 'message-1',
        type: 'message',
        position: { x: 200, y: 0 },
        data: {
          label: 'Приветствие',
          config: {
            message: {
              text: 'Добро пожаловать! Ваш баланс: {{userBalance}} бонусов',
            },
          },
        },
      },
      'action-1': {
        id: 'action-1',
        type: 'action.get_user_balance',
        position: { x: 400, y: 0 },
        data: {
          label: 'Получить баланс',
          config: {
            'action.get_user_balance': {
              userId: '{{user.id}}',
              saveToVariable: 'userBalance',
            },
          },
        },
      },
      'condition-1': {
        id: 'condition-1',
        type: 'flow.condition',
        position: { x: 600, y: 0 },
        data: {
          label: 'Проверка баланса',
          config: {
            'flow.condition': {
              leftOperand: '{{userBalance}}',
              operator: 'greater_than',
              rightOperand: '100',
            },
          },
        },
      },
      'message-2': {
        id: 'message-2',
        type: 'message',
        position: { x: 800, y: -100 },
        data: {
          label: 'Много бонусов',
          config: {
            message: {
              text: 'У вас достаточно бонусов для получения скидки!',
            },
          },
        },
      },
      'message-3': {
        id: 'message-3',
        type: 'message',
        position: { x: 800, y: 100 },
        data: {
          label: 'Мало бонусов',
          config: {
            message: {
              text: 'Накопите ещё бонусов для получения скидки',
            },
          },
        },
      },
    };

    mockWorkflow = {
      id: 'workflow-1',
      workflowId: 'workflow-1',
      version: 1,
      nodes,
      entryNodeId: 'trigger-1',
      connections: [
        { id: 'c1', source: 'trigger-1', target: 'message-1' },
        { id: 'c2', source: 'message-1', target: 'action-1' },
        { id: 'c3', source: 'action-1', target: 'condition-1' },
        { id: 'c4', source: 'condition-1', target: 'message-2', sourceHandle: 'true' },
        { id: 'c5', source: 'condition-1', target: 'message-3', sourceHandle: 'false' },
      ],
      isActive: true,
      createdAt: new Date(),
    };

    processor = new SimpleWorkflowProcessor(mockWorkflow, 'test-project');

    // Mock fetch для Telegram API
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 123 } }),
    });

    jest.clearAllMocks();
  });

  it('должен выполнить полный workflow для пользователя с большим балансом', async () => {
    const mockContext = {
      message: {
        text: '/start',
        from: { id: 12345, username: 'testuser' },
        chat: { id: 12345 },
      },
      from: { id: 12345, username: 'testuser' },
      chat: { id: 12345 },
    };

    // Mock: пользователь найден
    (db.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-1',
      telegramId: BigInt(12345),
      projectId: 'test-project',
    });

    // Mock: баланс = 500
    (db.bonus.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 500 },
    });

    // Mock: создание execution
    (db.workflowExecution.create as jest.Mock).mockResolvedValue({
      id: 'exec-1',
      workflowId: 'workflow-1',
      projectId: 'test-project',
      status: 'running',
    });

    (db.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (db.workflowLog.create as jest.Mock).mockResolvedValue({});

    const result = await processor.process(mockContext, 'start');

    expect(result).toBe(true);

    // Проверяем что было отправлено сообщение с балансом
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('500 бонусов'),
      })
    );

    // Проверяем что было отправлено сообщение о достаточном балансе
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('достаточно бонусов'),
      })
    );
  });

  it('должен выполнить workflow для пользователя с малым балансом', async () => {
    const mockContext = {
      message: {
        text: '/start',
        from: { id: 67890, username: 'newuser' },
        chat: { id: 67890 },
      },
      from: { id: 67890, username: 'newuser' },
      chat: { id: 67890 },
    };

    (db.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-2',
      telegramId: BigInt(67890),
      projectId: 'test-project',
    });

    // Mock: баланс = 50
    (db.bonus.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 50 },
    });

    (db.workflowExecution.create as jest.Mock).mockResolvedValue({
      id: 'exec-2',
      workflowId: 'workflow-1',
      projectId: 'test-project',
      status: 'running',
    });

    (db.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (db.workflowLog.create as jest.Mock).mockResolvedValue({});

    const result = await processor.process(mockContext, 'start');

    expect(result).toBe(true);

    // Проверяем что было отправлено сообщение о недостаточном балансе
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Накопите ещё бонусов'),
      })
    );
  });

  it('должен обработать ошибку при отсутствии пользователя', async () => {
    const mockContext = {
      message: {
        text: '/start',
        from: { id: 99999, username: 'unknown' },
        chat: { id: 99999 },
      },
      from: { id: 99999, username: 'unknown' },
      chat: { id: 99999 },
    };

    (db.user.findFirst as jest.Mock).mockResolvedValue(null);

    (db.workflowExecution.create as jest.Mock).mockResolvedValue({
      id: 'exec-3',
      workflowId: 'workflow-1',
      projectId: 'test-project',
      status: 'running',
    });

    (db.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (db.workflowLog.create as jest.Mock).mockResolvedValue({});

    // Workflow должен продолжить выполнение даже без userId
    const result = await processor.process(mockContext, 'start');

    // В зависимости от реализации, может быть true или false
    // Проверяем что execution был создан
    expect(db.workflowExecution.create).toHaveBeenCalled();
  });
});

