/**
 * @file: scripts/test-bot-connection.ts
 * @description: Скрипт для тестирования подключения бота
 * @project: SaaS Bonus System
 * @dependencies: Bot, logger
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

import { Bot } from 'grammy';
import { logger } from '../src/lib/logger';

async function testBotConnection(token: string) {
  console.log('🤖 ТЕСТИРОВАНИЕ ПОДКЛЮЧЕНИЯ БОТА');
  console.log('=' .repeat(50));

  try {
    // Создаем экземпляр бота
    const bot = new Bot(token);
    
    console.log('\n📡 Проверка подключения к Telegram API...');
    
    // Получаем информацию о боте
    const botInfo = await bot.api.getMe();
    
    console.log('✅ Бот успешно подключен!');
    console.log(`   ID: ${botInfo.id}`);
    console.log(`   Username: @${botInfo.username}`);
    console.log(`   First Name: ${botInfo.first_name}`);
    console.log(`   Can Join Groups: ${botInfo.can_join_groups}`);
    console.log(`   Can Read All Group Messages: ${botInfo.can_read_all_group_messages}`);
    console.log(`   Supports Inline Queries: ${botInfo.supports_inline_queries}`);
    
    // Проверяем webhook
    console.log('\n🔗 Проверка webhook...');
    try {
      const webhookInfo = await bot.api.getWebhookInfo();
      console.log(`   URL: ${webhookInfo.url || 'Не установлен'}`);
      console.log(`   Has Custom Certificate: ${webhookInfo.has_custom_certificate}`);
      console.log(`   Pending Update Count: ${webhookInfo.pending_update_count}`);
      
      if (webhookInfo.url) {
        console.log('⚠️  Webhook установлен - это может конфликтовать с polling');
      } else {
        console.log('✅ Webhook не установлен - можно использовать polling');
      }
    } catch (webhookError) {
      console.log(`❌ Ошибка получения webhook: ${webhookError instanceof Error ? webhookError.message : 'Unknown'}`);
    }
    
    // Проверяем обновления
    console.log('\n📨 Проверка обновлений...');
    try {
      const updates = await bot.api.getUpdates({ limit: 1 });
      console.log(`   Получено обновлений: ${updates.length}`);
      if (updates.length > 0) {
        console.log(`   Последнее обновление ID: ${updates[0].update_id}`);
      }
    } catch (updatesError) {
      console.log(`❌ Ошибка получения обновлений: ${updatesError instanceof Error ? updatesError.message : 'Unknown'}`);
      
      if (updatesError instanceof Error && updatesError.message.includes('409')) {
        console.log('🚨 ОБНАРУЖЕН 409 КОНФЛИКТ!');
        console.log('   Это означает, что другой экземпляр бота уже получает обновления');
        console.log('   Решение: остановите все другие экземпляры бота');
      }
    }
    
    console.log('\n✅ Тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка подключения к боту:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        console.log('🔑 Ошибка: Неверный токен бота');
        console.log('   Проверьте правильность токена');
      } else if (error.message.includes('Bad Request')) {
        console.log('📝 Ошибка: Неверный формат запроса');
        console.log('   Проверьте формат токена');
      } else if (error.message.includes('409')) {
        console.log('🚨 ОБНАРУЖЕН 409 КОНФЛИКТ!');
        console.log('   Другой экземпляр бота уже запущен');
        console.log('   Решение: остановите все другие экземпляры');
      }
    }
    
    process.exit(1);
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  const token = process.argv[2];
  
  if (!token) {
    console.error('❌ Использование: npx tsx scripts/test-bot-connection.ts <BOT_TOKEN>');
    console.log('Пример: npx tsx scripts/test-bot-connection.ts 7739551433:AAEkg4ogMW6g-IBMV4oxvHQ7rmP4jNlbClw');
    process.exit(1);
  }
  
  testBotConnection(token)
    .then(() => {
      console.log('\n🎉 Тестирование завершено');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

export { testBotConnection };
