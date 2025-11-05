/**
 * @file: src/lib/security/regex-validator.ts
 * @description: Regex validator для защиты от ReDoS (Regular Expression Denial of Service) атак
 * @project: SaaS Bonus System
 * @dependencies: None
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';

/**
 * Результат валидации regex
 */
export interface RegexValidationResult {
  isValid: boolean;
  error?: string;
  complexity?: number;
}

/**
 * Сервис для валидации regex паттернов и защиты от ReDoS
 */
export class RegexValidator {
  // Максимальная длина regex паттерна
  private static readonly MAX_PATTERN_LENGTH = 500;

  // Максимальная сложность (количество операторов и квантификаторов)
  private static readonly MAX_COMPLEXITY = 100;

  // Максимальная глубина вложенности групп
  private static readonly MAX_NESTING_DEPTH = 10;

  // Опасные паттерны, которые могут вызвать ReDoS
  private static readonly DANGEROUS_PATTERNS = [
    // Nested quantifiers (a+)+, (a*)*, (a?)? etc.
    /\([^)]*\)[+*?]\+/,
    /\([^)]*\)[+*?]\*/,
    /\([^)]*\)[+*?]\?/,
    // Multiple quantifiers on same group
    /\([^)]*\)\{[^}]*\}\+/, // (a{1,5})+
    /\([^)]*\)\{[^}]*\}\*/,
    // Overlapping alternations
    /\([^)]*\|[^)]*\)[+*]/,
    // Exponential backtracking patterns
    /a+\+/, // a++
    /a+\*/, // a+*
    /a+\{2,\}/, // a+{2,}
    // Catastrophic backtracking patterns
    /\(a\+\)\+\+/,
    /\(a\*\)\*\*/,
    /\(a\?\)\+\?/
  ];

  /**
   * Валидирует regex паттерн на безопасность
   * @param pattern Regex паттерн для проверки
   * @param flags Флаги regex (опционально)
   * @returns Результат валидации
   */
  static validate(pattern: string, flags?: string): RegexValidationResult {
    try {
      // Проверка на пустой паттерн
      if (!pattern || typeof pattern !== 'string') {
        return {
          isValid: false,
          error: 'Regex pattern is required and must be a string'
        };
      }

      // Проверка длины паттерна
      if (pattern.length > this.MAX_PATTERN_LENGTH) {
        logger.warn('ReDoS attempt detected: pattern too long', {
          patternLength: pattern.length,
          maxLength: this.MAX_PATTERN_LENGTH
        });
        return {
          isValid: false,
          error: `Regex pattern exceeds maximum length of ${this.MAX_PATTERN_LENGTH} characters`
        };
      }

      // Проверка на опасные паттерны
      for (const dangerousPattern of this.DANGEROUS_PATTERNS) {
        if (dangerousPattern.test(pattern)) {
          logger.warn('ReDoS attempt detected: dangerous pattern', {
            pattern: pattern.substring(0, 100)
          });
          return {
            isValid: false,
            error: 'Regex pattern contains potentially dangerous nested quantifiers that may cause ReDoS'
          };
        }
      }

      // Проверка сложности паттерна
      const complexity = this.calculateComplexity(pattern);
      if (complexity > this.MAX_COMPLEXITY) {
        logger.warn('ReDoS attempt detected: pattern too complex', {
          complexity,
          maxComplexity: this.MAX_COMPLEXITY,
          pattern: pattern.substring(0, 100)
        });
        return {
          isValid: false,
          error: `Regex pattern complexity (${complexity}) exceeds maximum allowed complexity (${this.MAX_COMPLEXITY})`,
          complexity
        };
      }

      // Проверка глубины вложенности
      const nestingDepth = this.calculateNestingDepth(pattern);
      if (nestingDepth > this.MAX_NESTING_DEPTH) {
        logger.warn('ReDoS attempt detected: nesting depth too high', {
          nestingDepth,
          maxDepth: this.MAX_NESTING_DEPTH,
          pattern: pattern.substring(0, 100)
        });
        return {
          isValid: false,
          error: `Regex pattern nesting depth (${nestingDepth}) exceeds maximum allowed depth (${this.MAX_NESTING_DEPTH})`,
          complexity
        };
      }

      // Пытаемся создать RegExp объект для проверки синтаксиса
      try {
        new RegExp(pattern, flags);
      } catch (syntaxError) {
        return {
          isValid: false,
          error: `Invalid regex syntax: ${syntaxError instanceof Error ? syntaxError.message : 'Unknown error'}`
        };
      }

      // Все проверки пройдены
      return {
        isValid: true,
        complexity
      };
    } catch (error) {
      logger.error('Regex validation error', {
        pattern: pattern?.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isValid: false,
        error: `Regex validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Вычисляет сложность regex паттерна
   * Подсчитывает количество операторов, квантификаторов и групп
   */
  private static calculateComplexity(pattern: string): number {
    let complexity = 0;

    // Квантификаторы: +, *, ?, {n}, {n,}, {n,m}
    complexity += (pattern.match(/[+*?]/g) || []).length;
    complexity += (pattern.match(/\{[0-9, ]+\}/g) || []).length;

    // Группы: (), (?:), (?=), (?!), (?<=), (?<!)
    complexity += (pattern.match(/\(/g) || []).length;

    // Альтернации: |
    complexity += (pattern.match(/\|/g) || []).length;

    // Якоря: ^, $
    complexity += (pattern.match(/[\^$]/g) || []).length;

    // Классы символов: [], [^]
    complexity += (pattern.match(/\[[^\]]*\]/g) || []).length * 2;

    // Обратные ссылки: \1, \2, etc.
    complexity += (pattern.match(/\\[0-9]+/g) || []).length * 2;

    return complexity;
  }

  /**
   * Вычисляет максимальную глубину вложенности групп в паттерне
   */
  private static calculateNestingDepth(pattern: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];

      // Пропускаем экранированные символы
      if (char === '\\' && i + 1 < pattern.length) {
        i++;
        continue;
      }

      // Пропускаем классы символов
      if (char === '[') {
        while (i < pattern.length && pattern[i] !== ']') {
          if (pattern[i] === '\\') {
            i++;
          }
          i++;
        }
        continue;
      }

      if (char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === ')') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  /**
   * Безопасное создание RegExp с валидацией
   * @param pattern Regex паттерн
   * @param flags Флаги
   * @param timeoutMs Таймаут для тестирования (по умолчанию 100ms)
   * @returns RegExp объект или null если небезопасный
   */
  static async createSafeRegex(
    pattern: string,
    flags?: string,
    timeoutMs: number = 100
  ): Promise<RegExp | null> {
    const validation = this.validate(pattern, flags);
    if (!validation.isValid) {
      logger.warn('Regex validation failed', {
        pattern: pattern.substring(0, 100),
        error: validation.error
      });
      return null;
    }

    try {
      const regex = new RegExp(pattern, flags);

      // Тестируем regex на простой строке с таймаутом
      // (защита от немедленного ReDoS при создании)
      const testString = 'a'.repeat(Math.min(50, pattern.length));
      const startTime = Date.now();

      // Используем Promise.race для таймаута
      const testPromise = new Promise<boolean>((resolve) => {
        try {
          const result = regex.test(testString);
          resolve(result);
        } catch {
          resolve(false);
        }
      });

      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          if (elapsed > timeoutMs) {
            logger.warn('Regex test timeout (potential ReDoS)', {
              pattern: pattern.substring(0, 100),
              elapsedMs: elapsed,
              timeoutMs
            });
            resolve(false);
          }
        }, timeoutMs);
      });

      // Если тест занимает слишком долго, считаем regex небезопасным
      const testResult = await Promise.race([testPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        return null;
      }

      return regex;
    } catch (error) {
      logger.error('Failed to create regex', {
        pattern: pattern.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Безопасное выполнение regex test с таймаутом
   * @param regex RegExp объект
   * @param string Строка для тестирования
   * @param timeoutMs Таймаут в миллисекундах (по умолчанию 100ms)
   * @returns Результат test или null если таймаут
   */
  static async safeTest(
    regex: RegExp,
    string: string,
    timeoutMs: number = 100
  ): Promise<boolean | null> {
    try {
      const startTime = Date.now();

      const testPromise = new Promise<boolean>((resolve) => {
        try {
          resolve(regex.test(string));
        } catch {
          resolve(false);
        }
      });

      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          if (Date.now() - startTime > timeoutMs) {
            logger.warn('Regex test timeout (potential ReDoS)', {
              pattern: regex.source.substring(0, 100),
              stringLength: string.length,
              elapsedMs: Date.now() - startTime,
              timeoutMs
            });
            resolve(false);
          }
        }, timeoutMs);
      });

      const result = await Promise.race([testPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;

      if (elapsed > timeoutMs) {
        return null; // Таймаут
      }

      return result;
    } catch (error) {
      logger.error('Regex test error', {
        pattern: regex.source.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}
