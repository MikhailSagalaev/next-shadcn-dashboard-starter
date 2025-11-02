/**
 * @file: src/lib/services/workflow/handlers/action-handlers.ts
 * @description: Обработчики для action нод
 * @project: SaaS Bonus System
 * @dependencies: BaseNodeHandler, ExecutionContext, QueryExecutor
 * @created: 2025-01-13
 * @updated: 2025-10-14 - Добавлен безопасный QueryExecutor
 * @author: AI Assistant + User
 */

import { BaseNodeHandler } from './base-handler';
import { QueryExecutor } from '../query-executor';
import { resolveTemplateString, resolveTemplateValue, getValueByPath, isEmail, isPhone, normalizePhone } from './utils';
import type { PrismaClient } from '@prisma/client';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

/**
 * Обработчик для action.database_query
 * ✅ БЕЗОПАСНО: Использует whitelist запросов вместо raw SQL
 */
export class DatabaseQueryHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.database_query';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.database_query'];

      if (!config) {
        throw new Error('Database query configuration is missing');
      }

      if (!config.query) {
        throw new Error('Query type is required');
      }

      // Проверяем, что запрос в whitelist
      if (!QueryExecutor.isQueryAvailable(config.query)) {
        const availableQueries = QueryExecutor.getAvailableQueries();
        throw new Error(
          `Unauthorized query type: ${config.query}. ` +
          `Available queries: ${availableQueries.join(', ')}`
        );
      }

      // Разрешаем переменные в параметрах
      const resolvedParams = await this.resolveParameters(config.parameters, context);

      this.logStep(context, node, 'Executing safe database query', 'info', {
        queryType: config.query,
        params: Object.keys(resolvedParams)
      });

      // ✅ Выполняем БЕЗОПАСНЫЙ запрос через QueryExecutor
      const result = await QueryExecutor.execute(
        context.services.db,
        config.query,
        resolvedParams
      );

      // Сохраняем результат в переменную если указано
      if (config.assignTo) {
        await this.setVariable(config.assignTo, result, context, 'session');
        this.logStep(context, node, `Query result assigned to variable: ${config.assignTo}`, 'debug');
      }

      // Обрабатываем resultMapping если есть
      if (config.resultMapping && typeof result === 'object') {
        for (const [key, varName] of Object.entries(config.resultMapping)) {
          const value = (result as any)[key];
          if (value !== undefined) {
            await this.setVariable(varName as string, value, context, 'session');
          }
        }
      }

      this.logStep(context, node, 'Database query executed successfully', 'info', {
        hasResult: !!result
      });

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Database query failed', 'error', { error });
      throw error;
    }
  }

  /**
   * Разрешает переменные в параметрах запроса
   */
  private async resolveParameters(parameters: any, context: ExecutionContext): Promise<Record<string, any>> {
    if (!parameters || typeof parameters !== 'object') {
      return {};
    }

    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      resolved[key] = await this.resolveValueAsync(value, context);
    }

    // ✅ Всегда добавляем projectId из контекста
    if (!resolved.projectId) {
      resolved.projectId = context.projectId;
    }

    return resolved;
  }

  /**
   * Асинхронное разрешение переменных с поддержкой workflow_variables
   */
  private async resolveValueAsync(value: any, context: ExecutionContext): Promise<any> {
    if (typeof value === 'string') {
      // Заменяем переменные в строке
      const matches = value.match(/\{\{([^}]+)\}\}/g);
      if (!matches) {
        return value;
      }

      let resolvedValue = value;
      for (const match of matches) {
        const varPath = match.slice(2, -2); // Убираем {{ и }}
        
        // Проверяем, это telegram переменная или workflow переменная
        if (varPath.startsWith('telegram.')) {
          // Синхронное разрешение для telegram переменных
          const resolved = this.getVariableValueSync(varPath, context);
          resolvedValue = resolvedValue.replace(match, resolved !== undefined ? String(resolved) : match);
        } else {
          // Асинхронное разрешение для workflow переменных
          try {
            console.log(`🔍 Resolving workflow variable: ${varPath}`);
            const resolved = await this.resolveVariablePath(varPath, context);
            console.log(`✅ Resolved ${varPath}:`, resolved);
            resolvedValue = resolvedValue.replace(match, resolved !== undefined ? String(resolved) : match);
          } catch (error) {
            console.warn(`❌ Failed to resolve variable ${varPath}:`, error);
            // Оставляем оригинальную переменную
          }
        }
      }
      
      return resolvedValue;
    }

    // Для объектов рекурсивно разрешаем переменные
    if (typeof value === 'object' && value !== null) {
      const resolved: any = Array.isArray(value) ? [] : {};

      for (const [key, val] of Object.entries(value)) {
        resolved[key] = await this.resolveValueAsync(val, context);
      }

      return resolved;
    }

    return value;
  }

  /**
   * Разрешает переменную с поддержкой вложенных свойств (например, contactReceived.phoneNumber)
   */
  private async resolveVariablePath(varPath: string, context: ExecutionContext): Promise<any> {
    const parts = varPath.split('.');
    
    // Если это простая переменная без точек
    if (parts.length === 1) {
      // ✅ КРИТИЧНО: Сначала проверяем, есть ли это свойство в контексте напрямую
      if ((context as any)[varPath] !== undefined) {
        console.log(`✅ Resolved ${varPath} from context:`, (context as any)[varPath]);
        return (context as any)[varPath];
      }
      
      // Если нет в контексте, ищем в session-scope переменных
      return await context.variables.get(varPath, 'session');
    }
    
    // Если это вложенная переменная (например, contactReceived.phoneNumber)
    const baseVarName = parts[0];
    const propertyPath = parts.slice(1);
    
    console.log(`🔍 Resolving nested variable: base=${baseVarName}, path=${propertyPath.join('.')}`);
    
    // ✅ КРИТИЧНО: Сначала проверяем, есть ли base в контексте напрямую
    let baseValue: any;
    if ((context as any)[baseVarName] !== undefined) {
      baseValue = (context as any)[baseVarName];
      console.log(`🔍 Base variable ${baseVarName} from context:`, baseValue);
    } else {
      baseValue = await context.variables.get(baseVarName, 'session');
      console.log(`🔍 Base variable ${baseVarName} from session:`, baseValue);
    }
    
    if (baseValue === undefined || baseValue === null) {
      console.log(`❌ Base variable ${baseVarName} not found`);
      return undefined;
    }
    
    // Получаем вложенное свойство
    let result = baseValue;
    for (const prop of propertyPath) {
      if (typeof result === 'object' && result !== null && prop in result) {
        result = result[prop];
      } else {
        console.log(`❌ Property ${prop} not found in`, result);
        return undefined;
      }
    }
    
    console.log(`✅ Resolved nested variable ${varPath}:`, result);
    return result;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Database query configuration is required');
      return { isValid: false, errors };
    }

    if (!config.query || typeof config.query !== 'string') {
      errors.push('Query type is required and must be a string');
    } else if (!QueryExecutor.isQueryAvailable(config.query)) {
      const availableQueries = QueryExecutor.getAvailableQueries();
      errors.push(
        `Invalid query type: ${config.query}. ` +
        `Available: ${availableQueries.join(', ')}`
      );
    }

    if (config.parameters && typeof config.parameters !== 'object') {
      errors.push('Parameters must be an object');
    }

    if (config.assignTo && typeof config.assignTo !== 'string') {
      errors.push('assignTo must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для action.set_variable
 */
export class SetVariableHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.set_variable';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.set_variable'];

      if (!config) {
        throw new Error('Set variable configuration is missing');
      }

      if (!config.variableName) {
        throw new Error('Variable name is required');
      }

      // Разрешаем переменные в значении
      const resolvedValue = this.resolveValue(config.variableValue, context);

      this.logStep(context, node, 'Setting variable', 'debug', {
        variableName: config.variableName,
        scope: config.scope || 'session',
        hasTTL: !!config.ttl
      });

      // Устанавливаем переменную
      await this.setVariable(
        config.variableName,
        resolvedValue,
        context,
        config.scope || 'session',
        config.ttl
      );

      this.logStep(context, node, `Variable ${config.variableName} set successfully`, 'info');

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to set variable', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Set variable configuration is required');
      return { isValid: false, errors };
    }

    if (!config.variableName || typeof config.variableName !== 'string') {
      errors.push('Variable name is required and must be a string');
    }

    if (config.scope && !['global', 'project', 'user', 'session'].includes(config.scope)) {
      errors.push('Scope must be one of: global, project, user, session');
    }

    if (config.ttl && (typeof config.ttl !== 'number' || config.ttl <= 0)) {
      errors.push('TTL must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для action.get_variable
 */
export class GetVariableHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.get_variable';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.get_variable'];

      if (!config) {
        throw new Error('Get variable configuration is missing');
      }

      if (!config.variableName) {
        throw new Error('Variable name is required');
      }

      this.logStep(context, node, 'Getting variable', 'debug', {
        variableName: config.variableName,
        scope: 'session', // Пока только session scope
        assignTo: config.assignTo
      });

      // Получаем переменную
      const value = await this.getVariable(config.variableName, context, 'session');

      // Если указано assignTo, сохраняем в другую переменную
      if (config.assignTo) {
        const finalValue = value !== undefined ? value : config.defaultValue;
        await this.setVariable(config.assignTo, finalValue, context, 'session');
        this.logStep(context, node, `Variable ${config.variableName} assigned to ${config.assignTo}`, 'info');
      }

      // Следующий нод определяется по connections
      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to get variable', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Get variable configuration is required');
      return { isValid: false, errors };
    }

    if (!config.variableName || typeof config.variableName !== 'string') {
      errors.push('Variable name is required and must be a string');
    }

    if (config.assignTo && typeof config.assignTo !== 'string') {
      errors.push('assignTo must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик для action.request_contact
 * Запрашивает контакт у пользователя и устанавливает waiting state
 */
export class RequestContactHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.request_contact';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.request_contact'];

    this.logStep(context, node, 'Requesting contact from user', 'info');

    // Импортируем здесь чтобы избежать circular dependencies
    const { db } = await import('@/lib/db');

    // Устанавливаем состояние ожидания контакта
    try {
      await db.workflowExecution.update({
        where: { id: context.executionId },
        data: {
          status: 'waiting',
          waitType: 'contact',
          currentNodeId: node.id,
          waitPayload: {
            nodeId: node.id,
            config: config,
            requestedAt: new Date()
          }
        }
      });

      // ✅ КЕШИРУЕМ WAITING EXECUTION В REDIS
      const { WorkflowRuntimeService } = await import('../../workflow-runtime.service');
      await WorkflowRuntimeService.cacheWaitingExecution(
        context.executionId,
        context.projectId,
        context.telegram.chatId || '',
        'contact'
      );

      this.logStep(context, node, 'Waiting state set for contact', 'info', {
        executionId: context.executionId,
        nodeId: node.id
      });

      // Возвращаем специальный результат, который означает "остановиться и ждать"
      return '__WAITING_FOR_CONTACT__';

    } catch (error) {
      this.logStep(context, node, 'Failed to set waiting state', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    // Request contact handler не требует специальной конфигурации
    return {
      isValid: true,
      errors: []
    };
  }
}

/**
 * Обработчик HTTP запросов
 */
export class ApiRequestHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.api_request';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.api_request'];

    if (!config) {
      throw new Error('API request configuration is missing');
    }

    const url = (await resolveTemplateString(config.url, context)).trim();
    if (!url) {
      throw new Error('API request URL is required');
    }

    const method = (config.method || 'GET').toUpperCase();
    const headers = await resolveTemplateValue<Record<string, string | number | boolean>>(
      config.headers || {},
      context
    );
    const body = await resolveTemplateValue(config.body, context);
    const timeout = config.timeout ?? 30000;

    this.logStep(context, node, 'Executing API request', 'info', {
      method,
      url,
      hasBody: body !== undefined && body !== null,
      timeout
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const normalizedHeaders: Record<string, string> = Object.entries(headers || {}).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const options: RequestInit = {
        method,
        headers: normalizedHeaders,
        signal: controller.signal
      };

      if (method !== 'GET' && method !== 'DELETE') {
        if (typeof body === 'string') {
          options.body = body;
        } else if (body !== undefined && body !== null) {
          options.body = JSON.stringify(body);
          options.headers = {
            'Content-Type': 'application/json',
            ...normalizedHeaders
          };
        }
      }

      const response = await fetch(url, options);
      const contentType = response.headers.get('content-type') || '';
      let responseData: any = null;

      if (contentType.includes('application/json')) {
        responseData = await response.json().catch(() => null);
      } else {
        responseData = await response.text().catch(() => null);
      }

      if (!response.ok) {
        this.logStep(context, node, 'API request failed', 'error', {
          status: response.status,
          statusText: response.statusText,
          response: responseData
        });
        throw new Error(`API request failed with status ${response.status}`);
      }

      this.logStep(context, node, 'API request completed', 'info', {
        status: response.status,
        hasResponseData: responseData !== null
      });

      if (config.responseMapping && responseData) {
        for (const [variableName, path] of Object.entries(config.responseMapping)) {
          const value = getValueByPath(responseData, path);
          await context.variables.set(variableName, value, 'session');
        }
      }

      // Неформальное поле assignTo (если будет добавлено в конфиг)
      if ((config as any).assignTo) {
        await context.variables.set((config as any).assignTo, responseData, 'session');
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API request timeout reached (${timeout} ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('API request configuration is required');
    } else {
      if (!config.url || typeof config.url !== 'string') {
        errors.push('URL is required and must be a string');
      }

      if (config.method && typeof config.method !== 'string') {
        errors.push('method must be a string');
      }

      if (config.headers && typeof config.headers !== 'object') {
        errors.push('headers must be an object');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Обработчик отправки уведомлений
 */
export class SendNotificationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.send_notification';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.send_notification'];

    if (!config) {
      throw new Error('Notification configuration is missing');
    }

    const notificationType = config.notificationType || 'telegram';
    const recipient = (await resolveTemplateString(config.recipient, context)).trim();
    const messageText = await resolveTemplateString(config.template || '', context);
    const templateData = await resolveTemplateValue(config.templateData || {}, context);
    const title = (templateData?.title as string) || 'Уведомление';

    this.logStep(context, node, 'Sending notification', 'info', {
      notificationType,
      recipient,
      hasTemplate: !!config.template,
      priority: config.priority
    });

    switch (notificationType) {
      case 'telegram':
        await this.sendTelegramNotification(recipient || context.telegram.chatId, messageText || title, context, templateData);
        break;
      case 'email':
        await this.sendProjectNotification(node, 'email', recipient, title, messageText || title, templateData, config.priority, context);
        break;
      case 'webhook':
        await this.sendWebhookNotification(recipient, {
          projectId: context.projectId,
          userId: context.userId,
          title,
          message: messageText,
          priority: config.priority,
          templateData,
          timestamp: context.now().toISOString()
        });
        break;
      default:
        throw new Error(`Unsupported notification type: ${notificationType}`);
    }

    return null;
  }

  private async sendTelegramNotification(
    chatId: string,
    message: string,
    context: ExecutionContext,
    templateData: Record<string, any>
  ): Promise<void> {
    if (!chatId) {
      throw new Error('Telegram recipient (chatId) is required');
    }

    const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;
    await context.services.http.post(telegramApiUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: templateData?.disablePreview === true
    });
  }

  private async sendProjectNotification(
    node: WorkflowNode,
    channel: string,
    recipient: string,
    title: string,
    message: string,
    templateData: Record<string, any>,
    priority: string | undefined,
    context: ExecutionContext
  ): Promise<void> {
    const { ProjectNotificationService } = await import('@/lib/services/project-notification.service');
    const db: PrismaClient = context.services.db as PrismaClient;

    let userId = context.userId || undefined;

    if (!userId) {
      // Пытаемся найти пользователя по email или телефону
      if (channel === 'email' && isEmail(recipient)) {
        const user = await db.user.findFirst({
          where: {
            projectId: context.projectId,
            email: recipient.toLowerCase()
          },
          select: { id: true }
        });
        userId = user?.id;
      } else if ((channel === 'sms' || channel === 'telegram') && isPhone(recipient)) {
        const user = await db.user.findFirst({
          where: {
            projectId: context.projectId,
            phone: normalizePhone(recipient)
          },
          select: { id: true }
        });
        userId = user?.id;
      }
    }

    if (!userId) {
      this.logStep(context, node, 'Notification skipped: user not found', 'warn', {
        channel,
        recipient
      });
      return;
    }

    await ProjectNotificationService.send({
      userId,
      projectId: context.projectId,
      type: (templateData?.type as string) || 'custom_notification',
      channel,
      title,
      message,
      metadata: {
        ...templateData,
        recipient,
        priority
      }
    });
  }

  private async sendWebhookNotification(url: string, payload: Record<string, any>): Promise<void> {
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`);
    }
  }
}

/**
 * Проверяет, связан ли пользователь с Telegram аккаунтом
 */
export class CheckUserLinkedHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.check_user_linked';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.check_user_linked'];

    if (!config) {
      throw new Error('Check user linked configuration is missing');
    }

    const identifier = (await resolveTemplateString(config.userIdentifier, context)).trim();
    if (!identifier) {
      throw new Error('userIdentifier is required');
    }

    const params: any = {
      projectId: context.projectId,
      telegramId: '',
      phone: undefined,
      email: undefined
    };

    if (isEmail(identifier)) {
      params.email = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      params.phone = normalizePhone(identifier);
    } else {
      params.telegramId = identifier;
    }

    const result = await QueryExecutor.execute(
      context.services.db,
      'check_user_by_telegram',
      params
    );

    const isLinked = !!result?.id && !!result?.telegramId;
    const assignVariable = config.assignTo || 'isUserLinked';

    await context.variables.set(assignVariable, isLinked, 'session');

    if (result) {
      await context.variables.set(`${assignVariable}_user`, result, 'session');
    }

    this.logStep(context, node, 'User link status resolved', 'info', {
      identifier,
      isLinked
    });

    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.userIdentifier) {
      errors.push('userIdentifier is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Поиск пользователя по контакту
 */
export class FindUserByContactHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.find_user_by_contact';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.find_user_by_contact'];

    if (!config) {
      throw new Error('Find user by contact configuration is missing');
    }

    const contactValue = (await resolveTemplateString(config.contactValue, context)).trim();
    if (!contactValue) {
      throw new Error('contactValue is required');
    }

    const params: any = {
      projectId: context.projectId,
      telegramId: '',
      phone: undefined,
      email: undefined
    };

    if (config.contactType === 'phone') {
      params.phone = normalizePhone(contactValue);
    } else {
      params.email = contactValue.toLowerCase();
    }

    const user = await QueryExecutor.execute(
      context.services.db,
      'check_user_by_telegram',
      params
    );

    await context.variables.set(config.assignTo || 'foundUser', user || null, 'session');

    this.logStep(context, node, 'User lookup finished', 'info', {
      contactType: config.contactType,
      contactValue,
      found: !!user
    });

    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.contactType) {
      errors.push('contactType is required');
    }
    if (!config?.contactValue) {
      errors.push('contactValue is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Привязка Telegram аккаунта к пользователю
 */
export class LinkTelegramAccountHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.link_telegram_account';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.link_telegram_account'];

    if (!config) {
      throw new Error('Link Telegram account configuration is missing');
    }

    const telegramIdValue = (await resolveTemplateString(config.telegramId || '{{telegram.userId}}', context)).trim();
    const contactValue = (await resolveTemplateString(config.contactValue, context)).trim();

    if (!telegramIdValue) {
      throw new Error('telegramId is required');
    }
    if (!contactValue) {
      throw new Error('contactValue is required');
    }

    const db: PrismaClient = context.services.db as PrismaClient;
    const telegramIdBigInt = BigInt(telegramIdValue);

    const user = await db.user.findFirst({
      where: {
        projectId: context.projectId,
        ...(config.contactType === 'phone'
          ? { phone: normalizePhone(contactValue) }
          : { email: contactValue.toLowerCase() })
      }
    });

    if (!user) {
      throw new Error('User not found for linking');
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        telegramId: telegramIdBigInt,
        telegramUsername: context.telegram.username || user.telegramUsername,
        isActive: true
      }
    });

    await context.variables.set('linkedUser', {
      ...updatedUser,
      telegramId: updatedUser.telegramId?.toString()
    }, 'session');

    this.logStep(context, node, 'Telegram account linked', 'info', {
      userId: updatedUser.id,
      contactType: config.contactType
    });

    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.contactType) errors.push('contactType is required');
    if (!config?.contactValue) errors.push('contactValue is required');
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Получение баланса пользователя
 */
export class GetUserBalanceHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.get_user_balance';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['action.get_user_balance'];

    if (!config) {
      throw new Error('Get user balance configuration is missing');
    }

    const userId = (config.userId
      ? (await resolveTemplateString(config.userId, context)).trim()
      : context.userId) as string | undefined;

    if (!userId) {
      throw new Error('userId is required to get balance');
    }

    const result = await QueryExecutor.execute(
      context.services.db,
      'get_user_balance',
      { userId }
    );

    await context.variables.set(config.assignTo || 'userBalance', result?.balance ?? 0, 'session');
    await context.variables.set((config.assignTo || 'userBalance') + '_details', result ?? null, 'session');

    this.logStep(context, node, 'User balance retrieved', 'info', {
      userId,
      balance: result?.balance ?? 0
    });

    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.assignTo) {
      errors.push('assignTo is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * ✨ НОВОЕ: Обработчик для встроенных команд меню (menu_balance, menu_history и т.д.)
 */
export class MenuCommandHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'action.menu_command';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    try {
      const config = node.data.config?.['action.menu_command'];

      if (!config) {
        throw new Error('Menu command configuration is missing');
      }

      const command = config.command;
      if (!command) {
        throw new Error('Menu command is required');
      }

      this.logStep(context, node, 'Executing menu command', 'info', { command });

      // Определяем userId - пытаемся найти по Telegram ID
      let userId = context.userId;
      if (!userId && context.telegram?.userId) {
        try {
          const found = await QueryExecutor.execute(
            context.services.db,
            'check_user_by_telegram',
            { telegramId: context.telegram.userId, projectId: context.projectId }
          );
          if (found?.id) {
            userId = found.id;
            this.logStep(context, node, 'Resolved userId from telegramId', 'debug', { userId });
          }
        } catch (e) {
          this.logStep(context, node, 'Failed resolve userId from telegramId', 'warn', { error: e });
        }
      }

      if (!userId) {
        this.logStep(context, node, 'No userId available, cannot execute menu command', 'warn', { command });
        // Отправляем сообщение об ошибке
        const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;
        await context.services.http.post(telegramApiUrl, {
          chat_id: context.telegram.chatId,
          text: '❌ Для использования меню необходимо привязать аккаунт. Введите /start для начала.',
          parse_mode: 'HTML'
        });
        return null;
      }

      // Получаем переменные пользователя
      const { UserVariablesService } = await import('../user-variables.service');
      console.log('🔍 MENU COMMAND: Getting user variables for', { userId, projectId: context.projectId });
      const userVariables = await UserVariablesService.getUserVariables(
        context.services.db,
        userId,
        context.projectId
      );
      console.log('✅ MENU COMMAND: User variables received', {
        userVariablesKeys: Object.keys(userVariables),
        balance: userVariables['user.balanceFormatted'],
        expiringBonuses: userVariables['user.expiringBonusesFormatted'],
        referralCount: userVariables['user.referralCount']
      });

      // Определяем текст сообщения в зависимости от команды
      let messageText = '';
      let keyboard: any = null;

      switch (command) {
        case 'menu_balance':
          messageText = `<b>💰 Ваш баланс бонусов</b>

💵 <b>Текущий баланс:</b> ${userVariables['user.balanceFormatted']}
📈 <b>Всего заработано:</b> ${userVariables['user.totalEarnedFormatted']}
📉 <b>Всего потрачено:</b> ${userVariables['user.totalSpentFormatted']}
🛍️ <b>Покупок на сумму:</b> ${userVariables['user.totalPurchasesFormatted']}

✨ Продолжайте совершать покупки для накопления бонусов!`;
          break;

        case 'menu_history':
          messageText = `<b>📜 История операций</b>

<b>Последние 10 операций:</b>

${userVariables['transactions.formatted']}

Показаны последние 10 операций.

💡 Для полной истории посетите личный кабинет на сайте.`;
          break;

        case 'menu_level':
          messageText = `<b>🏆 Ваш уровень:</b> ${userVariables['user.currentLevel']}

<b>📊 Прогресс к следующему уровню:</b>
${userVariables['user.progressBar']} (${userVariables['user.progressPercent']}%)

<b>💰 Бонусный процент:</b> ${userVariables['user.levelBonusPercent']}%
<b>💵 Процент оплаты бонусами:</b> ${userVariables['user.levelPaymentPercent']}%

<b>Следующий уровень:</b> ${userVariables['user.nextLevelName']}
<b>Нужно покупок на сумму:</b> ${userVariables['user.nextLevelAmountFormatted']}

🎯 Продолжайте совершать покупки для повышения уровня!`;
          break;

        case 'menu_referrals':
          messageText = `<b>👥 Реферальная программа</b>

<b>📊 Статистика по проекту:</b>
👤 <b>Приглашено пользователей:</b> ${userVariables['user.referralCount']}
💰 <b>Бонусов от рефералов:</b> ${userVariables['user.referralBonusTotalFormatted']}

<b>🔗 Ваша реферальная ссылка:</b>
${userVariables['user.referralLink']}

📱 Поделитесь ссылкой с друзьями и получайте бонусы за их покупки!

💡 Приглашайте друзей и зарабатывайте вместе!`;
          break;

        case 'menu_invite':
          messageText = `<b>🔗 Пригласить друга</b>

🎁 Приглашайте друзей и получайте бонусы за их покупки!

<b>💰 Ваш реферальный код:</b> <code>${userVariables['user.referralCode']}</code>

<b>🔗 Реферальная ссылка:</b>
${userVariables['user.referralLink']}

📱 Отправьте эту ссылку друзьям или поделитесь в соцсетях!

🎯 За каждую покупку приглашенного друга вы получаете бонусы!`;
          break;

        case 'menu_help':
          messageText = `<b>❓ Помощь</b>

<b>🎯 Как работает бонусная система:</b>

💰 <b>Бонусы</b> - накапливайте бонусы за покупки
🛒 <b>Списание</b> - оплачивайте часть покупки бонусами
🏆 <b>Уровни</b> - повышайте уровень для лучших условий
👥 <b>Рефералы</b> - приглашайте друзей и получайте бонусы

<b>📱 Команды:</b>
• /start - начать работу с ботом
• 💰 Баланс - посмотреть текущий баланс
• 📜 История - история операций
• 🏆 Уровень - ваш текущий уровень
• 👥 Рефералы - реферальная программа
• 🔗 Пригласить - пригласить друга

💬 Если возникли вопросы, напишите в поддержку!`;
          break;

        default:
          messageText = `❌ Неизвестная команда меню: ${command}`;
      }

      // Добавляем кнопку "Назад в меню" для всех команд кроме help
      if (command !== 'menu_help') {
        keyboard = {
          inline_keyboard: [[
            { text: '⬅️ Назад в меню', callback_data: 'back_to_menu' }
          ]]
        };
      }

      // Отправляем сообщение
      const telegramApiUrl = `https://api.telegram.org/bot${context.telegram.botToken}/sendMessage`;
      const payload: any = {
        chat_id: context.telegram.chatId,
        text: messageText,
        parse_mode: 'HTML'
      };

      if (keyboard) {
        payload.reply_markup = keyboard;
      }

      await context.services.http.post(telegramApiUrl, payload);

      this.logStep(context, node, 'Menu command executed successfully', 'info', {
        command,
        userId,
        hasKeyboard: !!keyboard
      });

      return null;

    } catch (error) {
      this.logStep(context, node, 'Failed to execute menu command', 'error', { error });
      throw error;
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config) {
      errors.push('Menu command configuration is required');
      return { isValid: false, errors };
    }

    if (!config.command || typeof config.command !== 'string') {
      errors.push('Menu command is required and must be a string');
    }

    if (config.command && !config.command.startsWith('menu_')) {
      errors.push('Menu command must start with "menu_"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}