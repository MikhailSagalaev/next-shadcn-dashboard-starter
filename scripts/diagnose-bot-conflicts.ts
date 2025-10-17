/**
 * @file: scripts/diagnose-bot-conflicts.ts
 * @description: Диагностика конфликтов Telegram ботов
 * @project: SaaS Bonus System
 * @dependencies: Grammy, Prisma
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

import { Bot } from 'grammy';
import { db } from '../src/lib/db';
import { logger } from '../src/lib/logger';

interface BotConflictInfo {
  projectId: string;
  botToken: string;
  botUsername: string;
  isActive: boolean;
  webhookInfo?: any;
  error?: string;
}

async function diagnoseBotConflicts() {
  console.log('🔍 Диагностика конфликтов Telegram ботов...\n');

  try {
    // Получаем все проекты с настройками ботов
    const projects = await db.project.findMany({
      include: {
        botSettings: true
      }
    });

    const botConflicts: BotConflictInfo[] = [];

    for (const project of projects) {
      if (!project.botSettings?.botToken) {
        continue;
      }

      console.log(`📋 Проект: ${project.name} (${project.id})`);
      console.log(`   Токен: ***${project.botSettings.botToken.slice(-4)}`);
      console.log(`   Username: ${project.botSettings.botUsername || 'не указан'}`);
      console.log(`   Активен: ${project.botSettings.isActive ? 'да' : 'нет'}`);

      try {
        // Создаем временный бот для проверки
        const tempBot = new Bot(project.botSettings.botToken);
        
        // Получаем информацию о webhook
        const webhookInfo = await tempBot.api.getWebhookInfo();
        
        console.log(`   Webhook URL: ${webhookInfo.url || 'не установлен'}`);
        console.log(`   Pending updates: ${webhookInfo.pending_update_count || 0}`);
        
        if (webhookInfo.url) {
          console.log(`   ⚠️  Webhook активен - может конфликтовать с polling`);
        }

        botConflicts.push({
          projectId: project.id,
          botToken: project.botSettings.botToken,
          botUsername: project.botSettings.botUsername || '',
          isActive: project.botSettings.isActive,
          webhookInfo
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Ошибка: ${errorMessage}`);
        
        botConflicts.push({
          projectId: project.id,
          botToken: project.botSettings.botToken,
          botUsername: project.botSettings.botUsername || '',
          isActive: project.botSettings.isActive,
          error: errorMessage
        });
      }

      console.log('');
    }

    // Анализ конфликтов
    console.log('📊 Анализ конфликтов:');
    
    const activeBots = botConflicts.filter(bot => bot.isActive);
    const botsWithWebhooks = botConflicts.filter(bot => bot.webhookInfo?.url);
    const botsWithErrors = botConflicts.filter(bot => bot.error);

    console.log(`   Всего ботов: ${botConflicts.length}`);
    console.log(`   Активных ботов: ${activeBots.length}`);
    console.log(`   Ботов с webhook: ${botsWithWebhooks.length}`);
    console.log(`   Ботов с ошибками: ${botsWithErrors.length}`);

    if (botsWithWebhooks.length > 0) {
      console.log('\n⚠️  Боты с активными webhook:');
      botsWithWebhooks.forEach(bot => {
        console.log(`   - ${bot.projectId}: ${bot.webhookInfo?.url}`);
      });
    }

    if (botsWithErrors.length > 0) {
      console.log('\n❌ Боты с ошибками:');
      botsWithErrors.forEach(bot => {
        console.log(`   - ${bot.projectId}: ${bot.error}`);
      });
    }

    // Рекомендации
    console.log('\n💡 Рекомендации:');
    
    if (botsWithWebhooks.length > 0) {
      console.log('   1. Удалите webhook для всех ботов в dev режиме:');
      botsWithWebhooks.forEach(bot => {
        console.log(`      curl -X POST "https://api.telegram.org/bot${bot.botToken}/deleteWebhook"`);
      });
    }

    if (botsWithErrors.length > 0) {
      console.log('   2. Проверьте токены ботов на валидность');
    }

    console.log('   3. Убедитесь, что не запущены другие экземпляры ботов');
    console.log('   4. Перезапустите сервер после очистки webhook');

  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
  }
}

// Запуск диагностики
diagnoseBotConflicts().catch(console.error);
