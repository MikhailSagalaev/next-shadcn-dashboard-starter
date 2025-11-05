/**
 * @file: src/lib/security/url-validator.ts
 * @description: URL validator для защиты от SSRF (Server-Side Request Forgery) атак
 * @project: SaaS Bonus System
 * @dependencies: None
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';

/**
 * Результат валидации URL
 */
export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Сервис для валидации URL и защиты от SSRF
 */
export class UrlValidator {
  // Private IP ranges (RFC 1918)
  private static readonly PRIVATE_IP_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fc00:/, // IPv6 private range
    /^fe80:/, // IPv6 link-local
    /^169\.254\./ // Link-local addresses (RFC 3927)
  ];

  // Заблокированные схемы
  private static readonly BLOCKED_SCHEMES = ['file:', 'ftp:', 'data:', 'javascript:', 'vbscript:'];

  // Whitelist разрешенных доменов (опционально, если задан в env)
  private static readonly ALLOWED_DOMAINS = process.env.API_REQUEST_ALLOWED_DOMAINS
    ? process.env.API_REQUEST_ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase())
    : null;

  /**
   * Валидирует URL на предмет SSRF уязвимостей
   * @param url URL для проверки
   * @param allowPrivateIPs Разрешить private IP (по умолчанию false)
   * @returns Результат валидации
   */
  static validate(url: string, allowPrivateIPs: boolean = false): UrlValidationResult {
    try {
      // Проверка на пустой URL
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return {
          isValid: false,
          error: 'URL is required and must be a non-empty string'
        };
      }

      const trimmedUrl = url.trim();

      // Парсим URL
      let parsedUrl: URL;
      try {
        // Добавляем протокол если отсутствует
        const urlWithProtocol = trimmedUrl.includes('://')
          ? trimmedUrl
          : `http://${trimmedUrl}`;
        parsedUrl = new URL(urlWithProtocol);
      } catch (parseError) {
        return {
          isValid: false,
          error: `Invalid URL format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }

      // Проверка схемы протокола
      const scheme = parsedUrl.protocol.replace(':', '').toLowerCase();
      if (!['http', 'https'].includes(scheme)) {
        if (this.BLOCKED_SCHEMES.includes(`${scheme}:`)) {
          return {
            isValid: false,
            error: `Blocked URL scheme: ${scheme}. Only http and https are allowed.`
          };
        }
        return {
          isValid: false,
          error: `Unsupported URL scheme: ${scheme}. Only http and https are allowed.`
        };
      }

      // Проверка whitelist доменов (если настроен)
      if (this.ALLOWED_DOMAINS && this.ALLOWED_DOMAINS.length > 0) {
        const hostname = parsedUrl.hostname.toLowerCase();
        const isAllowed = this.ALLOWED_DOMAINS.some(
          allowed => hostname === allowed || hostname.endsWith(`.${allowed}`)
        );

        if (!isAllowed) {
          logger.warn('URL validation failed: domain not in whitelist', {
            url: trimmedUrl,
            hostname,
            allowedDomains: this.ALLOWED_DOMAINS
          });
          return {
            isValid: false,
            error: `Domain ${hostname} is not in the allowed domains whitelist.`
          };
        }
      }

      // Если разрешены private IP, пропускаем дальнейшие проверки
      if (allowPrivateIPs) {
        return {
          isValid: true,
          sanitizedUrl: parsedUrl.toString()
        };
      }

      // Проверка на localhost и loopback
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0'
      ) {
        logger.warn('SSRF attempt detected: localhost/loopback', { url: trimmedUrl, hostname });
        return {
          isValid: false,
          error: 'Requests to localhost and loopback addresses are not allowed.'
        };
      }

      // Проверка на private IP ranges
      for (const pattern of this.PRIVATE_IP_RANGES) {
        if (pattern.test(hostname)) {
          logger.warn('SSRF attempt detected: private IP range', { url: trimmedUrl, hostname });
          return {
            isValid: false,
            error: 'Requests to private IP addresses are not allowed.'
          };
        }
      }

      // Проверка на IP адрес в числовом формате (IPv4)
      const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Pattern.test(hostname)) {
        const parts = hostname.split('.').map(Number);
        const isValidIPv4 =
          parts.length === 4 && parts.every(part => part >= 0 && part <= 255);

        if (isValidIPv4) {
          // Проверяем на private IP
          const [a, b] = parts;
          if (
            a === 10 || // 10.0.0.0/8
            (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
            (a === 192 && b === 168) || // 192.168.0.0/16
            (a === 127) || // 127.0.0.0/8
            (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
            (a === 0) || // 0.0.0.0
            hostname.startsWith('127.') ||
            hostname === 'localhost'
          ) {
            logger.warn('SSRF attempt detected: private IPv4', { url: trimmedUrl, hostname });
            return {
              isValid: false,
              error: 'Requests to private IP addresses are not allowed.'
            };
          }
        }
      }

      // Проверка на IPv6
      if (hostname.includes(':')) {
        // IPv6 адреса могут содержать private ranges
        if (
          hostname.startsWith('fc00:') ||
          hostname.startsWith('fe80:') ||
          hostname === '::1' ||
          hostname === '::'
        ) {
          logger.warn('SSRF attempt detected: private IPv6', { url: trimmedUrl, hostname });
          return {
            isValid: false,
            error: 'Requests to private IPv6 addresses are not allowed.'
          };
        }
      }

      // Проверка длины URL (защита от чрезмерно длинных URL)
      const maxUrlLength = 2048; // Стандартный максимум для большинства браузеров
      if (parsedUrl.toString().length > maxUrlLength) {
        return {
          isValid: false,
          error: `URL exceeds maximum length of ${maxUrlLength} characters.`
        };
      }

      // Все проверки пройдены
      return {
        isValid: true,
        sanitizedUrl: parsedUrl.toString()
      };
    } catch (error) {
      logger.error('URL validation error', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isValid: false,
        error: `URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Санитизирует URL (нормализует и проверяет)
   * @param url URL для санитизации
   * @returns Санитизированный URL или null если невалидный
   */
  static sanitize(url: string): string | null {
    const result = this.validate(url);
    return result.isValid ? result.sanitizedUrl || url : null;
  }

  /**
   * Проверяет, является ли URL безопасным для внешних запросов
   * @param url URL для проверки
   * @returns true если URL безопасен
   */
  static isSafe(url: string): boolean {
    return this.validate(url).isValid;
  }
}
