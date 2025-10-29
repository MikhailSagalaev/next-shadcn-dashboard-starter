/**
 * @file: src/lib/services/simple-workflow-processor.ts
 * @description: Обработчик workflow с использованием Node Handlers Registry
 * @project: SaaS Bonus System
 * @dependencies: Node Handlers Registry, Execution Context Manager
 * @created: 2025-10-12
 * @author: AI Assistant + User
 */

import { Context } from 'grammy';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { nodeHandlersRegistry } from './workflow/node-handlers-registry';
import { ExecutionContextManager } from './workflow/execution-context-manager';
import type {
  Workflow,
  WorkflowVersion,
  ExecutionContext,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowConnection,
  HandlerResult
} from '@/types/workflow';

/**
 * Обработчик workflow с использованием Node Handlers Registry
 */
export class SimpleWorkflowProcessor {
  private workflowVersion: WorkflowVersion;
  private projectId: string;
  private nodesMap: Map<string, WorkflowNode>;
  private connectionsMap: Map<string, WorkflowConnection>;
  private currentContext: ExecutionContext | null = null;

  constructor(workflowVersion: WorkflowVersion, projectId: string) {
    this.workflowVersion = workflowVersion;
    this.projectId = projectId;

    // Индексируем ноды для быстрого доступа
    this.nodesMap = new Map();
    Object.entries(workflowVersion.nodes).forEach(([id, node]) => {
      this.nodesMap.set(id, node);
      console.log(`📋 Добавлена нода в nodesMap: ${id} (${node.type})`);
    });
    
    console.log(`📋 Всего нод в nodesMap: ${this.nodesMap.size}`);
    console.log(`📋 Ключи nodesMap:`, Array.from(this.nodesMap.keys()));

    // Индексируем connections для быстрого доступа
    this.connectionsMap = new Map();
    if (workflowVersion.connections) {
      workflowVersion.connections.forEach(connection => {
        const key = `${connection.source}->${connection.target}`;
        this.connectionsMap.set(key, connection);
      });
    }
  }

