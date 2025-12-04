/**
 * @file: src/lib/services/user-metadata.property.test.ts
 * @description: Property-based тесты для User Metadata операций
 * @project: SaaS Bonus System
 * @dependencies: fast-check, jest
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

import * as fc from 'fast-check';

// Мокаем db для тестирования логики без реальной БД
const mockDb = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
};

jest.mock('@/lib/db', () => ({
  db: mockDb
}));

// Импортируем после мока
import { UserService } from './user.service';

describe('User Metadata Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: email-registration-workflow, Property 8: Metadata merge preserves existing keys**
   * **Validates: Requirements 4.3**
   *
   * For any existing metadata object and new key-value pair,
   * updating metadata SHALL preserve all existing keys not being updated.
   */
  describe('Property 8: Metadata merge preserves existing keys', () => {
    it('updating metadata preserves unmodified keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем существующие metadata
          fc.dictionary(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ),
          // Генерируем новые данные для обновления
          fc.dictionary(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ),
          async (existingMetadata, newData) => {
            const userId = 'test-user-id';

            // Мокаем текущие metadata
            mockDb.user.findUnique.mockResolvedValue({
              metadata: existingMetadata
            });
            mockDb.user.update.mockResolvedValue({ metadata: {} });

            // Вызываем updateMetadata
            await UserService.updateMetadata(userId, newData);

            // Проверяем что update был вызван
            expect(mockDb.user.update).toHaveBeenCalled();

            // Получаем переданные metadata
            const updateCall = mockDb.user.update.mock.calls[0][0];
            const updatedMetadata = updateCall.data.metadata;

            // Проверяем что все ключи из existingMetadata, которые не в newData, сохранены
            for (const [key, value] of Object.entries(existingMetadata)) {
              if (!(key in newData)) {
                expect(updatedMetadata[key]).toEqual(value);
              }
            }

            // Проверяем что все ключи из newData присутствуют (если не null)
            for (const [key, value] of Object.entries(newData)) {
              if (value !== null && value !== undefined) {
                expect(updatedMetadata[key]).toEqual(value);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 9: Metadata null removes key**
   * **Validates: Requirements 4.4**
   *
   * For any metadata object with key K, setting K to null
   * SHALL result in metadata without key K.
   */
  describe('Property 9: Metadata null removes key', () => {
    it('setting key to null removes it from metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем существующие metadata с хотя бы одним ключом
          fc.dictionary(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            { minKeys: 1, maxKeys: 5 }
          ),
          async (existingMetadata) => {
            const userId = 'test-user-id';
            const keys = Object.keys(existingMetadata);

            if (keys.length === 0) return true;

            // Выбираем случайный ключ для удаления
            const keyToRemove = keys[0];

            // Мокаем текущие metadata
            mockDb.user.findUnique.mockResolvedValue({
              metadata: existingMetadata
            });
            mockDb.user.update.mockResolvedValue({ metadata: {} });

            // Вызываем setMetadata с null
            await UserService.setMetadata(userId, keyToRemove, null);

            // Проверяем что update был вызван
            expect(mockDb.user.update).toHaveBeenCalled();

            // Получаем переданные metadata
            const updateCall = mockDb.user.update.mock.calls[0][0];
            const updatedMetadata = updateCall.data.metadata;

            // Проверяем что ключ удален
            expect(keyToRemove in updatedMetadata).toBe(false);

            // Проверяем что остальные ключи сохранены
            for (const [key, value] of Object.entries(existingMetadata)) {
              if (key !== keyToRemove) {
                expect(updatedMetadata[key]).toEqual(value);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('updateMetadata with null values removes those keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем существующие metadata
          fc.dictionary(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            { minKeys: 2, maxKeys: 5 }
          ),
          async (existingMetadata) => {
            const userId = 'test-user-id';
            const keys = Object.keys(existingMetadata);

            if (keys.length < 2) return true;

            // Создаем update с null для первого ключа
            const keyToRemove = keys[0];
            const updateData = { [keyToRemove]: null };

            // Мокаем текущие metadata
            mockDb.user.findUnique.mockResolvedValue({
              metadata: existingMetadata
            });
            mockDb.user.update.mockResolvedValue({ metadata: {} });

            // Вызываем updateMetadata
            await UserService.updateMetadata(userId, updateData);

            // Получаем переданные metadata
            const updateCall = mockDb.user.update.mock.calls[0][0];
            const updatedMetadata = updateCall.data.metadata;

            // Проверяем что ключ удален
            expect(keyToRemove in updatedMetadata).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
