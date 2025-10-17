/**
 * @file: scripts/check-local-development.ts
 * @description: Скрипт для проверки настроек локальной разработки
 * @project: SaaS Bonus System
 * @dependencies: Bot, logger
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

import { Bot } from 'grammy';
import { logger } from '../src/lib/logger';

async function checkLocalDevelopment() {
  console.log('🏠 ПРОВЕРКА НАСТРОЕК ЛОКАЛЬНОЙ РАЗРАБОТКИ');
  console.log('=' .repeat(60));

  // 1. Проверка переменных окружения
  console.log('\n📋 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'не установлен'}`);
  console.log(`APP_URL: ${process.env.APP_URL || 'не установлен'}`);
  
  const isLocalDev = process.env.NODE_ENV === 'development';
  console.log(`Режим разработки: ${isLocalDev ? '✅ Локальная разработка' : '❌ Продакшен'}`);

  // 2. Проверка URL
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5006';
  const isHttps = webhookUrl.startsWith('https://');
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`HTTPS: ${isHttps ? '✅ Да' : '❌ Нет'}`);
  console.log(`Режим работы: ${isLocalDev ? 'Polling (локальная разработка)' : isHttps ? 'Webhook (продакшен)' : 'Polling (нет HTTPS)'}`);

  // 3. Проверка процессов Node.js
  console.log('\n🔍 ПРОЦЕССЫ NODE.JS:');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('ps aux | grep node | grep -v grep');
    const processes = stdout.trim().split('\n').filter(line => line.trim());
    
    if (processes.length === 0) {
      console.log('✅ Процессы Node.js не найдены');
    } else {
      console.log(`Найдено процессов: ${processes.length}`);
      processes.forEach((process, index) => {
        console.log(`  ${index + 1}. ${process.trim()}`);
      });
    }
  } catch (error) {
    console.log('❌ Ошибка проверки процессов:', error instanceof Error ? error.message : 'Unknown');
  }

  // 4. Проверка портов
  console.log('\n🌐 ПРОВЕРКА ПОРТОВ:');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const ports = ['3000', '5006', '8080'];
    
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(`netstat -tulpn | grep :${port}`);
        if (stdout.trim()) {
          console.log(`Порт ${port}: ❌ Занят`);
          console.log(`  ${stdout.trim()}`);
        } else {
          console.log(`Порт ${port}: ✅ Свободен`);
        }
      } catch {
        console.log(`Порт ${port}: ✅ Свободен`);
      }
    }
  } catch (error) {
    console.log('❌ Ошибка проверки портов:', error instanceof Error ? error.message : 'Unknown');
  }

  // 5. Рекомендации
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  
  if (!isLocalDev) {
    console.log('⚠️  NODE_ENV не установлен в development');
    console.log('   Установите: export NODE_ENV=development');
  }
  
  if (!isHttps && !isLocalDev) {
    console.log('⚠️  Нет HTTPS для webhook режима');
    console.log('   Для продакшена нужен HTTPS или используйте polling');
  }
  
  if (isLocalDev) {
    console.log('✅ Локальная разработка настроена правильно');
    console.log('   Будет использоваться polling режим');
    console.log('   Webhook будет автоматически отключен');
  }

  // 6. Проверка токена бота (если передан)
  const token = process.argv[2];
  if (token) {
    console.log('\n🤖 ПРОВЕРКА БОТА:');
    try {
      const bot = new Bot(token);
      const botInfo = await bot.api.getMe();
      
      console.log(`✅ Бот подключен: @${botInfo.username}`);
      console.log(`   ID: ${botInfo.id}`);
      console.log(`   Имя: ${botInfo.first_name}`);
      
      // Проверка webhook
      try {
        const webhookInfo = await bot.api.getWebhookInfo();
        if (webhookInfo.url) {
          console.log(`⚠️  Webhook установлен: ${webhookInfo.url}`);
          console.log('   В локальной разработке это может вызвать конфликты');
          
          if (isLocalDev) {
            console.log('   Рекомендуется удалить webhook для локальной разработки');
            try {
              await bot.api.deleteWebhook({ drop_pending_updates: true });
              console.log('   ✅ Webhook удален');
            } catch (error) {
              console.log('   ❌ Ошибка удаления webhook:', error instanceof Error ? error.message : 'Unknown');
            }
          }
        } else {
          console.log('✅ Webhook не установлен - можно использовать polling');
        }
      } catch (error) {
        console.log('❌ Ошибка проверки webhook:', error instanceof Error ? error.message : 'Unknown');
      }
      
    } catch (error) {
      console.log('❌ Ошибка подключения к боту:', error instanceof Error ? error.message : 'Unknown');
      
      if (error instanceof Error && error.message.includes('409')) {
        console.log('🚨 ОБНАРУЖЕН 409 КОНФЛИКТ!');
        console.log('   Другой экземпляр бота уже запущен');
        console.log('   Решение: остановите все другие экземпляры');
      }
    }
  } else {
    console.log('\n💡 Для проверки бота запустите:');
    console.log('   npx tsx scripts/check-local-development.ts <BOT_TOKEN>');
  }

  console.log('\n✅ Проверка завершена');
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  checkLocalDevelopment()
    .then(() => {
      console.log('\n🎉 Проверка завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

export { checkLocalDevelopment };
