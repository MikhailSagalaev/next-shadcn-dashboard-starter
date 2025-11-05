export async function register() {
  // Инициализация серверных компонентов Next.js
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    // Инициализация DelayJobService для workflow delays через Bull queue
    try {
      const { DelayJobService } = await import('@/lib/services/workflow/delay-job.service');
      DelayJobService.initialize();
      console.log('✅ DelayJobService initialized');
    } catch (error) {
      console.error('Failed to initialize DelayJobService:', error);
    }

    // Graceful shutdown для DelayJobService
    if (typeof process !== 'undefined') {
      const shutdown = async (signal: string) => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        try {
          const { DelayJobService } = await import('@/lib/services/workflow/delay-job.service');
          await DelayJobService.shutdown();
          console.log('✅ DelayJobService shutdown complete');
        } catch (error) {
          console.error('Error during DelayJobService shutdown:', error);
        }
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }

    // Временно отключаем инициализацию Telegram ботов для быстрого запуска
    /*
    // Динамический импорт для избежания проблем с crypto
    try {
      const { startupBots } = await import('@/lib/telegram/startup');
      startupBots();
    } catch (error) {
      console.error('Failed to initialize bots:', error);
    }
    */
  }
}
