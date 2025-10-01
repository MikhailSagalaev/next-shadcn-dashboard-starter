/**
 * @file: src/lib/services/bot-flow.service.ts
 * @description: Сервис для управления потоками бота в конструкторе
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Logger
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  BotFlow,
  BotSession,
  CreateFlowRequest,
  UpdateFlowRequest,
  FlowValidationResult,
  FlowCompilationResult,
  CompiledFlow,
  BotNode,
  BotConnection
} from '@/types/bot-constructor';

export class BotFlowService {
  /**
   * Создание нового потока бота
   */
  static async createFlow(
    projectId: string,
    data: CreateFlowRequest
  ): Promise<BotFlow> {
    try {
      logger.info('Creating new bot flow', {
        projectId,
        flowName: data.name,
        nodesCount: data.nodes?.length || 0,
        connectionsCount: data.connections?.length || 0
      });

      // Подготавливаем данные для создания
      const createData = {
        projectId,
        name: data.name,
        description: data.description,
        nodes: JSON.parse(JSON.stringify(data.nodes || [])),
        connections: JSON.parse(JSON.stringify(data.connections || [])),
        variables: JSON.parse(JSON.stringify(data.variables || [])),
        settings: JSON.parse(JSON.stringify(data.settings || {}))
      };

      logger.info('Creating flow in database', {
        projectId,
        createData: {
          ...createData,
          nodes: `${createData.nodes.length} nodes`,
          connections: `${createData.connections.length} connections`
        }
      });

      const flow = await db.botFlow.create({
        data: createData
      });

      logger.info('Bot flow created successfully', {
        projectId,
        flowId: flow.id,
        flowName: flow.name
      });

      return this.mapDbFlowToBotFlow(flow);
    } catch (error) {
      logger.error('Failed to create bot flow', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        data: {
          name: data.name,
          nodesCount: data.nodes?.length || 0,
          connectionsCount: data.connections?.length || 0
        }
      });
      throw error;
    }
  }

  /**
   * Получение потока по ID
   */
  static async getFlowById(flowId: string): Promise<BotFlow | null> {
    try {
      const flow = await db.botFlow.findUnique({
        where: { id: flowId }
      });

      if (!flow) return null;

      return this.mapDbFlowToBotFlow(flow);
    } catch (error) {
      logger.error('Failed to get bot flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение всех потоков проекта
   */
  static async getFlowsByProject(projectId: string): Promise<BotFlow[]> {
    try {
      const flows = await db.botFlow.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' }
      });

      return flows.map((flow) => this.mapDbFlowToBotFlow(flow));
    } catch (error) {
      logger.error('Failed to get project flows', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Обновление потока
   */
  static async updateFlow(
    flowId: string,
    data: UpdateFlowRequest
  ): Promise<BotFlow> {
    try {
      logger.info('Updating bot flow', { flowId });

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.nodes !== undefined)
        updateData.nodes = JSON.parse(JSON.stringify(data.nodes));
      if (data.connections !== undefined)
        updateData.connections = JSON.parse(JSON.stringify(data.connections));
      if (data.variables !== undefined)
        updateData.variables = JSON.parse(JSON.stringify(data.variables));
      if (data.settings !== undefined)
        updateData.settings = JSON.parse(JSON.stringify(data.settings));
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const flow = await db.botFlow.update({
        where: { id: flowId },
        data: updateData
      });

      logger.info('Bot flow updated successfully', { flowId });

      return this.mapDbFlowToBotFlow(flow);
    } catch (error) {
      logger.error('Failed to update bot flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Удаление потока
   */
  static async deleteFlow(flowId: string): Promise<void> {
    try {
      logger.info('Deleting bot flow', { flowId });

      // Удаляем связанные сессии
      await db.botSession.deleteMany({
        where: { flowId }
      });

      // Удаляем поток
      await db.botFlow.delete({
        where: { id: flowId }
      });

      logger.info('Bot flow deleted successfully', { flowId });
    } catch (error) {
      logger.error('Failed to delete bot flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Клонирование потока
   */
  static async cloneFlow(flowId: string, newName: string): Promise<BotFlow> {
    try {
      const originalFlow = await this.getFlowById(flowId);
      if (!originalFlow) {
        throw new Error('Flow not found');
      }

      logger.info('Cloning bot flow', { flowId, newName });

      const clonedFlow = await db.botFlow.create({
        data: {
          projectId: originalFlow.projectId,
          name: newName,
          description: originalFlow.description,
          nodes: JSON.parse(JSON.stringify(originalFlow.nodes)),
          connections: JSON.parse(JSON.stringify(originalFlow.connections)),
          variables: JSON.parse(JSON.stringify(originalFlow.variables)),
          settings: JSON.parse(JSON.stringify(originalFlow.settings))
        }
      });

      logger.info('Bot flow cloned successfully', {
        originalFlowId: flowId,
        clonedFlowId: clonedFlow.id
      });

      return this.mapDbFlowToBotFlow(clonedFlow);
    } catch (error) {
      logger.error('Failed to clone bot flow', {
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Валидация потока
   */
  static validateFlow(
    nodes: BotNode[],
    connections: BotConnection[]
  ): FlowValidationResult {
    const errors: FlowValidationResult['errors'] = [];

    // Проверяем наличие стартовой ноды
    const startNodes = nodes.filter((node) => node.type === 'start');
    if (startNodes.length === 0) {
      errors.push({
        message: 'Поток должен содержать хотя бы одну стартовую ноду',
        severity: 'error'
      });
    } else if (startNodes.length > 1) {
      errors.push({
        message: 'Поток может содержать только одну стартовую ноду',
        severity: 'warning'
      });
    }

    // Проверяем наличие конечной ноды
    const endNodes = nodes.filter((node) => node.type === 'end');
    if (endNodes.length === 0) {
      errors.push({
        message: 'Поток должен содержать хотя бы одну конечную ноду',
        severity: 'warning'
      });
    }

    // Проверяем соединения
    const nodeIds = new Set(nodes.map((node) => node.id));
    connections.forEach((connection) => {
      if (!nodeIds.has(connection.sourceNodeId)) {
        errors.push({
          connectionId: connection.id,
          message: `Соединение ссылается на несуществующую исходную ноду: ${connection.sourceNodeId}`,
          severity: 'error'
        });
      }
      if (!nodeIds.has(connection.targetNodeId)) {
        errors.push({
          connectionId: connection.id,
          message: `Соединение ссылается на несуществующую целевую ноду: ${connection.targetNodeId}`,
          severity: 'error'
        });
      }
    });

    // Проверяем ноды на корректность конфигурации
    nodes.forEach((node) => {
      const nodeErrors = this.validateNode(node);
      nodeErrors.forEach((error) => {
        errors.push({
          nodeId: node.id,
          message: error,
          severity: 'error'
        });
      });
    });

    return {
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      errors
    };
  }

  /**
   * Валидация отдельной ноды
   */
  private static validateNode(node: BotNode): string[] {
    const errors: string[] = [];

    // Проверяем обязательные поля
    if (!node.data.label?.trim()) {
      errors.push('У ноды должно быть название');
    }

    // Проверяем конфигурацию в зависимости от типа
    switch (node.type) {
      case 'message':
        if (!node.data.config.message?.text?.trim()) {
          errors.push('У ноды сообщения должен быть текст');
        }
        break;

      case 'command':
        if (!node.data.config.command?.command?.trim()) {
          errors.push('У ноды команды должно быть имя команды');
        }
        break;

      case 'callback':
        if (!node.data.config.callback?.data?.trim()) {
          errors.push('У ноды callback должен быть callback data');
        }
        break;

      case 'condition':
        const condition = node.data.config.condition;
        if (!condition?.variable?.trim()) {
          errors.push('У ноды условия должна быть переменная');
        }
        if (!condition.trueNodeId || !condition.falseNodeId) {
          errors.push(
            'У ноды условия должны быть указаны обе ветки (true/false)'
          );
        }
        break;

      case 'input':
        if (!node.data.config.input?.prompt?.trim()) {
          errors.push('У ноды ввода должен быть текст запроса');
        }
        break;
    }

    return errors;
  }

  /**
   * Компиляция потока для исполнения
   */
  static compileFlow(flow: BotFlow): FlowCompilationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Валидируем поток
      const validation = this.validateFlow(flow.nodes, flow.connections);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors.map((e) => e.message)
        };
      }

      // Создаем карту нод
      const nodeMap = new Map<string, any>();
      flow.nodes.forEach((node) => {
        nodeMap.set(node.id, {
          id: node.id,
          type: node.type,
          config: node.data.config,
          inputs: [],
          outputs: new Map(),
          validationErrors: []
        });
      });

      // Заполняем соединения
      flow.connections.forEach((connection) => {
        const sourceNode = nodeMap.get(connection.sourceNodeId);
        const targetNode = nodeMap.get(connection.targetNodeId);

        if (sourceNode && targetNode) {
          sourceNode.outputs.set(connection.type, connection.targetNodeId);
          targetNode.inputs.push(connection.sourceNodeId);
        }
      });

      // Находим точки входа (стартовые ноды)
      const entryPoints = flow.nodes
        .filter((node) => node.type === 'start')
        .map((node) => node.id);

      const compiledFlow: CompiledFlow = {
        id: flow.id,
        nodes: nodeMap,
        entryPoints,
        variables: new Map(flow.variables?.map((v) => [v.name, v]) || []),
        settings: flow.settings || {}
      };

      return {
        success: true,
        executableFlow: compiledFlow,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown compilation error'
        ]
      };
    }
  }

  /**
   * Управление сессиями
   */
  static async createSession(
    projectId: string,
    userId: string,
    flowId: string,
    initialState?: any
  ): Promise<BotSession> {
    try {
      // Устанавливаем срок жизни сессии (24 часа)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const session = await db.botSession.create({
        data: {
          projectId,
          userId,
          flowId,
          state: initialState || {
            currentNodeId: '',
            stack: [],
            retryCount: 0,
            lastActivity: new Date()
          },
          variables: {},
          expiresAt
        }
      });

      logger.info('Bot session created', {
        projectId,
        userId,
        flowId,
        sessionId: session.id
      });

      return this.mapDbSessionToBotSession(session);
    } catch (error) {
      logger.error('Failed to create bot session', {
        projectId,
        userId,
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async getSession(
    projectId: string,
    userId: string,
    flowId: string
  ): Promise<BotSession | null> {
    try {
      const session = await db.botSession.findUnique({
        where: {
          projectId_userId_flowId: {
            projectId,
            userId,
            flowId
          }
        }
      });

      if (!session) return null;

      // Проверяем срок жизни
      if (session.expiresAt < new Date()) {
        await this.deleteSession(session.id);
        return null;
      }

      return this.mapDbSessionToBotSession(session);
    } catch (error) {
      logger.error('Failed to get bot session', {
        projectId,
        userId,
        flowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async updateSession(
    sessionId: string,
    updates: Partial<BotSession>
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (updates.state !== undefined) updateData.state = updates.state;
      if (updates.variables !== undefined)
        updateData.variables = updates.variables;
      if (updates.expiresAt !== undefined)
        updateData.expiresAt = updates.expiresAt;

      updateData.updatedAt = new Date();

      await db.botSession.update({
        where: { id: sessionId },
        data: updateData
      });
    } catch (error) {
      logger.error('Failed to update bot session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      await db.botSession.delete({
        where: { id: sessionId }
      });

      logger.info('Bot session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete bot session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Очистка истекших сессий
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db.botSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      logger.info('Expired sessions cleaned up', { count: result.count });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  private static mapDbFlowToBotFlow(dbFlow: any): BotFlow {
    return {
      id: dbFlow.id,
      projectId: dbFlow.projectId,
      name: dbFlow.name,
      description: dbFlow.description,
      version: dbFlow.version,
      isActive: dbFlow.isActive,
      nodes: dbFlow.nodes || [],
      connections: dbFlow.connections || [],
      variables: dbFlow.variables || [],
      settings: dbFlow.settings || {},
      createdAt: dbFlow.createdAt,
      updatedAt: dbFlow.updatedAt
    };
  }

  private static mapDbSessionToBotSession(dbSession: any): BotSession {
    return {
      id: dbSession.id,
      projectId: dbSession.projectId,
      userId: dbSession.userId,
      flowId: dbSession.flowId,
      state: dbSession.state || {},
      variables: dbSession.variables || {},
      expiresAt: dbSession.expiresAt,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt
    };
  }
}