  /**
   * Обработка входящего сообщения/команды
   */
  async process(ctx: Context, trigger: 'start' | 'message' | 'callback'): Promise<boolean> {
    let context: ExecutionContext | null = null;

    try {
      logger.info('🎯 Начало обработки workflow', {
        projectId: this.projectId,
        workflowId: this.workflowVersion.workflowId,
        version: this.workflowVersion.version,
        trigger,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        totalNodes: this.nodesMap.size
      });

      // Создаем контекст выполнения
      const telegramUserId = ctx.from?.id?.toString();
      const chatId = ctx.chat?.id?.toString();

      // Находим пользователя в базе данных по Telegram ID
      let userId: string | undefined;
      if (telegramUserId) {
        try {
          logger.debug('Looking for user by telegram ID', { telegramUserId, projectId: this.projectId });
          
          const user = await db.user.findFirst({
            where: {
              telegramId: BigInt(telegramUserId),
              projectId: this.projectId
            },
            select: { id: true }
          });
          
          userId = user?.id;
          logger.debug('User lookup result', { telegramUserId, userId, found: !!user });
        } catch (error) {
          logger.warn('Failed to find user by telegram ID', { telegramUserId, error });
        }
      } else {
        logger.debug('No telegramUserId provided, skipping user lookup');
      }

      context = await ExecutionContextManager.createContext(
        this.projectId,
        this.workflowVersion.workflowId,
        this.workflowVersion.version,
        this.generateSessionId(ctx),
        userId, // Теперь это ID пользователя из БД, а не Telegram ID
        chatId,
        telegramUserId, // Telegram ID передаем отдельно
        ctx.from?.username,
        ctx.message?.text,
        ctx.callbackQuery?.data
      );

      // Находим стартовую ноду по триггеру
      const startNode = this.findTriggerNode(trigger, ctx);
      if (!startNode) {
        logger.warn('⚠️ Стартовая нода не найдена', {
          projectId: this.projectId,
          workflowId: this.workflowVersion.workflowId,
          trigger,
          hasContact: !!ctx.message?.contact,
          hasCallback: !!ctx.callbackQuery,
          availableNodeTypes: Array.from(this.nodesMap.values()).map((n: any) => n.type)
        });
        return false;
      }

      logger.info('🚀 Запуск выполнения workflow', {
        projectId: this.projectId,
        executionId: context.executionId,
        startNodeId: startNode.id,
        startNodeLabel: startNode.data?.label
      });

      console.log('Starting workflow execution with node:', startNode.id);

      // Выполняем workflow начиная со стартовой ноды
      try {
        await this.executeWorkflow(context, startNode.id);
        console.log('Workflow execution loop completed successfully');
      } catch (executionError) {
        console.error('Workflow execution failed:', {
          error: executionError instanceof Error ? executionError.message : 'Unknown execution error',
          nodeId: startNode.id
        });
        throw executionError;
      }

      // ✅ Проверяем, не перешел ли workflow в состояние waiting
      try {
        const execution = await db.workflowExecution.findUnique({
          where: { id: context.executionId },
          select: { status: true, waitType: true, currentNodeId: true }
        });

        if (execution?.status === 'waiting') {
          logger.info('⏸️ Workflow execution paused (waiting state detected)', {
            executionId: context.executionId,
            waitType: execution.waitType,
            currentNodeId: execution.currentNodeId,
            steps: context.step
          });
          // Не завершаем выполнение — оно будет продолжено позже
          return true;
        }
      } catch (checkError) {
        console.warn('Failed to check execution status after loop', checkError);
      }

      // Завершаем выполнение как completed, если не waiting
      try {
        await ExecutionContextManager.completeExecution(context, 'completed', undefined, context.step);
        console.log('Execution completed successfully');
      } catch (completeError) {
        console.error('Failed to complete execution, but workflow was successful:', completeError);
        // Не бросаем ошибку, так как workflow выполнился успешно
      }

      logger.info('✅ Workflow успешно выполнен', {
        projectId: this.projectId,
        workflowId: this.workflowVersion.workflowId,
        executionId: context.executionId,
        steps: context.step
      });

      return true;
    } catch (error) {
      // Завершаем выполнение с ошибкой
      if (context) {
        await ExecutionContextManager.completeExecution(
          context,
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          context.step
        );
      }

      logger.error('❌ Ошибка обработки workflow', {
        projectId: this.projectId,
        workflowId: this.workflowVersion.workflowId,
        executionId: context?.executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Генерирует ID сессии
   */
  private generateSessionId(ctx: Context): string {
    const chatId = ctx.chat?.id || ctx.from?.id || 'unknown';
    const userId = ctx.from?.id || 'unknown';

    console.log('Generating session ID:', {
      chatId: ctx.chat?.id,
      fromId: ctx.from?.id,
      generatedSessionId: `${chatId}_${userId}_${Date.now()}`
    });

    return `${chatId}_${userId}_${Date.now()}`;
  }

  /**
   * Продолжает выполнение workflow начиная с указанной ноды
   * Используется для возобновления workflow после waiting состояния
   */
  async resumeWorkflow(context: ExecutionContext, startNodeId: string): Promise<void> {
    return this.executeWorkflow(context, startNodeId);
  }

  /**
   * Выполняет workflow начиная с указанной ноды
   * ✅ Защита от бесконечных циклов через visitedNodes и maxIterations
   */
  private async executeWorkflow(context: ExecutionContext, startNodeId: string): Promise<void> {
    console.log('🚀 EXECUTING WORKFLOW FROM NODE:', startNodeId);
    console.log('📋 Available nodes:', Array.from(this.nodesMap.keys()));
    
    this.currentContext = context;
    let currentNodeId: string | null = startNodeId;
    let step = 0;
    
    // ✅ Защита от циклов: отслеживаем посещенные ноды
    const visitedNodes = new Map<string, number>(); // nodeId -> количество посещений
    const MAX_NODE_VISITS = 100; // Максимум 100 посещений одной ноды (для циклов)

    while (currentNodeId && step < context.maxSteps) {
      step++;
      
      console.log(`🔄 STEP ${step}: Executing node ${currentNodeId}`);

      // ✅ Проверяем количество посещений текущей ноды
      const visitCount = visitedNodes.get(currentNodeId) || 0;
      if (visitCount >= MAX_NODE_VISITS) {
        throw new Error(
          `Infinite loop detected: Node ${currentNodeId} visited ${visitCount} times. ` +
          `Maximum allowed: ${MAX_NODE_VISITS}`
        );
      }
      visitedNodes.set(currentNodeId, visitCount + 1);

      const updatedContext = ExecutionContextManager.updateContextForStep(
        context,
        step,
        currentNodeId,
        'unknown' // Будет обновлено в handler
      );

      const node = this.nodesMap.get(currentNodeId);
      if (!node) {
        console.error(`Node not found: ${currentNodeId}`);
        throw new Error(`Node not found: ${currentNodeId}`);
      }

      // Получаем handler для типа ноды
      const handler = nodeHandlersRegistry.get(node.type as WorkflowNodeType);
      if (!handler) {
        throw new Error(`No handler found for node type: ${node.type}`);
      }

      // Выполняем ноду через handler
      console.log(`⚡ Executing ${node.type} handler for node ${currentNodeId}`);
      const nextNodeId = await handler.execute(node, updatedContext);
      console.log(`✅ Node ${currentNodeId} executed, nextNodeId: ${nextNodeId}`);
      context.step = step;

      // ✅ Проверяем на специальный результат ожидания ввода пользователя
      if (nextNodeId === '__WAITING_FOR_USER_INPUT__' || nextNodeId === '__WAITING_FOR_CONTACT__') {
        logger.info('⏸️ Workflow paused waiting for user input', {
          executionId: context.executionId,
          nodeId: currentNodeId,
          step
        });
        // Прерываем выполнение - workflow в состоянии waiting
        return;
      }

      // Определяем следующий нод: сначала используем результат handler'а,
      // если null - ищем по connections
      if (nextNodeId !== null) {
        currentNodeId = nextNodeId;
      } else {
        currentNodeId = await this.getNextNodeId(currentNodeId);
      }

      // Если следующий нод не найден, завершаем выполнение
      if (currentNodeId === null) {
        break;
      }
    }

    if (step >= context.maxSteps) {
      throw new Error(
        `Maximum steps (${context.maxSteps}) exceeded. ` +
        `This might indicate an infinite loop or overly complex workflow.`
      );
    }
    
    console.log(`✅ Workflow completed successfully in ${step} steps`);
  }

  /**
   * Получает следующий нод по connections
   */
  private async getNextNodeId(currentNodeId: string): Promise<string | null> {
    // Ищем connection где source - текущий нод
    const relevantConnections = Array.from(this.connectionsMap.values())
      .filter(connection => connection.source === currentNodeId);

    if (relevantConnections.length === 0) {
      return null;
    }

    // Если только одна connection, возвращаем её target
    if (relevantConnections.length === 1) {
      return relevantConnections[0].target;
    }

    // Для condition нод проверяем sourceHandle и результат условия
    const currentNode = this.nodesMap.get(currentNodeId);
    if (currentNode?.type === 'condition') {
      console.log(`🔍 getNextNodeId: Processing condition node ${currentNodeId}`);
      console.log(`🔍 getNextNodeId: Available connections:`, relevantConnections.map(c => ({
        source: c.source,
        target: c.target,
        sourceHandle: (c as any).sourceHandle,
        type: c.type
      })));

      // Получаем результат условия из контекста (должен быть установлен в condition handler)
      const conditionResult = await this.getConditionResultFromContext();

      // Ищем connection с соответствующим sourceHandle
      const expectedHandle = conditionResult ? 'true' : 'false';
      console.log(`🔍 getNextNodeId: Looking for sourceHandle="${expectedHandle}"`);

      const matchingConnection = relevantConnections.find(conn => {
        const connSourceHandle = (conn as any).sourceHandle;
        const matches = connSourceHandle === expectedHandle;
        console.log(`🔍 getNextNodeId: Checking connection ${conn.source}→${conn.target}, sourceHandle="${connSourceHandle}", matches=${matches}`);
        return matches;
      });

      if (matchingConnection) {
        console.log(`✅ Condition ${currentNodeId}: result=${conditionResult}, following sourceHandle="${expectedHandle}" → ${matchingConnection.target}`);
        return matchingConnection.target;
      }

      // Если нет подходящей connection, берем default
      const defaultConnection = relevantConnections.find(conn => conn.type === 'default');
      if (defaultConnection) {
        console.log(`⚠️ No matching sourceHandle found, using default connection → ${defaultConnection.target}`);
        return defaultConnection.target;
      }

      console.warn(`⚠️ No matching connection found for condition ${currentNodeId}, result=${conditionResult}`);
    }

    // Для остальных случаев возвращаем первый target (для обратной совместимости)
    return relevantConnections[0].target;
  }

  /**
   * Получает результат условия из текущего контекста выполнения
   */
  private async getConditionResultFromContext(): Promise<boolean> {
    if (!this.currentContext) {
      console.log('⚠️ getConditionResultFromContext: no currentContext, returning false');
      return false; // fallback - если нет контекста, считаем условие false
    }

    try {
      const result = await this.currentContext.variables.get('condition_result', 'session');
      console.log(`🔍 getConditionResultFromContext: condition_result = ${result} (${typeof result})`);
      
      return Boolean(result);
    } catch (error) {
      console.log('⚠️ getConditionResultFromContext: error getting condition_result, returning false', error);
      // Если переменная не найдена, возвращаем false
      return false;
    }
  }

  /**
   * Находим триггерную ноду на основе входящего обновления
   * Поддерживает множественные триггеры в одном workflow (как в ManyChat/n8n)
   */
  private findTriggerNode(trigger: string, ctx?: any): WorkflowNode | undefined {
    // 1️⃣ ПРИОРИТЕТ 1: Проверяем наличие контакта (trigger.contact)
    if (ctx?.message?.contact) {
      const contactTrigger = this.findTriggerByType('trigger.contact');
      if (contactTrigger) {
        logger.info('✅ Найден trigger.contact (контакт получен)', { 
          nodeId: contactTrigger.id,
          phone: ctx.message.contact.phone_number 
        });
        return contactTrigger;
      }
    }

    // 2️⃣ ПРИОРИТЕТ 2: Проверяем callback query (trigger.callback)
    if (ctx?.callbackQuery) {
      const callbackData = ctx.callbackQuery.data;
      const callbackTrigger = this.findCallbackTrigger(callbackData);
      if (callbackTrigger) {
        logger.info('✅ Найден trigger.callback', { 
          nodeId: callbackTrigger.id, 
          callbackData 
        });
        return callbackTrigger;
      }
    }

    // 3️⃣ ПРИОРИТЕТ 3: Проверяем команду (trigger.command)
    if (trigger === 'start') {
      const commandTrigger = this.findCommandTrigger('/start');
      if (commandTrigger) {
        logger.info('✅ Найден trigger.command для /start', { nodeId: commandTrigger.id });
        return commandTrigger;
      }
    }

    // 4️⃣ ПРИОРИТЕТ 4: Проверяем обычное сообщение (trigger.message)
    if (trigger === 'message') {
      const messageTrigger = this.findTriggerByType('trigger.message');
      if (messageTrigger) {
        logger.info('✅ Найден trigger.message', { nodeId: messageTrigger.id });
        return messageTrigger;
      }
    }

    // 5️⃣ ПРИОРИТЕТ 5: Fallback на entry_node_id
    if (this.workflowVersion.entryNodeId) {
      const entryNode = this.nodesMap.get(this.workflowVersion.entryNodeId);
      if (entryNode) {
        logger.info('✅ Используем entry node как fallback', { 
          nodeId: entryNode.id,
          nodeType: entryNode.type
        });
        return entryNode;
      }
    }

    logger.warn('❌ Trigger нода не найдена', { 
      trigger, 
      hasContact: !!ctx?.message?.contact, 
      hasCallback: !!ctx?.callbackQuery,
      entryNodeId: this.workflowVersion.entryNodeId,
      availableNodes: Array.from(this.nodesMap.values()).map((n: any) => ({
        id: n.id,
        type: n.type,
        label: n.data?.label
      }))
    });

    return undefined;
  }

  /**
   * Поиск триггера по типу
   */
  private findTriggerByType(type: string): WorkflowNode | undefined {
    for (const node of Array.from(this.nodesMap.values())) {
      if (node.type === type) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Поиск trigger.command по команде
   */
  private findCommandTrigger(command: string): WorkflowNode | undefined {
    console.log(`🔍 findCommandTrigger: ищем команду "${command}"`);
    
    for (const [nodeId, node] of Array.from(this.nodesMap.entries())) {
      console.log(`  Проверяем ноду ${nodeId} (${node.id}) типа ${node.type}`);
      
      if (node.type === 'trigger.command') {
        const config = node.data?.config?.['trigger.command'];
        console.log(`    Config:`, JSON.stringify(config, null, 2));
        
        if (config?.command === command) {
          console.log(`    ✅ Найдена команда "${command}" в ноде ${nodeId} (${node.id})`);
          // Возвращаем ноду с правильным ID для nodesMap
          return { ...node, id: nodeId };
        }
      }
    }
    
    console.log(`  ❌ Команда "${command}" не найдена`);
    return undefined;
  }

  /**
   * Поиск trigger.callback по callback_data
   */
  private findCallbackTrigger(callbackData: string): WorkflowNode | undefined {
    for (const node of Array.from(this.nodesMap.values())) {
      if (node.type === 'trigger.callback') {
        const config = node.data?.config?.['trigger.callback'];
        if (config?.callbackData === callbackData) {
          return node;
        }
      }
    }
    return undefined;
  }
}

