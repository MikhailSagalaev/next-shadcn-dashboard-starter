/**
 * @file: src/lib/services/workflow/handlers/flow-handlers.ts
 * @description: Обработчики для flow нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';
import { DelayJobService } from '../delay-job.service';

/**
 * Обработчик для flow.delay
 * Использует Bull queue для неблокирующих задержек
 */
export class DelayFlowHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.delay';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['flow.delay'];

      if (!config) {
        throw new Error('Delay configuration is missing');
      }

      // Разрешаем переменные в задержке
      let delayMs = config.delayMs;

      if (config.variableDelay) {
        const variableValue = await this.getVariable(config.variableDelay, context, 'session');
        if (typeof variableValue === 'number') {
          delayMs = variableValue;
        }
      }

      if (typeof delayMs !== 'number' || delayMs < 0) {
        throw new Error('Invalid delay value');
      }

      // Максимальная задержка: 24 часа
      const MAX_DELAY_MS = 24 * 60 * 60 * 1000; // 86400000 ms
      if (delayMs > MAX_DELAY_MS) {
        throw new Error(
          `Delay exceeds maximum allowed time (24 hours). Requested: ${delayMs}ms, Max: ${MAX_DELAY_MS}ms`
        );
      }

      this.logStep(context, node, `Scheduling workflow delay for ${delayMs}ms`, 'info');

      // Для задержек менее 1 секунды используем синхронное ожидание (быстрее)
      if (delayMs < 1000) {
        this.logStep(context, node, `Using synchronous delay (<1s)`, 'debug');
        await new Promise(resolve => setTimeout(resolve, delayMs));
        this.logStep(context, node, 'Delay completed', 'info');
        // Следующий нод определяется по connections
        return null;
      }

      // Для длительных задержек используем Bull queue (неблокирующее)
      try {
        // Находим следующий нод для продолжения после задержки
        const nextNodeId = this.findNextNodeId(node, context) || null;

        // Обновляем execution: сохраняем состояние задержки
        const { db } = await import('@/lib/db');
        await db.workflowExecution.update({
          where: { id: context.executionId },
          data: {
            status: 'waiting',
            waitType: 'delay' as any,
            currentNodeId: nextNodeId || node.id, // Сохраняем следующий нод для продолжения
            waitPayload: {
              delayMs,
              originalNodeId: node.id,
              scheduledAt: new Date().toISOString()
            }
          }
        });

        // Планируем отложенное выполнение через Bull queue
        // Используем nextNodeId если найден, иначе node.id (processor сам найдет следующий через getNextNodeId)
        const jobId = await DelayJobService.scheduleDelay(
          context.executionId,
          nextNodeId || node.id,
          context.projectId,
          context.workflowId,
          delayMs
        );

        // Сохраняем jobId в переменные сессии для возможности отмены
        if (!jobId.startsWith('sync:')) {
          await this.setVariable('delayJobId', jobId, context, 'session');
          this.logStep(context, node, `Delay scheduled in queue (jobId: ${jobId})`, 'info', {
            jobId,
            delayMs,
            scheduledFor: new Date(Date.now() + delayMs).toISOString()
          });
        }

        // Останавливаем выполнение workflow - оно будет возобновлено через Bull queue
        // Возвращаем null, чтобы остановить текущее выполнение
        return null;
      } catch (queueError) {
        // Если очередь недоступна, используем синхронное ожидание как fallback
        this.logStep(context, node, 'Queue unavailable, falling back to synchronous delay', 'warn', {
          error: queueError instanceof Error ? queueError.message : String(queueError)
        });

        // Для задержек более 5 минут в синхронном режиме выдаем предупреждение
        if (delayMs > 5 * 60 * 1000) {
          this.logStep(
            context,
            node,
            'WARNING: Long delay in synchronous mode may block event loop',
            'warn'
          );
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        this.logStep(context, node, 'Synchronous delay completed', 'info');
        return null;
      }
    } catch (error) {
      this.logStep(context, node, 'Delay failed', 'error', { error });
      throw error;
    }
  }

  /**
   * Находит ID следующего нода для продолжения выполнения после задержки
   */
  private findNextNodeId(node: WorkflowNode, context: ExecutionContext): string | null {
    // Пытаемся получить connections из разных источников
    let connections: Array<{ source: string; target: string }> | null = null;

    // 1. Попытка из workflowVersion в контексте (если есть)
    const workflowVersion = (context as any).workflowVersion;
    if (workflowVersion?.connections) {
      connections = workflowVersion.connections as Array<{ source: string; target: string }>;
    } else {
      // 2. Попытка получить из processor (если доступен)
      const processor = (context as any).processor;
      if (processor?.connectionsMap) {
        const connectionsMap = processor.connectionsMap as Map<string, { source: string; target: string }>;
        connections = Array.from(connectionsMap.values());
      }
    }

    if (!connections || connections.length === 0) {
      // Если connections недоступны, возвращаем null
      // SimpleWorkflowProcessor сам найдет следующий нод через getNextNodeId
      return null;
    }

    // Ищем первый connection типа 'default', который начинается с текущей ноды
    const nextConnection = connections.find(
      conn => conn.source === node.id && (conn as any).type === 'default'
    ) || connections.find(conn => conn.source === node.id);

    return nextConnection?.target || null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Delay configuration is required');
      return { isValid: false, errors };
    }

    if (config.delayMs !== undefined && (typeof config.delayMs !== 'number' || config.delayMs < 0)) {
      errors.push('delayMs must be a non-negative number');
    }

    // Валидация максимальной задержки (24 часа)
    const MAX_DELAY_MS = 24 * 60 * 60 * 1000;
    if (config.delayMs !== undefined && config.delayMs > MAX_DELAY_MS) {
      errors.push(`delayMs must not exceed ${MAX_DELAY_MS}ms (24 hours)`);
    }

    if (config.variableDelay && typeof config.variableDelay !== 'string') {
      errors.push('variableDelay must be a string');
    }

    if (config.delayMs === undefined && !config.variableDelay) {
      errors.push('Either delayMs or variableDelay must be specified');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для flow.end
 */
export class EndFlowHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.end';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['flow.end'] || {};

    this.logStep(context, node, 'Workflow execution ended', 'info', {
      success: config.success ?? true,
      message: config.message
    });

    // Flow end всегда завершает выполнение - возвращаем null
    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (config && typeof config !== 'object') {
      errors.push('End configuration must be an object');
    }

    if (config?.message && typeof config.message !== 'string') {
      errors.push('Message must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для flow.loop
 */
export class LoopFlowHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.loop';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['flow.loop'];

      if (!config) {
        throw new Error('Loop configuration is missing');
      }

      const loopType = config.type || 'count';
      const maxIterations = config.maxIterations || 100;

      this.logStep(context, node, `Executing ${loopType} loop`, 'info', {
        maxIterations
      });

      switch (loopType) {
        case 'count':
          return await this.executeCountLoop(node, config, context, maxIterations);
        
        case 'foreach':
          return await this.executeForeachLoop(node, config, context, maxIterations);
        
        case 'while':
          return await this.executeWhileLoop(node, config, context, maxIterations);
        
        default:
          throw new Error(`Unknown loop type: ${loopType}`);
      }

    } catch (error) {
      this.logStep(context, node, 'Loop execution failed', 'error', { error });
      throw error;
    }
  }

  private async executeCountLoop(
    node: WorkflowNode,
    config: any,
    context: ExecutionContext,
    maxIterations: number
  ): Promise<string | null> {
    const count = this.resolveValue(config.count, context) as number;

    if (typeof count !== 'number' || count < 0) {
      throw new Error('Count must be a non-negative number');
    }

    if (count > maxIterations) {
      throw new Error(`Count ${count} exceeds maximum iterations ${maxIterations}`);
    }

    const indexVar = config.indexVariable || 'loop_index';
    
    for (let i = 0; i < count; i++) {
      await this.setVariable(indexVar, i, context, 'session');
      this.logStep(context, node, `Loop iteration ${i + 1}/${count}`, 'debug');
    }

    this.logStep(context, node, `Count loop completed: ${count} iterations`, 'info');
    return null;
  }

  private async executeForeachLoop(
    node: WorkflowNode,
    config: any,
    context: ExecutionContext,
    maxIterations: number
  ): Promise<string | null> {
    const arrayVarName = config.array;
    
    if (!arrayVarName) {
      throw new Error('Array variable name is required for foreach loop');
    }

    const array = await this.getVariable(arrayVarName, context, 'session');

    if (!Array.isArray(array)) {
      throw new Error(`Variable ${arrayVarName} is not an array`);
    }

    if (array.length > maxIterations) {
      throw new Error(`Array length ${array.length} exceeds maximum iterations ${maxIterations}`);
    }

    const itemVar = config.itemVariable || 'loop_item';
    const indexVar = config.indexVariable || 'loop_index';

    for (let i = 0; i < array.length; i++) {
      await this.setVariable(itemVar, array[i], context, 'session');
      await this.setVariable(indexVar, i, context, 'session');
      this.logStep(context, node, `Foreach iteration ${i + 1}/${array.length}`, 'debug');
    }

    this.logStep(context, node, `Foreach loop completed: ${array.length} iterations`, 'info');
    return null;
  }

  private async executeWhileLoop(
    node: WorkflowNode,
    config: any,
    context: ExecutionContext,
    maxIterations: number
  ): Promise<string | null> {
    const condition = config.condition;

    if (!condition) {
      throw new Error('Condition is required for while loop');
    }

    let iterations = 0;

    while (iterations < maxIterations) {
      const conditionResult = await this.evaluateSimpleCondition(condition, context);
      
      if (!conditionResult) {
        break;
      }

      iterations++;
      await this.setVariable('loop_index', iterations - 1, context, 'session');
      this.logStep(context, node, `While loop iteration ${iterations}`, 'debug');
    }

    if (iterations >= maxIterations) {
      throw new Error(`While loop exceeded maximum iterations ${maxIterations}`);
    }

    this.logStep(context, node, `While loop completed: ${iterations} iterations`, 'info');
    return null;
  }

  private async evaluateSimpleCondition(condition: string, context: ExecutionContext): Promise<boolean> {
    const resolvedCondition = this.resolveValue(condition, context);
    
    if (typeof resolvedCondition === 'string') {
      return resolvedCondition.toLowerCase() === 'true';
    }
    
    if (typeof resolvedCondition === 'boolean') {
      return resolvedCondition;
    }
    
    if (typeof resolvedCondition === 'number') {
      return resolvedCondition > 0;
    }
    
    return false;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Loop configuration is required');
      return { isValid: false, errors };
    }

    const loopType = config.type || 'count';

    if (!['count', 'foreach', 'while'].includes(loopType)) {
      errors.push('Loop type must be one of: count, foreach, while');
    }

    if (loopType === 'count') {
      if (config.count === undefined) {
        errors.push('Count is required for count loop');
      } else if (typeof config.count !== 'number' && typeof config.count !== 'string') {
        errors.push('Count must be a number or variable reference');
      }
    }

    if (loopType === 'foreach') {
      if (!config.array || typeof config.array !== 'string') {
        errors.push('Array variable name is required for foreach loop');
      }
    }

    if (loopType === 'while') {
      if (!config.condition || typeof config.condition !== 'string') {
        errors.push('Condition is required for while loop');
      }
    }

    if (config.maxIterations !== undefined) {
      if (typeof config.maxIterations !== 'number' || config.maxIterations <= 0) {
        errors.push('maxIterations must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Заглушка для flow.sub_workflow
 */
export class SubWorkflowFlowHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.sub_workflow';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    this.logStep(context, node, 'Sub-workflow execution not implemented yet', 'warn');
    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    return { isValid: true, errors: [] };
  }
}

/**
 * Заглушка для flow.jump
 */
export class JumpFlowHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'flow.jump';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['flow.jump'];

    if (config?.targetNodeId) {
      this.logStep(context, node, `Jumping to node ${config.targetNodeId}`, 'info');
      return config.targetNodeId;
    }

    this.logStep(context, node, 'Jump target not specified', 'warn');
    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (config?.targetNodeId && typeof config.targetNodeId !== 'string') {
      errors.push('targetNodeId must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

