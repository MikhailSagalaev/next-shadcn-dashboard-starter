/**
 * @file: src/lib/client-logger.ts
 * @description: Клиентский логгер для отправки логов в SystemLog через API
 * @project: SaaS Bonus System
 * @dependencies: none (client-side only)
 * @created: 2025-01-30
 * @author: AI Assistant
 */

'use client';

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  source: string;
  context?: Record<string, any>;
  projectId?: string;
  userId?: string;
  stack?: string;
  timestamp: number;
}

class ClientLogger {
  private logBuffer: LogEntry[] = [];
  private bufferSize = 10; // Максимальное количество логов в буфере
  private flushInterval = 5000; // Интервал отправки (5 секунд)
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    if (typeof window === 'undefined') {
      return; // Не выполняем на сервере
    }

    this.init();
  }

  private init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Обработка uncaught exceptions
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      }, event.error?.stack);
    });

    // Обработка unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        error: event.reason instanceof Error ? event.reason.message : String(event.reason)
      }, event.reason instanceof Error ? event.reason.stack : undefined);
    });

    // Запускаем периодическую отправку буфера
    this.startFlushTimer();
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async sendLog(log: LogEntry): Promise<void> {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level: log.level,
          message: log.message,
          source: log.source,
          context: log.context,
          projectId: log.projectId,
          userId: log.userId,
          stack: log.stack
        })
      });

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.status);
      }
    } catch (error) {
      // Не логируем ошибки отправки логов в консоль, чтобы избежать циклов
      console.warn('Error sending log to server:', error);
    }
  }

  private addToBuffer(log: LogEntry) {
    this.logBuffer.push(log);

    // Если буфер переполнен, отправляем все логи немедленно
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    // Отправляем логи параллельно
    await Promise.allSettled(
      logsToSend.map(log => this.sendLog(log))
    );
  }

  private log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    context?: Record<string, any>,
    stack?: string,
    source: string = 'client'
  ) {
    // В development также логируем в консоль
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = console[level] || console.log;
      consoleMethod(`[${source}] ${message}`, context || '');
    }

    // Получаем projectId и userId из localStorage или cookies (если доступны)
    let projectId: string | undefined;
    let userId: string | undefined;

    try {
      // Попытка получить из cookies
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        projectId = cookies['project_id'];
        userId = cookies['user_id'];
      }
    } catch (e) {
      // Игнорируем ошибки доступа к cookies
    }

    const logEntry: LogEntry = {
      level,
      message,
      source,
      context,
      projectId,
      userId,
      stack,
      timestamp: Date.now()
    };

    this.addToBuffer(logEntry);

    // Критические ошибки отправляем немедленно
    if (level === 'error') {
      this.sendLog(logEntry);
    }
  }

  error(message: string, context?: Record<string, any>, stack?: string, source?: string) {
    this.log('error', message, context, stack, source);
  }

  warn(message: string, context?: Record<string, any>, source?: string) {
    this.log('warn', message, context, undefined, source);
  }

  info(message: string, context?: Record<string, any>, source?: string) {
    this.log('info', message, context, undefined, source);
  }

  debug(message: string, context?: Record<string, any>, source?: string) {
    this.log('debug', message, context, undefined, source);
  }

  // Метод для принудительной отправки всех логов из буфера
  async flushAll() {
    await this.flush();
  }

  // Очистка при размонтировании
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Отправляем оставшиеся логи
  }
}

// Создаем единственный экземпляр логгера
export const clientLogger = new ClientLogger();

// Экспортируем методы для удобства
export const logError = (message: string, context?: Record<string, any>, stack?: string) => {
  clientLogger.error(message, context, stack);
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  clientLogger.warn(message, context);
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  clientLogger.info(message, context);
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  clientLogger.debug(message, context);
};
