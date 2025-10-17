/**
 * @file: scripts/test-domain-parsing.ts
 * @description: Скрипт для тестирования парсинга доменов
 * @project: SaaS Bonus System
 * @dependencies: ProjectService
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

import { logger } from '../src/lib/logger';

// Копируем логику нормализации домена для тестирования
function normalizeDomain(domain?: string): string | undefined {
  if (!domain || domain.trim() === '') {
    return undefined;
  }

  let normalized = domain.trim().toLowerCase();

  // Убираем протокол если есть
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Убираем www если есть
  normalized = normalized.replace(/^www\./, '');
  
  // Убираем завершающий слеш
  normalized = normalized.replace(/\/$/, '');
  
  // Убираем путь если есть (оставляем только домен)
  normalized = normalized.split('/')[0];
  
  // Проверяем, что это валидный домен
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(normalized)) {
    logger.warn('Некорректный формат домена', {
      original: domain,
      normalized,
      component: 'domain-parsing-test'
    });
    return undefined;
  }

  logger.info('Домен нормализован', {
    original: domain,
    normalized,
    component: 'domain-parsing-test'
  });

  return normalized;
}

function testDomainParsing() {
  console.log('🔍 ТЕСТИРОВАНИЕ ПАРСИНГА ДОМЕНОВ');
  console.log('=' .repeat(50));

  const testDomains = [
    'maoka.ru',
    'https://maoka.ru/',
    'http://www.maoka.ru/path',
    'MAOKA.RU',
    'https://www.maoka.ru/some/path/',
    'maoka.ru/',
    'www.maoka.ru',
    'https://maoka.ru',
    'http://maoka.ru',
    'maoka.ru/path/to/page',
    'invalid-domain',
    'not-a-domain',
    '',
    '   ',
    'https://',
    'http://',
    'example.com',
    'subdomain.example.com',
    'very-long-domain-name-that-should-still-work.example.com'
  ];

  testDomains.forEach((domain, index) => {
    console.log(`${index + 1}. Исходный: '${domain}'`);
    const result = normalizeDomain(domain);
    console.log(`   Результат: '${result}'`);
    console.log('');
  });

  console.log('✅ Тестирование завершено');
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  testDomainParsing();
}

export { testDomainParsing, normalizeDomain };
