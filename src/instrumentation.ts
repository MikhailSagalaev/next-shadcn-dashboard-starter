export async function register() {
  // Инициализация серверных компонентов Next.js
  // Временно отключаем инициализацию Telegram ботов для быстрого запуска
  /*
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    // Динамический импорт для избежания проблем с crypto
    try {
      const { startupBots } = await import('@/lib/telegram/startup');
      startupBots();
    } catch (error) {
      console.error('Failed to initialize bots:', error);
    }
  }
  */
}
