/**
 * @file: src/lib/services/bot-flow-executor/performance-monitor.ts
 * @description: Мониторинг производительности выполнения потоков
 * @project: SaaS Bonus System
 * @dependencies: FlowExecutor, Logger
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Context } from 'grammy';
import { SessionFlavor } from 'grammy';
import { logger } from '@/lib/logger';

import type { BotConstructorSession } from '../bot-session.service';
import type { BotFlow } from '@/types/bot-constructor';

// Расширенный контекст
type BotConstructorContext = Context & SessionFlavor<BotConstructorSession>;

interface PerformanceMetrics {
  flowId: string;
  userId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  nodesExecuted: number;
  errorsCount: number;
  retriesCount: number;
  nodeMetrics: NodePerformanceMetric[];
  memoryUsage?: number;
  apiCallsCount: number;
  externalRequestsCount: number;
}

interface NodePerformanceMetric {
  nodeId: string;
  nodeType: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  retries: number;
  apiCalls: number;
  externalRequests: number;
}

interface FlowPerformanceStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  errorRate: number;
  retryRate: number;
  popularNodes: Array<{
    nodeId: string;
    executions: number;
    averageDuration: number;
  }>;
  bottlenecks: Array<{
    nodeId: string;
    averageDuration: number;
    errorRate: number;
  }>;
}

export class PerformanceMonitor {
  private activeMetrics: Map<string, PerformanceMetrics> = new Map();
  private completedMetrics: PerformanceMetrics[] = [];
  private maxStoredMetrics = 1000; // Максимум хранимых метрик

  /**
   * Начало отслеживания выполнения потока
   */
  startFlowMonitoring(ctx: BotConstructorContext, flowId: string): string {
    const sessionId = `${flowId}:${ctx.from?.id}:${Date.now()}`;
    const userId = ctx.from?.id?.toString() || 'unknown';

    const metrics: PerformanceMetrics = {
      flowId,
      userId,
      sessionId,
      startTime: new Date(),
      nodesExecuted: 0,
      errorsCount: 0,
      retriesCount: 0,
      nodeMetrics: [],
      apiCallsCount: 0,
      externalRequestsCount: 0
    };

    this.activeMetrics.set(sessionId, metrics);

    logger.info('Flow execution monitoring started', {
      sessionId,
      flowId,
      userId
    });

    return sessionId;
  }

  /**
   * Начало отслеживания выполнения ноды
   */
  startNodeMonitoring(
    sessionId: string,
    nodeId: string,
    nodeType: string
  ): void {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return;

    const nodeMetric: NodePerformanceMetric = {
      nodeId,
      nodeType,
      startTime: new Date(),
      success: false,
      retries: 0,
      apiCalls: 0,
      externalRequests: 0
    };

    metrics.nodeMetrics.push(nodeMetric);
    metrics.nodesExecuted++;
  }

  /**
   * Завершение отслеживания выполнения ноды
   */
  endNodeMonitoring(
    sessionId: string,
    nodeId: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return;

    const nodeMetric = metrics.nodeMetrics.find(
      (n) => n.nodeId === nodeId && !n.endTime
    );
    if (!nodeMetric) return;

    nodeMetric.endTime = new Date();
    nodeMetric.duration =
      nodeMetric.endTime.getTime() - nodeMetric.startTime.getTime();
    nodeMetric.success = success;

    if (!success) {
      nodeMetric.errorMessage = errorMessage;
      metrics.errorsCount++;
    }

    logger.debug('Node execution completed', {
      sessionId,
      nodeId,
      success,
      duration: nodeMetric.duration,
      errorMessage
    });
  }

  /**
   * Регистрация повторной попытки выполнения
   */
  recordRetry(sessionId: string, nodeId: string): void {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return;

    const nodeMetric = metrics.nodeMetrics.find(
      (n) => n.nodeId === nodeId && !n.endTime
    );
    if (nodeMetric) {
      nodeMetric.retries++;
      metrics.retriesCount++;
    }
  }

  /**
   * Регистрация API вызова
   */
  recordApiCall(sessionId: string, nodeId?: string): void {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return;

    metrics.apiCallsCount++;

    if (nodeId) {
      const nodeMetric = metrics.nodeMetrics.find(
        (n) => n.nodeId === nodeId && !n.endTime
      );
      if (nodeMetric) {
        nodeMetric.apiCalls++;
      }
    }
  }

  /**
   * Регистрация внешнего запроса
   */
  recordExternalRequest(sessionId: string, nodeId?: string): void {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return;

    metrics.externalRequestsCount++;

    if (nodeId) {
      const nodeMetric = metrics.nodeMetrics.find(
        (n) => n.nodeId === nodeId && !n.endTime
      );
      if (nodeMetric) {
        nodeMetric.externalRequests++;
      }
    }
  }

  /**
   * Завершение отслеживания выполнения потока
   */
  endFlowMonitoring(sessionId: string): PerformanceMetrics | null {
    const metrics = this.activeMetrics.get(sessionId);
    if (!metrics) return null;

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.memoryUsage = this.getMemoryUsage();

    // Перемещаем в завершенные метрики
    this.completedMetrics.push(metrics);
    this.activeMetrics.delete(sessionId);

    // Ограничиваем количество хранимых метрик
    if (this.completedMetrics.length > this.maxStoredMetrics) {
      this.completedMetrics = this.completedMetrics.slice(
        -this.maxStoredMetrics
      );
    }

    logger.info('Flow execution monitoring completed', {
      sessionId,
      duration: metrics.duration,
      nodesExecuted: metrics.nodesExecuted,
      errorsCount: metrics.errorsCount,
      success: metrics.errorsCount === 0
    });

    return metrics;
  }

  /**
   * Получение статистики производительности для потока
   */
  getFlowPerformanceStats(flowId: string): FlowPerformanceStats {
    const flowMetrics = this.completedMetrics.filter(
      (m) => m.flowId === flowId
    );

    if (flowMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const durations = flowMetrics
      .filter((m) => m.duration)
      .map((m) => m.duration!)
      .sort((a, b) => a - b);

    const successfulExecutions = flowMetrics.filter(
      (m) => m.errorsCount === 0
    ).length;
    const failedExecutions = flowMetrics.length - successfulExecutions;

    // Вычисляем перцентили
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations[p95Index] || 0;

    // Анализ популярных нод
    const nodeStats = new Map<
      string,
      { executions: number; totalDuration: number; errors: number }
    >();

    flowMetrics.forEach((metrics) => {
      metrics.nodeMetrics.forEach((nodeMetric) => {
        const existing = nodeStats.get(nodeMetric.nodeId) || {
          executions: 0,
          totalDuration: 0,
          errors: 0
        };

        existing.executions++;
        if (nodeMetric.duration) {
          existing.totalDuration += nodeMetric.duration;
        }
        if (!nodeMetric.success) {
          existing.errors++;
        }

        nodeStats.set(nodeMetric.nodeId, existing);
      });
    });

    const popularNodes = Array.from(nodeStats.entries())
      .map(([nodeId, stats]) => ({
        nodeId,
        executions: stats.executions,
        averageDuration: stats.totalDuration / stats.executions
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10);

    const bottlenecks = Array.from(nodeStats.entries())
      .filter(([, stats]) => stats.executions > 5) // Минимум 5 выполнений
      .map(([nodeId, stats]) => ({
        nodeId,
        averageDuration: stats.totalDuration / stats.executions,
        errorRate: stats.errors / stats.executions
      }))
      .filter((node) => node.averageDuration > 5000 || node.errorRate > 0.1) // >5 сек или >10% ошибок
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return {
      totalExecutions: flowMetrics.length,
      successfulExecutions,
      failedExecutions,
      averageDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)] || 0,
      p95Duration,
      errorRate: failedExecutions / flowMetrics.length,
      retryRate:
        flowMetrics.reduce((sum, m) => sum + m.retriesCount, 0) /
        flowMetrics.length,
      popularNodes,
      bottlenecks
    };
  }

  /**
   * Получение общей статистики производительности
   */
  getGlobalPerformanceStats(): {
    activeFlows: number;
    totalCompletedFlows: number;
    averageFlowDuration: number;
    totalErrors: number;
    errorRate: number;
  } {
    const activeFlows = this.activeMetrics.size;
    const totalCompletedFlows = this.completedMetrics.length;
    const totalDuration = this.completedMetrics.reduce(
      (sum, m) => sum + (m.duration || 0),
      0
    );
    const averageFlowDuration =
      totalCompletedFlows > 0 ? totalDuration / totalCompletedFlows : 0;
    const totalErrors = this.completedMetrics.reduce(
      (sum, m) => sum + m.errorsCount,
      0
    );
    const errorRate =
      totalCompletedFlows > 0 ? totalErrors / totalCompletedFlows : 0;

    return {
      activeFlows,
      totalCompletedFlows,
      averageFlowDuration,
      totalErrors,
      errorRate
    };
  }

  /**
   * Экспорт метрик для анализа
   */
  exportMetrics(flowId?: string, hours: number = 24): PerformanceMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    let metrics = this.completedMetrics.filter(
      (m) => m.startTime >= cutoffTime
    );

    if (flowId) {
      metrics = metrics.filter((m) => m.flowId === flowId);
    }

    return metrics;
  }

  /**
   * Очистка старых метрик
   */
  cleanupOldMetrics(hours: number = 168): number {
    // 7 дней по умолчанию
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const initialCount = this.completedMetrics.length;

    this.completedMetrics = this.completedMetrics.filter(
      (m) => m.startTime >= cutoffTime
    );

    const removedCount = initialCount - this.completedMetrics.length;

    logger.info('Old performance metrics cleaned up', {
      removedCount,
      remainingCount: this.completedMetrics.length
    });

    return removedCount;
  }

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

  private getEmptyStats(): FlowPerformanceStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      errorRate: 0,
      retryRate: 0,
      popularNodes: [],
      bottlenecks: []
    };
  }

  private getMemoryUsage(): number | undefined {
    // В Node.js получаем использование памяти
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return undefined;
  }

  /**
   * Создание middleware для мониторинга
   */
  static createMonitoringMiddleware(monitor: PerformanceMonitor) {
    return async (ctx: BotConstructorContext, next: () => Promise<void>) => {
      const startTime = Date.now();

      try {
        await next();

        const duration = Date.now() - startTime;

        // Логируем медленные запросы (>1 сек)
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            duration,
            userId: ctx.from?.id,
            updateType: ctx.updateType
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Request failed', {
          duration,
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.from?.id,
          updateType: ctx.updateType
        });

        throw error;
      }
    };
  }
}
