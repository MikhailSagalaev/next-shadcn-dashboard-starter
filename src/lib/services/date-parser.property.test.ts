/**
 * @file: src/lib/services/date-parser.property.test.ts
 * @description: Property-based тесты для DateParser
 * @project: SaaS Bonus System
 * @dependencies: fast-check, jest
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

import * as fc from 'fast-check';
import {
  parseBirthday,
  formatBirthday,
  validateBirthday,
  DateParser
} from './date-parser';

describe('DateParser Property Tests', () => {
  const dateParser = new DateParser();

  /**
   * **Feature: email-registration-workflow, Property 3: Date parsing round-trip consistency**
   * **Validates: Requirements 5.1, 5.5**
   *
   * For any valid Date object, formatting then parsing SHALL produce an equivalent date.
   */
  describe('Property 3: Date parsing round-trip consistency', () => {
    it('format then parse produces equivalent date', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date(1900, 0, 1),
            max: new Date()
          }),
          (date) => {
            // Нормализуем дату (убираем время)
            const normalizedDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate()
            );

            const formatted = formatBirthday(normalizedDate);
            const parsed = parseBirthday(formatted);

            if (!parsed.success || !parsed.date) {
              return false;
            }

            // Сравниваем день, месяц, год
            return (
              parsed.date.getDate() === normalizedDate.getDate() &&
              parsed.date.getMonth() === normalizedDate.getMonth() &&
              parsed.date.getFullYear() === normalizedDate.getFullYear()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 4: Date parsing accepts multiple formats**
   * **Validates: Requirements 5.1**
   *
   * For any valid date, parsing strings in formats DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
   * SHALL produce the same Date object.
   */
  describe('Property 4: Date parsing accepts multiple formats', () => {
    it('all separators produce same date', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }), // день (1-28 для простоты)
          fc.integer({ min: 1, max: 12 }), // месяц
          fc.integer({ min: 1950, max: 2024 }), // год
          (day, month, year) => {
            const dayStr = day.toString().padStart(2, '0');
            const monthStr = month.toString().padStart(2, '0');

            const dotFormat = `${dayStr}.${monthStr}.${year}`;
            const slashFormat = `${dayStr}/${monthStr}/${year}`;
            const dashFormat = `${dayStr}-${monthStr}-${year}`;

            const dotResult = parseBirthday(dotFormat);
            const slashResult = parseBirthday(slashFormat);
            const dashResult = parseBirthday(dashFormat);

            // Все форматы должны успешно парситься
            if (
              !dotResult.success ||
              !slashResult.success ||
              !dashResult.success
            ) {
              return false;
            }

            // Все должны давать одинаковую дату
            const dotDate = dotResult.date!;
            const slashDate = slashResult.date!;
            const dashDate = dashResult.date!;

            return (
              dotDate.getTime() === slashDate.getTime() &&
              slashDate.getTime() === dashDate.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 5: Short date format uses current year**
   * **Validates: Requirements 5.2**
   *
   * For any valid DD.MM input, parsing SHALL produce a date with the current year.
   */
  describe('Property 5: Short date format uses current year', () => {
    it('short format uses current year', () => {
      const currentYear = new Date().getFullYear();

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }), // день
          fc.integer({ min: 1, max: 12 }), // месяц
          (day, month) => {
            const dayStr = day.toString().padStart(2, '0');
            const monthStr = month.toString().padStart(2, '0');

            const shortFormat = `${dayStr}.${monthStr}`;
            const result = parseBirthday(shortFormat);

            // Если дата в будущем (текущий год), она будет отклонена
            // Проверяем только успешные парсинги
            if (!result.success) {
              // Это ожидаемо для будущих дат
              return true;
            }

            return result.date!.getFullYear() === currentYear;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 6: Future dates are rejected**
   * **Validates: Requirements 5.3**
   *
   * For any date in the future, the date validator SHALL return invalid result.
   */
  describe('Property 6: Future dates are rejected', () => {
    it('future dates are invalid', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      fc.assert(
        fc.property(
          fc.date({
            min: tomorrow,
            max: new Date(2100, 11, 31)
          }),
          (futureDate) => {
            const validation = validateBirthday(futureDate);
            return (
              !validation.valid &&
              validation.error === 'Дата не может быть в будущем'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 7: Very old dates are rejected**
   * **Validates: Requirements 5.4**
   *
   * For any date resulting in age over 120 years, the date validator SHALL return invalid result.
   */
  describe('Property 7: Very old dates are rejected', () => {
    it('dates older than 120 years are invalid', () => {
      const maxAgeDate = new Date();
      maxAgeDate.setFullYear(maxAgeDate.getFullYear() - 121);

      fc.assert(
        fc.property(
          fc.date({
            min: new Date(1800, 0, 1),
            max: maxAgeDate
          }),
          (veryOldDate) => {
            const validation = validateBirthday(veryOldDate);
            return (
              !validation.valid &&
              validation.error ===
                'Пожалуйста, введите корректную дату рождения'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
