/**
 * @file: scripts/test-telegram-proxy.ts
 * @description: Тестирование подключения к Telegram через прокси и диагностика DNS
 */

import 'dotenv/config';
import { Bot } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as dns from 'node:dns/promises';
import { logger } from '../src/lib/logger';

async function testTelegramProxy() {
  const token = process.env.TEST_BOT_TOKEN || process.argv[2];
  const proxyUrl = process.env.TELEGRAM_PROXY_URL || process.argv[3];

  console.log('🔍 ДИАГНОСТИКА ПОДКЛЮЧЕНИЯ TELEGRAM');
  console.log('='.repeat(50));
  console.log(`Node.js version: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(
    `Proxy URL: ${proxyUrl ? 'УСТАНОВЛЕН (скрыто)' : 'НЕ УСТАНОВЛЕН'}`
  );

  // 1. DNS Тест
  console.log('\n[1/3] 📡 Проверка DNS...');
  try {
    const startTime = Date.now();
    const addresses = await dns.resolve4('api.telegram.org');
    const duration = Date.now() - startTime;
    console.log(`✅ DNS разрешен: ${addresses.join(', ')} (${duration}ms)`);
  } catch (error) {
    console.error(`❌ DNS ОШИБКА: ${(error as Error).message}`);
    console.log('Это может означать блокировку на уровне DNS провайдером.');
  }

  // 2. Тест прямого подключения
  console.log('\n[2/3] 🔌 Тест прямого подключения (без прокси)...');
  try {
    const bot = new Bot(token || 'dummy_token');
    const startTime = Date.now();
    await bot.api.getMe();
    console.log(
      `✅ Прямое подключение работает! (${Date.now() - startTime}ms)`
    );
  } catch (error) {
    console.log(
      `❌ Прямое подключение не удалось: ${(error as Error).message}`
    );
    console.log('Это ожидаемо, если Telegram заблокирован в вашем регионе.');
  }

  // 3. Тест через прокси
  if (proxyUrl) {
    console.log(`\n[3/3] 🛡️ Тест подключения через прокси...`);
    try {
      const agent = new HttpsProxyAgent(proxyUrl);
      const bot = new Bot(token!, {
        client: {
          baseFetchConfig: {
            agent,
            compress: true
          }
        }
      });

      const startTime = Date.now();
      const botInfo = await bot.api.getMe();
      console.log(`✅ ПОДКЛЮЧЕНИЕ ЧЕРЕЗ ПРОКСИ УСПЕШНО!`);
      console.log(`   Бот: @${botInfo.username}`);
      console.log(`   Время отклика: ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`❌ ОШИБКА ПРОКСИ: ${(error as Error).message}`);
      if ((error as Error).message.includes('407')) {
        console.log(
          'Ошибка 407: Требуется авторизация в прокси (неверный логин/пароль).'
        );
      } else if ((error as Error).message.includes('ETIMEDOUT')) {
        console.log(
          'Ошибка ETIMEDOUT: Прокси сервер не отвечает или слишком медленный.'
        );
      } else if ((error as Error).message.includes('ECONNREFUSED')) {
        console.log('Ошибка ECONNREFUSED: Прокси сервер отклонил соединение.');
      }
    }
  } else {
    console.log(
      '\n[3/3] 🛡️ Тест прокси пропущен (TELEGRAM_PROXY_URL не задан).'
    );
  }
}

if (!process.env.TEST_BOT_TOKEN && !process.argv[2]) {
  console.log('\nИспользование:');
  console.log('npx tsx scripts/test-telegram-proxy.ts <TOKEN> <PROXY_URL>');
  console.log('Или задайте TEST_BOT_TOKEN и TELEGRAM_PROXY_URL в .env');
} else {
  testTelegramProxy().catch(console.error);
}
