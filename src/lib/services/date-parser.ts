/**
 * @file: src/lib/services/date-parser.ts
 * @description: Сервис для парсинга и валидации дат рождения
 * @project: SaaS Bonus System
 * @dependencies: none
 * @created: 2025-12-04
 * @author: AI Assistant + User
 */

export interface DateParserResult {
  success: boolean;
  date?: Date;
  error?: string;
  formatted?: string;
}

export interface DateValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Максимальный возраст в годах
 */
const MAX_AGE_YEARS = 120;

/**
 * Регулярные выражения для парсинга дат
 */
const DATE_PATTERNS = {
  // DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  fullDate: /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/,
  // DD.MM, DD/MM, DD-MM (без года)
  shortDate: /^(\d{1,2})[.\/-](\d{1,2})$/
};

/**
 * Парсит строку даты в объект Date
 * Поддерживаемые форматы: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD.MM, DD/MM, DD-MM
 */
export function parseBirthday(input: string): DateParserResult {
  if (!input || typeof input !== 'string') {
    return {
      success: false,
      error: 'Пожалуйста, введите дату рождения'
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'Пожалуйста, введите дату рождения'
    };
  }

  let day: number;
  let month: number;
  let year: number;

  // Пробуем полный формат (DD.MM.YYYY)
  const fullMatch = trimmed.match(DATE_PATTERNS.fullDate);
  if (fullMatch) {
    day = parseInt(fullMatch[1], 10);
    month = parseInt(fullMatch[2], 10);
    year = parseInt(fullMatch[3], 10);
  } else {
    // Пробуем короткий формат (DD.MM)
    const shortMatch = trimmed.match(DATE_PATTERNS.shortDate);
    if (shortMatch) {
      day = parseInt(shortMatch[1], 10);
      month = parseInt(shortMatch[2], 10);
      year = new Date().getFullYear();
    } else {
      return {
        success: false,
        error: 'Неверный формат. Используйте ДД.ММ.ГГГГ или ДД.ММ'
      };
    }
  }

  // Валидация месяца
  if (month < 1 || month > 12) {
    return {
      success: false,
      error: 'Неверный месяц. Месяц должен быть от 1 до 12'
    };
  }

  // Валидация дня с учетом месяца
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      success: false,
      error: `Неверный день. В этом месяце ${daysInMonth} дней`
    };
  }

  // Создаем дату (месяц в JS начинается с 0)
  const date = new Date(year, month - 1, day);

  // Валидация даты
  const validation = validateBirthday(date);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  return {
    success: true,
    date,
    formatted: formatBirthday(date)
  };
}

/**
 * Валидирует дату рождения
 */
export function validateBirthday(date: Date): DateValidationResult {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return {
      valid: false,
      error: 'Некорректная дата'
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Проверка на будущую дату
  if (date > today) {
    return {
      valid: false,
      error: 'Дата не может быть в будущем'
    };
  }

  // Проверка на слишком старую дату (возраст > 120 лет)
  const minDate = new Date(
    today.getFullYear() - MAX_AGE_YEARS,
    today.getMonth(),
    today.getDate()
  );

  if (date < minDate) {
    return {
      valid: false,
      error: 'Пожалуйста, введите корректную дату рождения'
    };
  }

  return { valid: true };
}

/**
 * Форматирует дату в строку DD.MM.YYYY
 */
export function formatBirthday(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * DateParser класс для использования в workflow
 */
export class DateParser {
  parse(input: string): DateParserResult {
    return parseBirthday(input);
  }

  format(date: Date): string {
    return formatBirthday(date);
  }

  validate(date: Date): DateValidationResult {
    return validateBirthday(date);
  }
}

export const dateParser = new DateParser();
