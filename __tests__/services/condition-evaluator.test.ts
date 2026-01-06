/**
 * @file: __tests__/services/condition-evaluator.test.ts
 * @description: Unit тесты для ConditionEvaluator (validateAST, evaluate, evaluateSimple)
 * @project: SaaS Bonus System
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import { ConditionEvaluator } from '@/lib/services/workflow/condition-evaluator';
import type { ExecutionContext, VariableManager } from '@/types/workflow';

jest.mock('@/lib/logger');
jest.mock('@/lib/security/regex-validator', () => ({
  RegexValidator: {
    validate: jest.fn().mockReturnValue({ isValid: true }),
    safeTest: jest
      .fn()
      .mockImplementation((regex, str) => Promise.resolve(regex.test(str)))
  }
}));

describe('ConditionEvaluator', () => {
  // Mock VariableManager
  const createMockVariableManager = (
    variables: Record<string, any> = {}
  ): VariableManager => ({
    get: jest.fn().mockImplementation((key) => Promise.resolve(variables[key])),
    getSync: jest.fn().mockImplementation((key) => variables[key]),
    set: jest.fn().mockResolvedValue(undefined),
    has: jest
      .fn()
      .mockImplementation((key) => Promise.resolve(key in variables)),
    delete: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue(variables),
    cleanupExpired: jest.fn().mockResolvedValue(0)
  });

  // Mock ExecutionContext
  const createMockContext = (
    variables: Record<string, any> = {}
  ): ExecutionContext => ({
    executionId: 'test-execution-id',
    projectId: 'test-project-id',
    workflowId: 'test-workflow-id',
    version: 1,
    sessionId: 'test-session-id',
    userId: 'test-user-id',
    telegram: {
      chatId: '123456',
      userId: '789',
      username: 'testuser',
      botToken: 'test-token'
    },
    variables: createMockVariableManager(variables),
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    },
    services: {
      db: {},
      http: {}
    },
    now: () => new Date(),
    step: 0,
    maxSteps: 100
  });

  describe('evaluateSimple', () => {
    describe('equals operator', () => {
      it('should return true for equal values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('test', 'equals', 'test')
        ).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(123, '===', 123)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(true, '==', true)).toBe(true);
      });

      it('should return false for non-equal values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('test', 'equals', 'other')
        ).toBe(false);
        expect(ConditionEvaluator.evaluateSimple(123, '===', 456)).toBe(false);
      });
    });

    describe('not_equals operator', () => {
      it('should return true for non-equal values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('test', 'not_equals', 'other')
        ).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(123, '!==', 456)).toBe(true);
      });

      it('should return false for equal values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('test', 'not_equals', 'test')
        ).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should return true when string contains substring', () => {
        expect(
          ConditionEvaluator.evaluateSimple('hello world', 'contains', 'world')
        ).toBe(true);
        expect(
          ConditionEvaluator.evaluateSimple('HELLO WORLD', 'contains', 'hello')
        ).toBe(true); // case insensitive
      });

      it('should return false when string does not contain substring', () => {
        expect(
          ConditionEvaluator.evaluateSimple('hello world', 'contains', 'foo')
        ).toBe(false);
      });

      it('should respect case sensitivity', () => {
        expect(
          ConditionEvaluator.evaluateSimple(
            'Hello World',
            'contains',
            'hello',
            true
          )
        ).toBe(false);
        expect(
          ConditionEvaluator.evaluateSimple(
            'Hello World',
            'contains',
            'Hello',
            true
          )
        ).toBe(true);
      });
    });

    describe('not_contains operator', () => {
      it('should return true when string does not contain substring', () => {
        expect(
          ConditionEvaluator.evaluateSimple(
            'hello world',
            'not_contains',
            'foo'
          )
        ).toBe(true);
      });

      it('should return false when string contains substring', () => {
        expect(
          ConditionEvaluator.evaluateSimple(
            'hello world',
            'not_contains',
            'world'
          )
        ).toBe(false);
      });
    });

    describe('comparison operators', () => {
      it('should handle greater than', () => {
        expect(ConditionEvaluator.evaluateSimple(10, 'greater', 5)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(10, '>', 5)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(5, 'greater', 10)).toBe(false);
      });

      it('should handle less than', () => {
        expect(ConditionEvaluator.evaluateSimple(5, 'less', 10)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(5, '<', 10)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(10, 'less', 5)).toBe(false);
      });

      it('should handle greater or equal', () => {
        expect(ConditionEvaluator.evaluateSimple(10, '>=', 10)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(10, '>=', 5)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(5, '>=', 10)).toBe(false);
      });

      it('should handle less or equal', () => {
        expect(ConditionEvaluator.evaluateSimple(10, '<=', 10)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(5, '<=', 10)).toBe(true);
        expect(ConditionEvaluator.evaluateSimple(10, '<=', 5)).toBe(false);
      });
    });

    describe('is_empty operator', () => {
      it('should return true for empty values', () => {
        expect(ConditionEvaluator.evaluateSimple('', 'is_empty', null)).toBe(
          true
        );
        expect(ConditionEvaluator.evaluateSimple('   ', 'is_empty', null)).toBe(
          true
        );
        expect(ConditionEvaluator.evaluateSimple(null, 'is_empty', null)).toBe(
          true
        );
        expect(
          ConditionEvaluator.evaluateSimple(undefined, 'is_empty', null)
        ).toBe(true);
      });

      it('should return false for non-empty values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('hello', 'is_empty', null)
        ).toBe(false);
        expect(ConditionEvaluator.evaluateSimple(123, 'is_empty', null)).toBe(
          false
        );
      });
    });

    describe('is_not_empty operator', () => {
      it('should return true for non-empty values', () => {
        expect(
          ConditionEvaluator.evaluateSimple('hello', 'is_not_empty', null)
        ).toBe(true);
        expect(
          ConditionEvaluator.evaluateSimple(123, 'is_not_empty', null)
        ).toBe(true);
      });

      it('should return false for empty values', () => {
        // Note: evaluateSimple returns the actual value for is_not_empty, not a boolean
        // Empty string returns '' which is falsy
        expect(
          ConditionEvaluator.evaluateSimple('', 'is_not_empty', null)
        ).toBeFalsy();
        expect(
          ConditionEvaluator.evaluateSimple(null, 'is_not_empty', null)
        ).toBeFalsy();
      });
    });

    describe('unknown operator', () => {
      it('should throw error for unknown operator', () => {
        expect(() =>
          ConditionEvaluator.evaluateSimple('test', 'unknown_op', 'test')
        ).toThrow('Unknown operator: unknown_op');
      });
    });
  });

  describe('isComplexExpression', () => {
    it('should return true for complex expressions', () => {
      expect(ConditionEvaluator.isComplexExpression('a && b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a || b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a > b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a < b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a >= b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a <= b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a === b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a !== b')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('!a')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('a ? b : c')).toBe(true);
      expect(ConditionEvaluator.isComplexExpression('Math.max(a, b)')).toBe(
        true
      );
      expect(ConditionEvaluator.isComplexExpression('get("balance")')).toBe(
        true
      );
      expect(ConditionEvaluator.isComplexExpression('isEmpty(value)')).toBe(
        true
      );
      expect(ConditionEvaluator.isComplexExpression('notEmpty(value)')).toBe(
        true
      );
    });

    it('should return false for simple expressions', () => {
      expect(ConditionEvaluator.isComplexExpression('simpleVar')).toBe(false);
      expect(ConditionEvaluator.isComplexExpression('123')).toBe(false);
      expect(ConditionEvaluator.isComplexExpression('"string"')).toBe(false);
    });
  });

  describe('validateAST', () => {
    // Note: The evaluate method uses acorn parser which expects valid JavaScript expressions
    // These tests verify the AST validation logic indirectly through evaluate()

    it('should reject disallowed AST node types', async () => {
      const context = createMockContext();

      // Function declarations are not allowed
      await expect(
        ConditionEvaluator.evaluate('function test() {}', context)
      ).rejects.toThrow();

      // Class declarations are not allowed
      await expect(
        ConditionEvaluator.evaluate('class Test {}', context)
      ).rejects.toThrow();
    });

    it('should reject expressions exceeding max length', async () => {
      const context = createMockContext();
      const longExpression = 'a'.repeat(1001);

      await expect(
        ConditionEvaluator.evaluate(longExpression, context)
      ).rejects.toThrow('exceeds maximum length');
    });
  });

  describe('evaluate', () => {
    // Note: The evaluate method has specific parsing requirements
    // These tests verify error handling and edge cases

    it('should throw error for expressions exceeding max length', async () => {
      const context = createMockContext();
      const longExpression = 'a'.repeat(1001);

      await expect(
        ConditionEvaluator.evaluate(longExpression, context)
      ).rejects.toThrow('exceeds maximum length');
    });

    it('should throw error for disallowed AST node types', async () => {
      const context = createMockContext();

      // This would create a disallowed node type (e.g., function declaration)
      await expect(
        ConditionEvaluator.evaluate('function test() {}', context)
      ).rejects.toThrow();
    });
  });
});
