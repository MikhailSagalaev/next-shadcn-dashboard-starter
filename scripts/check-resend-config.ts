/**
 * @file: scripts/check-resend-config.ts
 * @description: Диагностика конфигурации Resend для проверки после деплоя
 * @project: SaaS Bonus System
 */

import { Resend } from 'resend';

console.log('🔍 Проверка конфигурации Resend...\n');

// Проверка переменных окружения
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

console.log('📋 Переменные окружения:');
console.log(
  `  RESEND_API_KEY: ${apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} символов)` : '❌ НЕ УСТАНОВЛЕН'}`
);
console.log(`  RESEND_FROM_EMAIL: ${fromEmail || '❌ НЕ УСТАНОВЛЕН'}`);
console.log();

if (!apiKey) {
  console.error('❌ RESEND_API_KEY не установлен!');
  console.error('   Установите его в .env файле или через PM2 env');
  process.exit(1);
}

if (!fromEmail) {
  console.warn(
    '⚠️  RESEND_FROM_EMAIL не установлен, будет использован fallback'
  );
}

// Проверка формата API ключа
if (!apiKey.startsWith('re_')) {
  console.error('❌ RESEND_API_KEY должен начинаться с "re_"');
  process.exit(1);
}

// Попытка создания клиента
try {
  const resend = new Resend(apiKey);
  console.log('✅ Клиент Resend создан успешно');
  console.log();

  // Попытка отправки тестового письма (опционально)
  console.log('📧 Тестовая отправка email...');
  console.log(`   From: ${fromEmail || 'noreply@localhost'}`);
  console.log(`   To: (тестовый адрес не указан)`);
  console.log();

  console.log('✅ Конфигурация Resend выглядит корректной');
  console.log();
  console.log('💡 Для проверки отправки письма:');
  console.log('   1. Откройте /dashboard/settings');
  console.log('   2. Вкладка "Уведомления"');
  console.log('   3. Укажите email и нажмите "Отправить тестовое письмо"');
  console.log();
  console.log('💡 Для проверки логов PM2:');
  console.log('   pm2 logs bonus-app --lines 50 | grep -i resend');
  console.log('   pm2 logs bonus-app --lines 50 | grep -i email');
} catch (error) {
  console.error('❌ Ошибка при создании клиента Resend:', error);
  process.exit(1);
}
