/**
 * @file: scripts/debug-bot-status.ts
 * @description: Скрипт для отладки состояния ботов
 * @project: SaaS Bonus System
 * @dependencies: botManager, db
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

import { botManager } from '../src/lib/telegram/bot-manager';
import { db } from '../src/lib/db';
import { logger } from '../src/lib/logger';

async function debugBotStatus() {
  console.log('🔍 ОТЛАДКА СОСТОЯНИЯ БОТОВ');
  console.log('='.repeat(50));

  try {
    // 1. Состояние BotManager
    console.log('\n📊 СОСТОЯНИЕ BOT MANAGER:');
    const botEntries = botManager.getAllBots();
    console.log(`Всего ботов в менеджере: ${botEntries.length}`);

    botEntries.forEach(([projectId, botInstance]) => {
      const grammyBot = botInstance.bot as any;
      const botInfo = grammyBot?.botInfo as { username?: string } | undefined;
      const tokenPreview =
        typeof grammyBot?.token === 'string'
          ? grammyBot.token.slice(-4)
          : 'N/A';
      console.log(`  - Проект: ${projectId}`);
      console.log(`    Токен: ***${tokenPreview}`);
      console.log(`    Активен: ${botInstance.isActive}`);
      console.log(`    Polling: ${botInstance.isPolling}`);
      console.log(`    Username: ${botInfo?.username || 'N/A'}`);
      console.log(`    Последнее обновление: ${botInstance.lastUpdated}`);
      console.log('');
    });

    // 2. Состояние в базе данных
    console.log('\n🗄️ СОСТОЯНИЕ В БАЗЕ ДАННЫХ:');
    const projects = await db.project.findMany({
      where: {
        botToken: { not: null }
      },
      select: {
        id: true,
        name: true,
        botToken: true,
        botUsername: true,
        botStatus: true,
        botSettings: {
          select: {
            botToken: true,
            botUsername: true,
            isActive: true
          }
        }
      }
    });

    projects.forEach((project) => {
      console.log(`  - Проект: ${project.name} (${project.id})`);
      console.log(
        `    Токен в проекте: ***${project.botToken?.slice(-4) || 'N/A'}***`
      );
      console.log(
        `    Токен в настройках: ***${project.botSettings?.botToken?.slice(-4) || 'N/A'}***`
      );
      console.log(`    Username: ${project.botUsername || 'N/A'}`);
      console.log(`    Статус: ${project.botStatus}`);
      console.log(`    Активен в настройках: ${project.botSettings?.isActive}`);
      console.log('');
    });

    // 3. Поиск дублирующихся токенов
    console.log('\n🔍 ПОИСК ДУБЛИРУЮЩИХСЯ ТОКЕНОВ:');
    const tokenMap = new Map<string, string[]>();

    botEntries.forEach(([projectId, botInstance]) => {
      const token = (botInstance.bot as any)?.token;
      if (!token) return;
      if (!tokenMap.has(token)) {
        tokenMap.set(token, []);
      }
      tokenMap.get(token)!.push(projectId);
    });

    tokenMap.forEach((projectIds, token) => {
      if (projectIds.length > 1) {
        console.log(
          `  ⚠️ Токен ***${token.slice(-4)} используется в проектах: ${projectIds.join(', ')}`
        );
      }
    });

    if (tokenMap.size === 0) {
      console.log('  ✅ Дублирующихся токенов не найдено');
    }

    // 4. Проверка состояния Telegram API
    console.log('\n🌐 ПРОВЕРКА TELEGRAM API:');
    for (const [projectId, botInstance] of botEntries) {
      try {
        const botInfo = await botInstance.bot.api.getMe();
        console.log(
          `  ✅ Проект ${projectId}: @${botInfo.username} (ID: ${botInfo.id})`
        );
      } catch (error) {
        console.log(
          `  ❌ Проект ${projectId}: Ошибка API - ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }
  } catch (error) {
    console.error('❌ Ошибка отладки:', error);
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  debugBotStatus()
    .then(() => {
      console.log('\n✅ Отладка завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

export { debugBotStatus };
