/**
 * @file: src/lib/services/bot-analytics/bot-analytics.service.ts
 * @description: Сервис аналитики для потоков бота
 * @project: SaaS Bonus System
 * @dependencies: Prisma, PerformanceMonitor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { logger } from '@/lib/logger';
import { PerformanceMonitor } from '../bot-flow-executor/performance-monitor';
import { BotFlowService } from '../bot-flow.service';

export interface FlowExecutionEvent {
  id: string;
  flowId: string;
  userId: string;
  sessionId: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  errorMessage?: string;
  nodeCount: number;
  completedNodes: number;
  userInteractions: number;
  apiCalls: number;
  externalRequests: number;
  memoryUsage?: number;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

export interface FlowAnalyticsMetrics {
  // Общие метрики
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  successRate: number;

  // Метрики производительности
  averageMemoryUsage: number;
  averageApiCalls: number;
  averageExternalRequests: number;
  averageUserInteractions: number;

  // Метрики по времени
  executionsByHour: Array<{ hour: number; count: number }>;
  executionsByDay: Array<{ date: string; count: number }>;
  executionsByWeekday: Array<{ weekday: number; count: number }>;

  // Метрики по пользователям
  uniqueUsers: number;
  returningUsers: number;
  userRetentionRate: number;
  topUsers: Array<{ userId: string; executions: number; lastExecution: Date }>;

  // Метрики по географии
  topCountries: Array<{ country: string; count: number; percentage: number }>;
  topCities: Array<{ city: string; count: number; percentage: number }>;

  // Метрики по нодам
  nodePerformance: Array<{
    nodeId: string;
    nodeType: string;
    averageDuration: number;
    successRate: number;
    executionCount: number;
    errorCount: number;
  }>;

  // Метрики ошибок
  errorRate: number;
  topErrors: Array<{ error: string; count: number; percentage: number }>;
  errorTrends: Array<{ date: string; errorCount: number; totalCount: number }>;

  // Метрики вовлеченности
  averageSessionLength: number;
  dropOffPoints: Array<{ nodeId: string; dropOffRate: number }>;
  completionFunnel: Array<{
    step: string;
    users: number;
    conversionRate: number;
  }>;

  // Метрики A/B тестирования
  abTestResults?: {
    testId: string;
    variantA: {
      executions: number;
      successRate: number;
      averageDuration: number;
    };
    variantB: {
      executions: number;
      successRate: number;
      averageDuration: number;
    };
    winner: 'A' | 'B' | 'tie';
    confidence: number;
  };
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export class BotAnalyticsService {
  private static instance: BotAnalyticsService;
  private performanceMonitor: PerformanceMonitor;
  private eventBuffer: FlowExecutionEvent[] = [];
  private bufferSize = 100;
  private flushInterval: NodeJS.Timeout;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();

    // Автоматическая отправка событий каждые 30 секунд
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 30000);
  }

  static getInstance(): BotAnalyticsService {
    if (!BotAnalyticsService.instance) {
      BotAnalyticsService.instance = new BotAnalyticsService();
    }
    return BotAnalyticsService.instance;
  }

  /**
   * Запись события выполнения потока
   */
  async recordFlowExecution(event: FlowExecutionEvent): Promise<void> {
    try {
      // Добавляем в буфер
      this.eventBuffer.push(event);

      // Если буфер полон, отправляем
      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushEvents();
      }

      logger.debug('Flow execution event recorded', {
        flowId: event.flowId,
        userId: event.userId,
        status: event.status,
        duration: event.duration
      });
    } catch (error) {
      logger.error('Failed to record flow execution event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id
      });
    }
  }

  /**
   * Получение метрик аналитики для потока
   */
  async getFlowAnalytics(
    flowId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<FlowAnalyticsMetrics> {
    try {
      // Получаем события из базы данных
      const events = await this.getFlowEvents(flowId, timeRange);

      if (events.length === 0) {
        return this.getEmptyMetrics();
      }

      // Вычисляем метрики
      const metrics = this.calculateMetrics(events, timeRange);

      logger.info('Flow analytics calculated', {
        flowId,
        eventsCount: events.length,
        timeRange: `${timeRange.start.toISOString()} - ${timeRange.end.toISOString()}`
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get flow analytics', {
        flowId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getEmptyMetrics();
    }
  }

  /**
   * Получение сравнительной аналитики нескольких потоков
   */
  async compareFlows(
    flowIds: string[],
    timeRange: AnalyticsTimeRange
  ): Promise<Record<string, FlowAnalyticsMetrics>> {
    const results: Record<string, FlowAnalyticsMetrics> = {};

    for (const flowId of flowIds) {
      results[flowId] = await this.getFlowAnalytics(flowId, timeRange);
    }

    return results;
  }

  /**
   * Получение аналитики по проекту
   */
  async getProjectAnalytics(
    projectId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<{
    flows: Array<{
      flowId: string;
      name: string;
      metrics: FlowAnalyticsMetrics;
    }>;
    summary: FlowAnalyticsMetrics;
  }> {
    try {
      // Получаем все потоки проекта
      const flows = await BotFlowService.getFlowsByProject(projectId);

      const flowAnalytics: Array<{
        flowId: string;
        name: string;
        metrics: FlowAnalyticsMetrics;
      }> = [];

      for (const flow of flows) {
        const metrics = await this.getFlowAnalytics(flow.id, timeRange);
        flowAnalytics.push({
          flowId: flow.id,
          name: flow.name,
          metrics
        });
      }

      // Вычисляем сводные метрики
      const summary = this.calculateSummaryMetrics(flowAnalytics);

      return { flows: flowAnalytics, summary };
    } catch (error) {
      logger.error('Failed to get project analytics', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });

      return { flows: [], summary: this.getEmptyMetrics() };
    }
  }

  /**
   * Получение реального времени метрик
   */
  async getRealtimeMetrics(projectId: string): Promise<{
    activeFlows: number;
    activeUsers: number;
    recentEvents: FlowExecutionEvent[];
    alerts: Array<{
      type: 'error' | 'performance' | 'usage';
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    try {
      // Активные потоки
      const activeFlows =
        this.performanceMonitor.getGlobalPerformanceStats().activeFlows;

      // Активные пользователи (примерно, за последние 5 минут)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentEvents = await this.getRecentEvents(
        projectId,
        fiveMinutesAgo
      );
      const activeUsers = new Set(recentEvents.map((e) => e.userId)).size;

      // Недавние события
      const recentEventsList = recentEvents.slice(-10);

      // Алерты
      const alerts = await this.generateAlerts(projectId, recentEvents);

      return {
        activeFlows,
        activeUsers,
        recentEvents: recentEventsList,
        alerts
      };
    } catch (error) {
      logger.error('Failed to get realtime metrics', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        activeFlows: 0,
        activeUsers: 0,
        recentEvents: [],
        alerts: []
      };
    }
  }

  /**
   * Экспорт данных аналитики
   */
  async exportAnalytics(
    flowId: string,
    timeRange: AnalyticsTimeRange,
    format: 'json' | 'csv' | 'xlsx' = 'json'
  ): Promise<string | Buffer> {
    try {
      const events = await this.getFlowEvents(flowId, timeRange);
      const metrics = await this.getFlowAnalytics(flowId, timeRange);

      const data = {
        metadata: {
          flowId,
          timeRange,
          exportedAt: new Date().toISOString(),
          totalEvents: events.length
        },
        metrics,
        events
      };

      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);

        case 'csv':
          return this.convertToCSV(data);

        case 'xlsx':
          return this.convertToXLSX(data);

        default:
          return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      logger.error('Failed to export analytics', {
        flowId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  /**
   * Получение событий выполнения потока
   */
  private async getFlowEvents(
    flowId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<FlowExecutionEvent[]> {
    // В реальной реализации здесь будет запрос к базе данных
    // Пока возвращаем моковые данные
    return this.eventBuffer.filter(
      (event) =>
        event.flowId === flowId &&
        event.startTime >= timeRange.start &&
        event.startTime <= timeRange.end
    );
  }

  /**
   * Получение недавних событий
   */
  private async getRecentEvents(
    projectId: string,
    since: Date
  ): Promise<FlowExecutionEvent[]> {
    return this.eventBuffer.filter(
      (event) => event.projectId === projectId && event.startTime >= since
    );
  }

  /**
   * Вычисление метрик на основе событий
   */
  private calculateMetrics(
    events: FlowExecutionEvent[],
    timeRange: AnalyticsTimeRange
  ): FlowAnalyticsMetrics {
    const completedEvents = events.filter((e) => e.status === 'completed');
    const failedEvents = events.filter((e) => e.status === 'failed');

    // Базовые метрики
    const totalExecutions = events.length;
    const successfulExecutions = completedEvents.length;
    const failedExecutions = failedEvents.length;
    const successRate =
      totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Метрики длительности
    const durations = completedEvents
      .map((e) => e.duration || 0)
      .filter((d) => d > 0);
    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration =
      sortedDurations.length > 0
        ? sortedDurations[Math.floor(sortedDurations.length / 2)]
        : 0;
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p95Duration = sortedDurations[p95Index] || 0;

    // Метрики производительности
    const averageMemoryUsage =
      events.reduce((sum, e) => sum + (e.memoryUsage || 0), 0) / events.length;
    const averageApiCalls =
      events.reduce((sum, e) => sum + e.apiCalls, 0) / events.length;
    const averageExternalRequests =
      events.reduce((sum, e) => sum + e.externalRequests, 0) / events.length;
    const averageUserInteractions =
      events.reduce((sum, e) => sum + e.userInteractions, 0) / events.length;

    // Метрики по времени
    const executionsByHour = this.calculateHourlyStats(events, timeRange);
    const executionsByDay = this.calculateDailyStats(events, timeRange);
    const executionsByWeekday = this.calculateWeekdayStats(events);

    // Метрики по пользователям
    const userStats = this.calculateUserStats(events);
    const topUsers = this.getTopUsers(events, 10);

    // Географические метрики
    const topCountries = this.calculateGeographicStats(events, 'country', 5);
    const topCities = this.calculateGeographicStats(events, 'city', 5);

    // Метрики по нодам (пока заглушка)
    const nodePerformance: FlowAnalyticsMetrics['nodePerformance'] = [];

    // Метрики ошибок
    const errorRate =
      totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;
    const topErrors = this.calculateTopErrors(failedEvents, 5);
    const errorTrends = this.calculateErrorTrends(events, timeRange);

    // Метрики вовлеченности
    const averageSessionLength = averageDuration;
    const dropOffPoints: FlowAnalyticsMetrics['dropOffPoints'] = [];
    const completionFunnel: FlowAnalyticsMetrics['completionFunnel'] = [];

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration,
      medianDuration,
      p95Duration,
      successRate,
      averageMemoryUsage,
      averageApiCalls,
      averageExternalRequests,
      averageUserInteractions,
      executionsByHour,
      executionsByDay,
      executionsByWeekday,
      uniqueUsers: userStats.uniqueUsers,
      returningUsers: userStats.returningUsers,
      userRetentionRate: userStats.retentionRate,
      topUsers,
      topCountries,
      topCities,
      nodePerformance,
      errorRate,
      topErrors,
      errorTrends,
      averageSessionLength,
      dropOffPoints,
      completionFunnel
    };
  }

  /**
   * Вычисление сводных метрик для проекта
   */
  private calculateSummaryMetrics(
    flowAnalytics: Array<{ metrics: FlowAnalyticsMetrics }>
  ): FlowAnalyticsMetrics {
    if (flowAnalytics.length === 0) return this.getEmptyMetrics();

    const summary = this.getEmptyMetrics();

    // Суммируем все метрики
    flowAnalytics.forEach(({ metrics }) => {
      summary.totalExecutions += metrics.totalExecutions;
      summary.successfulExecutions += metrics.successfulExecutions;
      summary.failedExecutions += metrics.failedExecutions;
    });

    // Вычисляем средние значения
    if (flowAnalytics.length > 0) {
      summary.averageDuration =
        flowAnalytics.reduce((sum, f) => sum + f.metrics.averageDuration, 0) /
        flowAnalytics.length;
      summary.successRate =
        flowAnalytics.reduce((sum, f) => sum + f.metrics.successRate, 0) /
        flowAnalytics.length;
      summary.errorRate =
        flowAnalytics.reduce((sum, f) => sum + f.metrics.errorRate, 0) /
        flowAnalytics.length;
    }

    return summary;
  }

  /**
   * Генерация алертов
   */
  private async generateAlerts(
    projectId: string,
    recentEvents: FlowExecutionEvent[]
  ) {
    const alerts: Array<{
      type: 'error' | 'performance' | 'usage';
      message: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Проверяем на высокую долю ошибок
    const errorRate =
      recentEvents.filter((e) => e.status === 'failed').length /
      recentEvents.length;
    if (errorRate > 0.3) {
      alerts.push({
        type: 'error',
        message: `Высокий уровень ошибок: ${(errorRate * 100).toFixed(1)}%`,
        severity: 'high'
      });
    }

    // Проверяем на медленные выполнения
    const slowEvents = recentEvents.filter((e) => (e.duration || 0) > 30000); // > 30 сек
    if (slowEvents.length > recentEvents.length * 0.2) {
      alerts.push({
        type: 'performance',
        message: `Медленные выполнения: ${slowEvents.length} из ${recentEvents.length}`,
        severity: 'medium'
      });
    }

    // Проверяем на высокую нагрузку
    if (recentEvents.length > 100) {
      alerts.push({
        type: 'usage',
        message: `Высокая активность: ${recentEvents.length} выполнений за 5 минут`,
        severity: 'low'
      });
    }

    return alerts;
  }

  /**
   * Отправка буферизованных событий
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const eventsToFlush = [...this.eventBuffer];
      this.eventBuffer = [];

      // В реальной реализации здесь будет сохранение в базу данных
      logger.info('Events flushed to storage', { count: eventsToFlush.length });
    } catch (error) {
      logger.error('Failed to flush events', {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: this.eventBuffer.length
      });

      // Возвращаем события обратно в буфер
      this.eventBuffer.unshift(...this.eventBuffer);
    }
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

  private getEmptyMetrics(): FlowAnalyticsMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      successRate: 0,
      averageMemoryUsage: 0,
      averageApiCalls: 0,
      averageExternalRequests: 0,
      averageUserInteractions: 0,
      executionsByHour: [],
      executionsByDay: [],
      executionsByWeekday: [],
      uniqueUsers: 0,
      returningUsers: 0,
      userRetentionRate: 0,
      topUsers: [],
      topCountries: [],
      topCities: [],
      nodePerformance: [],
      errorRate: 0,
      topErrors: [],
      errorTrends: [],
      averageSessionLength: 0,
      dropOffPoints: [],
      completionFunnel: []
    };
  }

  private calculateHourlyStats(
    events: FlowExecutionEvent[],
    timeRange: AnalyticsTimeRange
  ) {
    const stats: Array<{ hour: number; count: number }> = [];

    for (let hour = 0; hour < 24; hour++) {
      const count = events.filter(
        (e) => e.startTime.getHours() === hour
      ).length;
      stats.push({ hour, count });
    }

    return stats;
  }

  private calculateDailyStats(
    events: FlowExecutionEvent[],
    timeRange: AnalyticsTimeRange
  ) {
    const stats: Array<{ date: string; count: number }> = [];
    const dateMap = new Map<string, number>();

    events.forEach((event) => {
      const date = event.startTime.toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    dateMap.forEach((count, date) => {
      stats.push({ date, count });
    });

    return stats.sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateWeekdayStats(events: FlowExecutionEvent[]) {
    const stats: Array<{ weekday: number; count: number }> = [];

    for (let weekday = 0; weekday < 7; weekday++) {
      const count = events.filter(
        (e) => e.startTime.getDay() === weekday
      ).length;
      stats.push({ weekday, count });
    }

    return stats;
  }

  private calculateUserStats(events: FlowExecutionEvent[]) {
    const userExecutions = new Map<string, number>();
    const userLastExecution = new Map<string, Date>();

    events.forEach((event) => {
      userExecutions.set(
        event.userId,
        (userExecutions.get(event.userId) || 0) + 1
      );
      const lastExecution = userLastExecution.get(event.userId);
      if (!lastExecution || event.startTime > lastExecution) {
        userLastExecution.set(event.userId, event.startTime);
      }
    });

    const uniqueUsers = userExecutions.size;
    const returningUsers = Array.from(userExecutions.values()).filter(
      (count) => count > 1
    ).length;
    const retentionRate =
      uniqueUsers > 0 ? (returningUsers / uniqueUsers) * 100 : 0;

    return { uniqueUsers, returningUsers, retentionRate };
  }

  private getTopUsers(events: FlowExecutionEvent[], limit: number) {
    const userStats = new Map<
      string,
      { executions: number; lastExecution: Date }
    >();

    events.forEach((event) => {
      const existing = userStats.get(event.userId);
      if (existing) {
        existing.executions++;
        if (event.startTime > existing.lastExecution) {
          existing.lastExecution = event.startTime;
        }
      } else {
        userStats.set(event.userId, {
          executions: 1,
          lastExecution: event.startTime
        });
      }
    });

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, limit);
  }

  private calculateGeographicStats(
    events: FlowExecutionEvent[],
    field: 'country' | 'city',
    limit: number
  ) {
    const stats = new Map<string, number>();

    events.forEach((event) => {
      const location = event.location?.[field];
      if (location) {
        stats.set(location, (stats.get(location) || 0) + 1);
      }
    });

    const total = Array.from(stats.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return Array.from(stats.entries())
      .map(([location, count]) => ({
        [field]: location,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private calculateTopErrors(events: FlowExecutionEvent[], limit: number) {
    const errorStats = new Map<string, number>();

    events.forEach((event) => {
      if (event.errorMessage) {
        errorStats.set(
          event.errorMessage,
          (errorStats.get(event.errorMessage) || 0) + 1
        );
      }
    });

    const total = Array.from(errorStats.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return Array.from(errorStats.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private calculateErrorTrends(
    events: FlowExecutionEvent[],
    timeRange: AnalyticsTimeRange
  ) {
    const trends: Array<{
      date: string;
      errorCount: number;
      totalCount: number;
    }> = [];
    const dateMap = new Map<string, { errors: number; total: number }>();

    events.forEach((event) => {
      const date = event.startTime.toISOString().split('T')[0];
      const existing = dateMap.get(date) || { errors: 0, total: 0 };

      existing.total++;
      if (event.status === 'failed') {
        existing.errors++;
      }

      dateMap.set(date, existing);
    });

    dateMap.forEach((stats, date) => {
      trends.push({
        date,
        errorCount: stats.errors,
        totalCount: stats.total
      });
    });

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  private convertToCSV(data: any): string {
    // Простая конвертация в CSV (для демонстрации)
    return 'feature,not,implemented,yet\n';
  }

  private convertToXLSX(data: any): Buffer {
    // Простая конвертация в XLSX (для демонстрации)
    return Buffer.from('feature not implemented yet');
  }

  /**
   * Очистка ресурсов
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents();
  }
}

// Экспорт синглтона
export const botAnalytics = BotAnalyticsService.getInstance();
