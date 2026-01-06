/**
 * @file: __tests__/services/node-utils.test.ts
 * @description: Unit тесты для node-utils (normalizeNodes, serializeNodes, etc.)
 * @project: SaaS Bonus System
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import {
  normalizeNodes,
  serializeNodes,
  getNodeById,
  getNodesByType,
  countNodes
} from '@/lib/services/workflow/utils/node-utils';
import type { WorkflowNode } from '@/types/workflow';

describe('node-utils', () => {
  // Helper to create a basic node
  const createNode = (id: string, type: string = 'message'): WorkflowNode => ({
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data: {
      label: `Node ${id}`,
      config: {}
    }
  });

  describe('normalizeNodes', () => {
    describe('from array', () => {
      it('should convert array to Record with id as keys', () => {
        const nodes = [
          createNode('node-1', 'message'),
          createNode('node-2', 'trigger.command'),
          createNode('node-3', 'condition')
        ];

        const result = normalizeNodes(nodes);

        expect(result).toEqual({
          'node-1': nodes[0],
          'node-2': nodes[1],
          'node-3': nodes[2]
        });
      });

      it('should handle empty array', () => {
        const result = normalizeNodes([]);
        expect(result).toEqual({});
      });

      it('should skip invalid nodes in array', () => {
        const nodes = [
          createNode('valid-node'),
          null,
          undefined,
          { invalid: 'object' },
          createNode('another-valid')
        ];

        const result = normalizeNodes(nodes as any);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result['valid-node']).toBeDefined();
        expect(result['another-valid']).toBeDefined();
      });

      it('should skip nodes without id', () => {
        const nodes = [
          createNode('valid-node'),
          { type: 'message', position: { x: 0, y: 0 }, data: {} } // no id
        ];

        const result = normalizeNodes(nodes as any);

        expect(Object.keys(result)).toHaveLength(1);
        expect(result['valid-node']).toBeDefined();
      });
    });

    describe('from object', () => {
      it('should return object as-is if already normalized', () => {
        const nodes = {
          'node-1': createNode('node-1'),
          'node-2': createNode('node-2')
        };

        const result = normalizeNodes(nodes);

        expect(result).toEqual(nodes);
      });

      it('should filter out invalid entries', () => {
        const nodes = {
          valid: createNode('valid'),
          invalid: { notANode: true },
          alsoValid: createNode('alsoValid')
        };

        const result = normalizeNodes(nodes as any);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result['valid']).toBeDefined();
        expect(result['alsoValid']).toBeDefined();
        expect(result['invalid']).toBeUndefined();
      });
    });

    describe('from JSON string', () => {
      it('should parse JSON array and normalize', () => {
        const nodes = [createNode('node-1'), createNode('node-2')];
        const jsonString = JSON.stringify(nodes);

        const result = normalizeNodes(jsonString);

        expect(result['node-1']).toBeDefined();
        expect(result['node-2']).toBeDefined();
      });

      it('should parse JSON object and normalize', () => {
        const nodes = {
          'node-1': createNode('node-1'),
          'node-2': createNode('node-2')
        };
        const jsonString = JSON.stringify(nodes);

        const result = normalizeNodes(jsonString);

        expect(result['node-1']).toBeDefined();
        expect(result['node-2']).toBeDefined();
      });

      it('should return empty object for invalid JSON', () => {
        const result = normalizeNodes('not valid json');
        expect(result).toEqual({});
      });

      it('should return empty object for empty JSON string', () => {
        const result = normalizeNodes('');
        expect(result).toEqual({});
      });
    });

    describe('edge cases', () => {
      it('should return empty object for null', () => {
        const result = normalizeNodes(null);
        expect(result).toEqual({});
      });

      it('should return empty object for undefined', () => {
        const result = normalizeNodes(undefined);
        expect(result).toEqual({});
      });

      it('should return empty object for number', () => {
        const result = normalizeNodes(123 as any);
        expect(result).toEqual({});
      });

      it('should return empty object for boolean', () => {
        const result = normalizeNodes(true as any);
        expect(result).toEqual({});
      });

      it('should handle deeply nested JSON', () => {
        const nodes = [createNode('deep-node')];
        const jsonString = JSON.stringify(nodes);

        const result = normalizeNodes(jsonString);

        expect(result['deep-node']).toBeDefined();
        expect(result['deep-node'].id).toBe('deep-node');
      });
    });
  });

  describe('serializeNodes', () => {
    it('should convert Record to array', () => {
      const nodes = {
        'node-1': createNode('node-1'),
        'node-2': createNode('node-2'),
        'node-3': createNode('node-3')
      };

      const result = serializeNodes(nodes);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result.map((n) => n.id).sort()).toEqual([
        'node-1',
        'node-2',
        'node-3'
      ]);
    });

    it('should return empty array for empty object', () => {
      const result = serializeNodes({});
      expect(result).toEqual([]);
    });

    it('should return empty array for null', () => {
      const result = serializeNodes(null as any);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = serializeNodes(undefined as any);
      expect(result).toEqual([]);
    });

    it('should preserve node data during serialization', () => {
      const node = createNode('test-node', 'trigger.command');
      node.data.label = 'Custom Label';
      node.data.config = { 'trigger.command': { command: '/start' } };

      const nodes = { 'test-node': node };
      const result = serializeNodes(nodes);

      expect(result[0]).toEqual(node);
      expect(result[0].data.label).toBe('Custom Label');
      expect(result[0].data.config).toEqual({
        'trigger.command': { command: '/start' }
      });
    });
  });

  describe('getNodeById', () => {
    it('should return node by id', () => {
      const nodes = {
        'node-1': createNode('node-1'),
        'node-2': createNode('node-2')
      };

      const result = getNodeById(nodes, 'node-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('node-1');
    });

    it('should return undefined for non-existent id', () => {
      const nodes = {
        'node-1': createNode('node-1')
      };

      const result = getNodeById(nodes, 'non-existent');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty nodes', () => {
      const result = getNodeById({}, 'any-id');
      expect(result).toBeUndefined();
    });
  });

  describe('getNodesByType', () => {
    it('should return all nodes of specified type', () => {
      const nodes = {
        'trigger-1': createNode('trigger-1', 'trigger.command'),
        'trigger-2': createNode('trigger-2', 'trigger.message'),
        'message-1': createNode('message-1', 'message'),
        'trigger-3': createNode('trigger-3', 'trigger.command')
      };

      const result = getNodesByType(nodes, 'trigger.command');

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id).sort()).toEqual([
        'trigger-1',
        'trigger-3'
      ]);
    });

    it('should return empty array if no nodes match', () => {
      const nodes = {
        'message-1': createNode('message-1', 'message')
      };

      const result = getNodesByType(nodes, 'trigger.command');

      expect(result).toEqual([]);
    });

    it('should return empty array for empty nodes', () => {
      const result = getNodesByType({}, 'any-type');
      expect(result).toEqual([]);
    });
  });

  describe('countNodes', () => {
    it('should return correct count', () => {
      const nodes = {
        'node-1': createNode('node-1'),
        'node-2': createNode('node-2'),
        'node-3': createNode('node-3')
      };

      expect(countNodes(nodes)).toBe(3);
    });

    it('should return 0 for empty object', () => {
      expect(countNodes({})).toBe(0);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through normalize -> serialize -> normalize', () => {
      const originalNodes = [
        createNode('node-1', 'trigger.command'),
        createNode('node-2', 'message'),
        createNode('node-3', 'condition')
      ];

      // Normalize array to object
      const normalized = normalizeNodes(originalNodes);

      // Serialize back to array
      const serialized = serializeNodes(normalized);

      // Normalize again
      const renormalized = normalizeNodes(serialized);

      // Should be equivalent to first normalization
      expect(renormalized).toEqual(normalized);
      expect(Object.keys(renormalized)).toHaveLength(3);
    });

    it('should handle JSON string round-trip', () => {
      const originalNodes = {
        'node-1': createNode('node-1'),
        'node-2': createNode('node-2')
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(serializeNodes(originalNodes));

      // Parse and normalize
      const result = normalizeNodes(jsonString);

      expect(result['node-1']).toBeDefined();
      expect(result['node-2']).toBeDefined();
      expect(result['node-1'].id).toBe('node-1');
      expect(result['node-2'].id).toBe('node-2');
    });
  });
});
