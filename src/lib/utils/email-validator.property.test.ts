/**
 * @file: src/lib/utils/email-validator.property.test.ts
 * @description: Property-based тесты для EmailValidator
 * @project: SaaS Bonus System
 * @dependencies: fast-check, jest
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

import * as fc from 'fast-check';
import {
  validateEmail,
  looksLikeEmail,
  EmailValidator
} from './email-validator';

describe('EmailValidator Property Tests', () => {
  const emailValidator = new EmailValidator();

  /**
   * **Feature: email-registration-workflow, Property 1: Email validation rejects invalid formats**
   * **Validates: Requirements 1.3**
   *
   * For any string that does not match email pattern (contains no @ or no domain),
   * the email validator SHALL return invalid result.
   */
  describe('Property 1: Email validation rejects invalid formats', () => {
    it('strings without @ are invalid', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes('@')),
          (noAtString) => {
            const result = validateEmail(noAtString);
            return !result.valid;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('strings with @ but no domain are invalid', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc
              .string({ minLength: 1 })
              .filter((s) => !s.includes('@') && !s.includes('.')),
            fc
              .string({ minLength: 1 })
              .filter((s) => !s.includes('@') && !s.includes('.'))
          ),
          ([local, domain]) => {
            // Создаем email без точки в домене
            const invalidEmail = `${local}@${domain}`;
            const result = validateEmail(invalidEmail);
            return !result.valid;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty strings are invalid', () => {
      fc.assert(
        fc.property(fc.constant(''), (emptyString) => {
          const result = validateEmail(emptyString);
          return (
            !result.valid && result.error === 'Пожалуйста, введите email адрес'
          );
        }),
        { numRuns: 1 }
      );
    });

    it('whitespace-only strings are invalid', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n')),
          (whitespaceString) => {
            const result = validateEmail(whitespaceString);
            return !result.valid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: email-registration-workflow, Property 2: Email validation accepts valid formats**
   * **Validates: Requirements 1.2**
   *
   * For any string matching pattern `local@domain.tld`, the email validator SHALL return valid result.
   */
  describe('Property 2: Email validation accepts valid formats', () => {
    // Генератор валидных email адресов
    const validEmailArb = fc
      .tuple(
        // local part: буквы, цифры, точки, подчеркивания, дефисы
        fc
          .stringOf(
            fc.constantFrom(
              ...'abcdefghijklmnopqrstuvwxyz0123456789._-'.split('')
            ),
            { minLength: 1, maxLength: 20 }
          )
          .filter(
            (s) => !s.startsWith('.') && !s.endsWith('.') && !s.includes('..')
          ),
        // domain: буквы и цифры
        fc.stringOf(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
          { minLength: 1, maxLength: 15 }
        ),
        // tld: только буквы
        fc.stringOf(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
          { minLength: 2, maxLength: 6 }
        )
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    it('valid email format is accepted', () => {
      fc.assert(
        fc.property(validEmailArb, (email) => {
          const result = validateEmail(email);
          return result.valid && result.email === email.toLowerCase();
        }),
        { numRuns: 100 }
      );
    });

    it('email is normalized to lowercase', () => {
      fc.assert(
        fc.property(validEmailArb, (email) => {
          const upperEmail = email.toUpperCase();
          const result = validateEmail(upperEmail);
          return result.valid && result.email === email.toLowerCase();
        }),
        { numRuns: 100 }
      );
    });

    it('common email domains are accepted', () => {
      const commonDomains = [
        'gmail.com',
        'mail.ru',
        'yandex.ru',
        'outlook.com',
        'yahoo.com'
      ];

      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
            ),
            { minLength: 3, maxLength: 15 }
          ),
          fc.constantFrom(...commonDomains),
          (local, domain) => {
            const email = `${local}@${domain}`;
            const result = validateEmail(email);
            return result.valid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('looksLikeEmail helper', () => {
    it('returns true for strings with @ and .', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 1 }),
            fc.string({ minLength: 1 }),
            fc.string({ minLength: 1 })
          ),
          ([a, b, c]) => {
            const emailLike = `${a}@${b}.${c}`;
            return looksLikeEmail(emailLike) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns false for strings without @', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes('@')),
          (noAt) => {
            return looksLikeEmail(noAt) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
