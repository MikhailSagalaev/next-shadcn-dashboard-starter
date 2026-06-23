/**
 * @file: __tests__/services/workflow-switch-routing.test.ts
 * @description: Unit тесты маршрутизации flow.switch в SimpleWorkflowProcessor.getNextNodeId
 * @project: SaaS Bonus System
 * @created: 2026-06-14
 * @author: AI Assistant + User
 */

// Изолируем тяжёлые зависимости модуля процессора
jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import type {
  WorkflowVersion,
  WorkflowNode,
  WorkflowConnection
} from '@/types/workflow';

function createSwitchVersion(
  connections: Array<
    Partial<WorkflowConnection> & { source: string; target: string }
  >
): WorkflowVersion {
  const switchNode: WorkflowNode = {
    id: 'switch-1',
    type: 'flow.switch',
    position: { x: 0, y: 0 },
    data: {
      label: 'Switch',
      config: {
        'flow.switch': {
          variable: 'choice',
          cases: [{ value: 'a' }, { value: 'b' }],
          hasDefault: true
        }
      }
    }
  };

  const nodes: Record<string, WorkflowNode> = { 'switch-1': switchNode };

  return {
    id: 'v1',
    workflowId: 'wf-1',
    version: 1,
    nodes,
    entryNodeId: 'switch-1',
    connections: connections.map((c, i) => ({
      id: `c${i}`,
      type: 'default',
      ...c
    })) as WorkflowConnection[],
    createdAt: new Date()
  };
}

function withSwitchResult(
  processor: SimpleWorkflowProcessor,
  value: number | undefined
) {
  // currentContext приватный — подменяем минимальным моком для чтения switch_result
  (processor as any).currentContext = {
    variables: {
      get: async (name: string) =>
        name === 'switch_result' ? value : undefined
    }
  };
}

describe('SimpleWorkflowProcessor — маршрутизация flow.switch', () => {
  const connections = [
    { source: 'switch-1', target: 'node-a', sourceHandle: 'case_0' },
    { source: 'switch-1', target: 'node-b', sourceHandle: 'case_1' },
    { source: 'switch-1', target: 'node-default', sourceHandle: 'default' }
  ];

  it('направляет в case_0 при matchedCaseIndex=0', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion(connections),
      'p1'
    );
    withSwitchResult(proc, 0);
    expect(await proc.getNextNodeId('switch-1')).toBe('node-a');
  });

  it('направляет в case_1 при matchedCaseIndex=1', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion(connections),
      'p1'
    );
    withSwitchResult(proc, 1);
    expect(await proc.getNextNodeId('switch-1')).toBe('node-b');
  });

  it('направляет в default при индексе по умолчанию (cases.length)', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion(connections),
      'p1'
    );
    // SwitchFlowHandler пишет cases.length, когда совпадений нет, но есть default
    withSwitchResult(proc, 2);
    expect(await proc.getNextNodeId('switch-1')).toBe('node-default');
  });

  it('направляет в default при отсутствии совпадения (-1), если есть default-связь', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion(connections),
      'p1'
    );
    withSwitchResult(proc, -1);
    expect(await proc.getNextNodeId('switch-1')).toBe('node-default');
  });

  it('возвращает null, когда нет совпадения и нет default-связи', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion([
        { source: 'switch-1', target: 'node-a', sourceHandle: 'case_0' },
        { source: 'switch-1', target: 'node-b', sourceHandle: 'case_1' }
      ]),
      'p1'
    );
    withSwitchResult(proc, -1);
    expect(await proc.getNextNodeId('switch-1')).toBeNull();
  });

  it('не уходит в первую связь вслепую: case_1 не равен case_0/node-a', async () => {
    const proc = new SimpleWorkflowProcessor(
      createSwitchVersion(connections),
      'p1'
    );
    withSwitchResult(proc, 1);
    const next = await proc.getNextNodeId('switch-1');
    expect(next).not.toBe('node-a');
    expect(next).toBe('node-b');
  });
});
