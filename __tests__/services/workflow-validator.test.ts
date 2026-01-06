/**
 * @file: __tests__/services/workflow-validator.test.ts
 * @description: Unit тесты для WorkflowValidator (validateWorkflow, validateGotoNodes)
 * @project: SaaS Bonus System
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import {
  validateWorkflow,
  validateGotoNodes,
  getGotoNodeReferences
} from '@/lib/services/workflow/workflow-validator';
import type { WorkflowNode, WorkflowConnection } from '@/types/workflow';

describe('WorkflowValidator', () => {
  // Helper to create a basic node
  const createNode = (
    id: string,
    type: string,
    config: Record<string, any> = {}
  ): WorkflowNode => ({
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data: {
      label: `Node ${id}`,
      config
    }
  });

  // Helper to create a connection
  const createConnection = (
    source: string,
    target: string,
    type: string = 'default'
  ): WorkflowConnection => ({
    id: `${source}-${target}`,
    source,
    target,
    type: type as any
  });

  describe('validateWorkflow', () => {
    it('should return error for empty workflow', () => {
      const result = validateWorkflow([], []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('пуст')
        })
      );
    });

    it('should return error for workflow without trigger', () => {
      const nodes = [createNode('node1', 'message')];
      const result = validateWorkflow(nodes, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('триггер')
        })
      );
    });

    it('should pass for valid workflow with trigger', () => {
      const nodes = [
        createNode('trigger1', 'trigger.command', {
          'trigger.command': { command: '/start' }
        }),
        createNode('message1', 'message')
      ];
      const connections = [createConnection('trigger1', 'message1')];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(true);
      expect(result.errors.filter((e) => e.type === 'error')).toHaveLength(0);
    });

    it('should detect invalid connection source', () => {
      const nodes = [
        createNode('trigger1', 'trigger.command'),
        createNode('message1', 'message')
      ];
      const connections = [createConnection('nonexistent', 'message1')];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('несуществующую source-ноду')
        })
      );
    });

    it('should detect invalid connection target', () => {
      const nodes = [
        createNode('trigger1', 'trigger.command'),
        createNode('message1', 'message')
      ];
      const connections = [createConnection('trigger1', 'nonexistent')];

      const result = validateWorkflow(nodes, connections);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('несуществующую target-ноду')
        })
      );
    });

    it('should detect orphan nodes', () => {
      const nodes = [
        createNode('trigger1', 'trigger.command'),
        createNode('message1', 'message'),
        createNode('orphan1', 'message') // Not connected
      ];
      const connections = [createConnection('trigger1', 'message1')];

      const result = validateWorkflow(nodes, connections);

      // Orphan nodes should generate warnings
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('orphan1')
        })
      );
    });
  });

  describe('validateGotoNodes', () => {
    it('should return no errors for valid goto_node references', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: [[{ text: 'Go', goto_node: 'node2' }]]
          }
        }),
        createNode('node2', 'message')
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(0);
    });

    it('should detect invalid goto_node in inline keyboard', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: [[{ text: 'Go', goto_node: 'nonexistent' }]]
          }
        })
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: 'error',
        message: expect.stringContaining('nonexistent'),
        nodeId: 'node1'
      });
    });

    it('should detect invalid callback_data with goto: prefix', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: [[{ text: 'Go', callback_data: 'goto:nonexistent' }]]
          }
        })
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: 'error',
        message: expect.stringContaining('nonexistent')
      });
    });

    it('should detect invalid targetNodeId in flow.jump', () => {
      const nodes = [
        createNode('node1', 'flow.jump', {
          'flow.jump': { targetNodeId: 'nonexistent' }
        })
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: 'error',
        message: expect.stringContaining('flow.jump'),
        nodeId: 'node1'
      });
    });

    it('should validate multiple buttons in a row', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: [
              [
                { text: 'Valid', goto_node: 'node2' },
                { text: 'Invalid', goto_node: 'nonexistent' }
              ]
            ]
          }
        }),
        createNode('node2', 'message')
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Invalid');
    });

    it('should validate message node with keyboard', () => {
      const nodes = [
        createNode('node1', 'message', {
          message: {
            text: 'Test',
            keyboard: {
              type: 'inline',
              buttons: [[{ text: 'Go', goto_node: 'nonexistent' }]]
            }
          }
        })
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(1);
    });

    it('should handle nodes without config', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'node1',
          type: 'message' as any,
          position: { x: 0, y: 0 },
          data: { label: 'Test', config: {} }
        }
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(0);
    });

    it('should handle empty buttons array', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: []
          }
        })
      ];

      const errors = validateGotoNodes(nodes);

      expect(errors).toHaveLength(0);
    });
  });

  describe('getGotoNodeReferences', () => {
    it('should collect references from inline keyboard buttons', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test',
            buttons: [[{ text: 'Go to Node 2', goto_node: 'node2' }]]
          }
        }),
        createNode('node2', 'message')
      ];

      const references = getGotoNodeReferences(nodes);

      expect(references.has('node2')).toBe(true);
      expect(references.get('node2')).toContainEqual(
        expect.objectContaining({
          sourceNodeId: 'node1',
          buttonText: 'Go to Node 2'
        })
      );
    });

    it('should collect references from flow.jump', () => {
      const nodes = [
        createNode('node1', 'flow.jump', {
          'flow.jump': { targetNodeId: 'node2' }
        }),
        createNode('node2', 'message')
      ];

      const references = getGotoNodeReferences(nodes);

      expect(references.has('node2')).toBe(true);
      expect(references.get('node2')).toContainEqual(
        expect.objectContaining({
          sourceNodeId: 'node1'
        })
      );
    });

    it('should return empty map for nodes without goto references', () => {
      const nodes = [
        createNode('node1', 'message', { message: { text: 'Hello' } }),
        createNode('node2', 'message', { message: { text: 'World' } })
      ];

      const references = getGotoNodeReferences(nodes);

      expect(references.size).toBe(0);
    });

    it('should collect multiple references to the same node', () => {
      const nodes = [
        createNode('node1', 'message.keyboard.inline', {
          'message.keyboard.inline': {
            text: 'Test 1',
            buttons: [[{ text: 'Go', goto_node: 'target' }]]
          }
        }),
        createNode('node2', 'flow.jump', {
          'flow.jump': { targetNodeId: 'target' }
        }),
        createNode('target', 'message')
      ];

      const references = getGotoNodeReferences(nodes);

      expect(references.has('target')).toBe(true);
      expect(references.get('target')).toHaveLength(2);
    });
  });
});
