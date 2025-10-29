/**
 * @file: workflow-validator.test.ts
 * @description: Unit тесты для WorkflowValidator
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 * @author: AI Assistant + User
 */

import { validateWorkflow } from '@/lib/services/workflow/workflow-validator';
import type { WorkflowNode, WorkflowConnection } from '@/types/workflow';

describe('WorkflowValidator', () => {
  describe('validateWorkflow', () => {
    it('должен пройти валидацию для корректного workflow', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Start' },
        },
        {
          id: 'message-1',
          type: 'message',
          position: { x: 200, y: 0 },
          data: { label: 'Message' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'message-1' },
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('должен вернуть ошибку если нет триггеров', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'message-1',
          type: 'message',
          position: { x: 0, y: 0 },
          data: { label: 'Message' },
        },
      ];

      const connections: WorkflowConnection[] = [];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('триггер'),
        })
      );
    });

    it('должен обнаружить orphan nodes', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Start' },
        },
        {
          id: 'message-1',
          type: 'message',
          position: { x: 200, y: 0 },
          data: { label: 'Connected' },
        },
        {
          id: 'message-2',
          type: 'message',
          position: { x: 400, y: 0 },
          data: { label: 'Orphan' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'message-1' },
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          nodeId: 'message-2',
          message: expect.stringContaining('изолирован'),
        })
      );
    });

    it('должен обнаружить циклы', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Start' },
        },
        {
          id: 'message-1',
          type: 'message',
          position: { x: 200, y: 0 },
          data: { label: 'Message 1' },
        },
        {
          id: 'message-2',
          type: 'message',
          position: { x: 400, y: 0 },
          data: { label: 'Message 2' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'message-1' },
        { id: 'c2', source: 'message-1', target: 'message-2' },
        { id: 'c3', source: 'message-2', target: 'message-1' }, // Цикл
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('цикл'),
        })
      );
    });

    it('должен обнаружить невалидные connections', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Start' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'non-existent' },
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('несуществующ'),
        })
      );
    });

    it('должен разрешить несколько триггеров', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Command' },
        },
        {
          id: 'trigger-2',
          type: 'trigger.message',
          position: { x: 0, y: 100 },
          data: { label: 'Message' },
        },
        {
          id: 'message-1',
          type: 'message',
          position: { x: 200, y: 50 },
          data: { label: 'Response' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'message-1' },
        { id: 'c2', source: 'trigger-2', target: 'message-1' },
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(true);
    });

    it('должен обработать пустой workflow', () => {
      const nodes: WorkflowNode[] = [];
      const connections: WorkflowConnection[] = [];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('пуст'),
        })
      );
    });

    it('должен разрешить условные ветвления', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger-1',
          type: 'trigger.command',
          position: { x: 0, y: 0 },
          data: { label: 'Start' },
        },
        {
          id: 'condition-1',
          type: 'flow.condition',
          position: { x: 200, y: 0 },
          data: { label: 'Check' },
        },
        {
          id: 'message-1',
          type: 'message',
          position: { x: 400, y: -100 },
          data: { label: 'True branch' },
        },
        {
          id: 'message-2',
          type: 'message',
          position: { x: 400, y: 100 },
          data: { label: 'False branch' },
        },
      ];

      const connections: WorkflowConnection[] = [
        { id: 'c1', source: 'trigger-1', target: 'condition-1' },
        { id: 'c2', source: 'condition-1', target: 'message-1', sourceHandle: 'true' },
        { id: 'c3', source: 'condition-1', target: 'message-2', sourceHandle: 'false' },
      ];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

