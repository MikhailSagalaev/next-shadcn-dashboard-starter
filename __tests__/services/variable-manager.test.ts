/**
 * @file: __tests__/services/variable-manager.test.ts
 * @description: Unit тесты для VariableManager (getSync, cache, preload)
 * @project: SaaS Bonus System
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

import {
  VariableManager,
  createVariableManager
} from '@/lib/services/workflow/variable-manager';
import { db } from '@/lib/db';

// Mock the db module with proper structure
jest.mock('@/lib/db', () => ({
  db: {
    workflowVariable: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    }
  }
}));

describe('VariableManager', () => {
  const projectId = 'test-project-id';
  const workflowId = 'test-workflow-id';
  const userId = 'test-user-id';
  const sessionId = 'test-session-id';

  let variableManager: VariableManager;

  beforeEach(() => {
    jest.clearAllMocks();
    variableManager = createVariableManager(
      projectId,
      workflowId,
      userId,
      sessionId
    );
  });

  describe('createVariableManager', () => {
    it('should create a VariableManager instance', () => {
      const manager = createVariableManager(
        projectId,
        workflowId,
        userId,
        sessionId
      );
      expect(manager).toBeInstanceOf(VariableManager);
    });

    it('should create a VariableManager with optional parameters', () => {
      const manager = createVariableManager(projectId);
      expect(manager).toBeInstanceOf(VariableManager);
    });
  });

  describe('preloadCache', () => {
    it('should load variables from database into cache', async () => {
      const mockVariables = [
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'var1',
          value: 'value1',
          expiresAt: null
        },
        {
          id: '2',
          projectId,
          sessionId,
          scope: 'session',
          key: 'var2',
          value: 123,
          expiresAt: null
        },
        {
          id: '3',
          projectId,
          sessionId,
          scope: 'user',
          key: 'userVar',
          value: { nested: true },
          expiresAt: null
        }
      ];

      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue(
        mockVariables
      );

      await variableManager.preloadCache();

      expect(db.workflowVariable.findMany).toHaveBeenCalledWith({
        where: {
          projectId,
          sessionId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]
        }
      });

      // Verify cache is populated
      expect(variableManager.getSync('var1', 'session')).toBe('value1');
      expect(variableManager.getSync('var2', 'session')).toBe(123);
      expect(variableManager.getSync('userVar', 'user')).toEqual({
        nested: true
      });
    });

    it('should handle empty result from database', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([]);

      await variableManager.preloadCache();

      expect(variableManager.getSync('anyVar', 'session')).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      // Should not throw
      await expect(variableManager.preloadCache()).resolves.not.toThrow();
    });

    it('should clear cache before loading new variables', async () => {
      // First load
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'oldVar',
          value: 'oldValue',
          expiresAt: null
        }
      ]);
      await variableManager.preloadCache();
      expect(variableManager.getSync('oldVar', 'session')).toBe('oldValue');

      // Second load with different data
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '2',
          projectId,
          sessionId,
          scope: 'session',
          key: 'newVar',
          value: 'newValue',
          expiresAt: null
        }
      ]);
      await variableManager.preloadCache();

      // Old variable should be gone
      expect(variableManager.getSync('oldVar', 'session')).toBeUndefined();
      expect(variableManager.getSync('newVar', 'session')).toBe('newValue');
    });
  });

  describe('getSync', () => {
    it('should return value from cache', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'testVar',
          value: 'testValue',
          expiresAt: null
        }
      ]);

      await variableManager.preloadCache();

      expect(variableManager.getSync('testVar', 'session')).toBe('testValue');
    });

    it('should return undefined for non-existent variable', () => {
      expect(variableManager.getSync('nonExistent', 'session')).toBeUndefined();
    });

    it('should use session scope by default', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'defaultScope',
          value: 'sessionValue',
          expiresAt: null
        }
      ]);

      await variableManager.preloadCache();

      expect(variableManager.getSync('defaultScope')).toBe('sessionValue');
    });

    it('should differentiate between scopes', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'sameKey',
          value: 'sessionValue',
          expiresAt: null
        },
        {
          id: '2',
          projectId,
          sessionId,
          scope: 'user',
          key: 'sameKey',
          value: 'userValue',
          expiresAt: null
        }
      ]);

      await variableManager.preloadCache();

      expect(variableManager.getSync('sameKey', 'session')).toBe(
        'sessionValue'
      );
      expect(variableManager.getSync('sameKey', 'user')).toBe('userValue');
    });
  });

  describe('updateCache', () => {
    it('should update cache without database call', () => {
      variableManager.updateCache('cacheOnly', 'cachedValue', 'session');

      expect(variableManager.getSync('cacheOnly', 'session')).toBe(
        'cachedValue'
      );
      expect(db.workflowVariable.update).not.toHaveBeenCalled();
      expect(db.workflowVariable.create).not.toHaveBeenCalled();
    });

    it('should handle complex objects', () => {
      const complexValue = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3]
      };
      variableManager.updateCache('complex', complexValue, 'session');

      expect(variableManager.getSync('complex', 'session')).toEqual(
        complexValue
      );
    });

    it('should serialize BigInt values', () => {
      const bigIntValue = BigInt(9007199254740991);
      variableManager.updateCache('bigInt', bigIntValue, 'session');

      expect(variableManager.getSync('bigInt', 'session')).toBe(
        '9007199254740991'
      );
    });
  });

  describe('removeFromCache', () => {
    it('should remove value from cache', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'toRemove',
          value: 'value',
          expiresAt: null
        }
      ]);

      await variableManager.preloadCache();
      expect(variableManager.getSync('toRemove', 'session')).toBe('value');

      variableManager.removeFromCache('toRemove', 'session');
      expect(variableManager.getSync('toRemove', 'session')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should create new variable and update cache', async () => {
      (db.workflowVariable.findFirst as jest.Mock).mockResolvedValue(null);
      (db.workflowVariable.create as jest.Mock).mockResolvedValue({
        id: 'new-id',
        projectId,
        sessionId,
        scope: 'session',
        key: 'newVar',
        value: 'newValue'
      });

      await variableManager.set('newVar', 'newValue', 'session');

      // Cache should be updated synchronously
      expect(variableManager.getSync('newVar', 'session')).toBe('newValue');

      expect(db.workflowVariable.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId,
          sessionId,
          scope: 'session',
          key: 'newVar',
          value: 'newValue'
        })
      });
    });

    it('should update existing variable', async () => {
      (db.workflowVariable.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        projectId,
        sessionId,
        scope: 'session',
        key: 'existingVar',
        value: 'oldValue'
      });
      (db.workflowVariable.update as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        value: 'updatedValue'
      });

      await variableManager.set('existingVar', 'updatedValue', 'session');

      expect(variableManager.getSync('existingVar', 'session')).toBe(
        'updatedValue'
      );
      expect(db.workflowVariable.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: expect.objectContaining({
          value: 'updatedValue'
        })
      });
    });

    it('should set TTL when provided', async () => {
      (db.workflowVariable.findFirst as jest.Mock).mockResolvedValue(null);
      (db.workflowVariable.create as jest.Mock).mockResolvedValue({});

      const ttlSeconds = 3600; // 1 hour
      await variableManager.set('ttlVar', 'value', 'session', ttlSeconds);

      expect(db.workflowVariable.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date)
        })
      });
    });
  });

  describe('delete', () => {
    it('should delete variable from database and cache', async () => {
      // First, populate cache
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          projectId,
          sessionId,
          scope: 'session',
          key: 'toDelete',
          value: 'value',
          expiresAt: null
        }
      ]);
      await variableManager.preloadCache();

      (db.workflowVariable.deleteMany as jest.Mock).mockResolvedValue({
        count: 1
      });

      await variableManager.delete('toDelete', 'session');

      expect(variableManager.getSync('toDelete', 'session')).toBeUndefined();
      expect(db.workflowVariable.deleteMany).toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      (db.workflowVariable.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      // Should not throw
      await expect(
        variableManager.delete('anyVar', 'session')
      ).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true when variable exists', async () => {
      (db.workflowVariable.count as jest.Mock).mockResolvedValue(1);

      const result = await variableManager.has('existingVar', 'session');

      expect(result).toBe(true);
    });

    it('should return false when variable does not exist', async () => {
      (db.workflowVariable.count as jest.Mock).mockResolvedValue(0);

      const result = await variableManager.has('nonExistent', 'session');

      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should return all variables for scope', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([
        { key: 'var1', value: 'value1' },
        { key: 'var2', value: 'value2' },
        { key: 'var3', value: { nested: true } }
      ]);

      const result = await variableManager.list('session');

      expect(result).toEqual({
        var1: 'value1',
        var2: 'value2',
        var3: { nested: true }
      });
    });

    it('should return empty object when no variables', async () => {
      (db.workflowVariable.findMany as jest.Mock).mockResolvedValue([]);

      const result = await variableManager.list('session');

      expect(result).toEqual({});
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired variables', async () => {
      (db.workflowVariable.deleteMany as jest.Mock).mockResolvedValue({
        count: 5
      });

      const result = await variableManager.cleanupExpired();

      expect(result).toBe(5);
      expect(db.workflowVariable.deleteMany).toHaveBeenCalledWith({
        where: {
          projectId,
          expiresAt: { lt: expect.any(Date) }
        }
      });
    });

    it('should return 0 when no expired variables', async () => {
      (db.workflowVariable.deleteMany as jest.Mock).mockResolvedValue({
        count: 0
      });

      const result = await variableManager.cleanupExpired();

      expect(result).toBe(0);
    });
  });
});
