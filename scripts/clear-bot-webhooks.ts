/**
 * @file: scripts/clear-bot-webhooks.ts
 * @description: Принудительная очистка webhook для всех ботов
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Prisma
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { Bot } from 'grammy';
import { db } from '../src/lib/db';
import { logger } from '../src/lib/logger';

async function clearBotWebhooks() {
  console.log('🧹 Очистка webhook для всех ботов...\n');

  try {
    // Получаем все проекты с настройками ботов
    const projects = await db.project.findMany({
      include: {
        botSettings: true
      }
    });

    for (const project of projects) {
      if (!project.botSettings?.botToken) {
        continue;
      }

      console.log(`📋 Проект: ${project.name} (${project.id})`);
      console.log(`   Токен: ***${project.botSettings.botToken.slice(-4)}`);

      try {
        // Создаем временный бот для очистки webhook
        const tempBot = new Bot(project.botSettings.botToken);
        
        // Получаем информацию о webhook
        const webhookInfo = await tempBot.api.getWebhookInfo();
        
        if (webhookInfo.url) {
          console.log(`   ⚠️  Найден webhook: ${webhookInfo.url}`);
          
          // Удаляем webhook
          await tempBot.api.deleteWebhook({ drop_pending_updates: true });
          console.log(`   ✅ Webhook удален`);
          
          // Проверяем, что webhook удален
          const newWebhookInfo = await tempBot.api.getWebhookInfo();
          if (!newWebhookInfo.url) {
            console.log(`   ✅ Подтверждено: webhook удален`);
          } else {
            console.log(`   ❌ Ошибка: webhook все еще активен`);
          }
        } else {
          console.log(`   ✅ Webhook не установлен`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Ошибка: ${errorMessage}`);
      }

      console.log('');
    }

    console.log('🎉 Очистка webhook завершена!');
    console.log('💡 Теперь можно перезапустить сервер и попробовать запустить бота');

  } catch (error) {
    console.error('❌ Ошибка очистки webhook:', error);
  }
}

// Запуск очистки
clearBotWebhooks().catch(console.error);
