/**
 * @file: src/types/bot-constructor.ts
 * @description: TypeScript типы для визуального конструктора ботов
 * @project: SaaS Bonus System
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

// ========== ОСНОВНЫЕ ТИПЫ КОНСТРУКТОРА ==========

export type NodeType =
  | 'start' // Точка входа в диалог (Grammy: bot.start())
  | 'message' // Отправка сообщения (Grammy: ctx.reply())
  | 'command' // Обработка команд (Grammy: bot.command())
  | 'callback' // Callback queries (Grammy: bot.callbackQuery())
  | 'input' // Ожидание ввода (Grammy: Conversations)
  | 'condition' // Условные переходы (Grammy: Middleware)
  | 'action' // Действия (Grammy: ctx.api.*)
  | 'middleware' // Middleware (Grammy: bot.use())
  | 'session' // Работа с сессиями (Grammy: Sessions)
  | 'end'; // Завершение диалога

export type ConnectionType = 'default' | 'true' | 'false' | 'error';

// ========== СТРУКТУРА НОД ==========

export interface Position {
  x: number;
  y: number;
}

import type {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge
} from '@xyflow/react';

export interface BotNode extends ReactFlowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
  selected?: boolean;
  dragging?: boolean;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  config: NodeConfig;
}

export interface NodeConfig {
  // Grammy-based конфигурации
  message?: MessageConfig; // ctx.reply(), ctx.api.sendMessage()
  command?: CommandConfig; // bot.command()
  callback?: CallbackConfig; // bot.callbackQuery()
  input?: InputConfig; // Ожидание ввода с валидацией
  condition?: ConditionConfig; // Условная логика Grammy
  action?: ActionConfig; // API calls, DB queries, variables
  middleware?: MiddlewareConfig; // Grammy middleware
  session?: SessionConfig; // Работа с сессиями
}

// ========== КОНФИГУРАЦИИ НОД ==========

export interface MessageConfig {
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  keyboard?: KeyboardConfig;
  attachments?: Attachment[];
  waitForInput?: boolean;
  disablePreview?: boolean;
  protectContent?: boolean;
}

export interface KeyboardConfig {
  type: 'inline' | 'reply';
  buttons: ButtonConfig[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  selective?: boolean;
}

export interface ButtonConfig {
  text: string;
  callbackData?: string; // Для inline кнопок
  url?: string; // Для ссылок
  webApp?: { url: string }; // Для Web Apps
  loginUrl?: { url: string; forward_text?: string; bot_username?: string };
  switchInlineQuery?: string;
  switchInlineQueryCurrentChat?: string;
  callbackGame?: any;
  pay?: boolean;
}

export interface Attachment {
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation';
  fileId?: string;
  url?: string;
  caption?: string;
  filename?: string;
}

export interface CommandConfig {
  command: string; // Имя команды без /
  description?: string; // Описание для /help
  aliases?: string[]; // Альтернативные имена
  hideFromHelp?: boolean; // Скрыть из списка команд
}

export interface CallbackConfig {
  data: string; // Callback data для кнопки
  pattern?: string; // Регулярное выражение для matching
  hideKeyboard?: boolean; // Скрыть клавиатуру после нажатия
  showAlert?: boolean; // Показать alert вместо уведомления
  alertText?: string; // Текст alert
}

export interface InputConfig {
  prompt: string; // Сообщение с запросом ввода
  timeout?: number; // Таймаут в секундах (default: 300)
  validation?: ValidationConfig;
  retryMessage?: string; // Сообщение при ошибке валидации
  maxRetries?: number; // Максимальное кол-во попыток (default: 3)
  variableName?: string; // Имя переменной для сохранения
}

export interface ValidationConfig {
  type: 'text' | 'email' | 'phone' | 'number' | 'regex' | 'custom';
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Регулярное выражение
  required?: boolean;
  customFunction?: string; // Код пользовательской функции
}

export interface ConditionConfig {
  variable: string; // Переменная для проверки
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater'
    | 'less'
    | 'greater_equal'
    | 'less_equal'
    | 'regex'
    | 'in_array'
    | 'is_empty'
    | 'is_not_empty';
  value: any; // Значение для сравнения
  trueNodeId: string; // ID ноды при true
  falseNodeId: string; // ID ноды при false
  caseSensitive?: boolean; // Учитывать регистр (для строк)
}

export interface MiddlewareConfig {
  type:
    | 'logging'
    | 'auth'
    | 'rate_limit'
    | 'validation'
    | 'custom'
    | 'timeout'
    | 'session'
    | 'error_handler';
  enabled?: boolean; // Включен ли middleware
  priority: number; // Порядок выполнения (0-100)
  condition?: string; // Условие выполнения (JavaScript код)
  code?: string; // Пользовательский код middleware
  skipNext?: boolean; // Прервать цепочку выполнения

  // Специфичные поля для разных типов middleware
  auth?: {
    required: boolean;
    checkTelegramLinked: boolean;
    customCheck: string;
    onFailure: string;
  };
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
    blockDuration: number;
    customKey: string;
  };
  timeout?: {
    duration: number;
    action: 'continue' | 'stop';
    onTimeout: string;
    retryCount: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    includeContext: boolean;
    customMessage: string;
    includeUserId: boolean;
    includeTimestamp: boolean;
    logVariables: string[];
  };
  validation?: {
    rules: string[];
    strict: boolean;
    onFailure: string;
    customValidation: string;
  };
  session?: {
    required: boolean;
    createIfMissing: boolean;
    operations: any[];
    variables: Record<string, any>;
  };
  errorHandler?: {
    catchAll: boolean;
    customHandler: string;
    catchTypes: string[];
    fallbackAction: string;
    retryAttempts: number;
  };
  custom?: {
    name: string;
    parameters: Record<string, any>;
    code: string;
    async: boolean;
    variables: string[];
  };
}

export interface SessionConfig {
  key: string; // Ключ переменной сессии
  value: any; // Значение для установки
  operation?:
    | 'set'
    | 'get'
    | 'delete'
    | 'increment'
    | 'decrement'
    | 'append'
    | 'prepend';
  operations?: SessionOperation[]; // Массив операций
  variableName?: string; // Имя переменной для сохранения результата
}

export interface SessionOperation {
  id: string;
  type:
    | 'set'
    | 'get'
    | 'delete'
    | 'increment'
    | 'decrement'
    | 'append'
    | 'prepend'
    | 'custom'
    | 'merge'
    | 'clear'
    | 'exists';
  key?: string; // Ключ для операции
  source?: string; // Источник данных
  value?: any;
  deepMerge?: boolean; // Для глубокого слияния объектов
  customCode?: string; // Пользовательский код
  description?: string; // Описание операции
  condition?: string; // Условие выполнения
}

export interface ActionConfig {
  type:
    | 'grammy_api'
    | 'external_api'
    | 'database'
    | 'variable'
    | 'notification'
    | 'delay';
  externalApi?: Record<string, any>; // Конфигурация для external API
  onError?: ErrorHandlingConfig; // Обработка ошибок
  config: ActionDetails & {
    // Grammy-specific actions
    grammyMethod?: string; // ctx.api.sendMessage, ctx.reply и т.д.
    grammyParams?: Record<string, any>; // Параметры для Grammy метода
  };
}

export interface ActionDetails {
  // Общие поля для всех действий
  description?: string;
  timeout?: number; // Таймаут в секундах
  retryCount?: number; // Кол-во повторных попыток
  onError?: ErrorHandlingConfig;

  // External API
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  responseMapping?: Record<string, string>; // Маппинг ответа в переменные

  // Database
  query?: string;
  parameters?: any[];
  resultMapping?: Record<string, string>;

  // Variables
  variableName?: string;
  variableValue?: any;
  expression?: string; // JavaScript выражение

  // Notifications
  notificationType?: 'email' | 'telegram' | 'webhook';
  recipient?: string;
  template?: string;
  templateData?: Record<string, any>;

  // Delay
  delayMs?: number;
}

export interface ErrorHandlingConfig {
  action: 'continue' | 'retry' | 'goto_node' | 'stop_flow';
  gotoNodeId?: string; // ID ноды для перехода при ошибке
  errorMessage?: string; // Сообщение об ошибке пользователю
}

// ========== ПОТОКИ И СВЯЗИ ==========

export interface BotFlow {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  nodes: BotNode[];
  connections: BotConnection[];
  variables?: FlowVariable[];
  settings?: FlowSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotConnection extends ReactFlowEdge {
  id: string;
  source: string; // React Flow использует source/target вместо sourceNodeId/targetNodeId
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: ConnectionType;
  animated?: boolean;
  style?: Record<string, any>;
  // Legacy поля для обратной совместимости
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface FlowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface FlowSettings {
  timeout?: number; // Глобальный таймаут в секундах
  maxRetries?: number; // Максимальное кол-во повторных попыток
  errorHandling?: ErrorHandlingConfig;
  localization?: Record<string, string>; // Переводы
  analytics?: AnalyticsSettings;
}

export interface AnalyticsSettings {
  enabled: boolean;
  trackNodes?: boolean; // Отслеживать прохождение через ноды
  trackVariables?: boolean; // Отслеживать изменения переменных
  trackErrors?: boolean; // Отслеживать ошибки
  customEvents?: string[]; // Пользовательские события
}

// ========== СЕССИИ И СОСТОЯНИЯ ==========

export interface BotSession {
  id: string;
  projectId: string;
  userId: string; // Telegram user ID (как string)
  flowId: string;
  state: SessionState;
  variables: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionState {
  currentNodeId: string; // Текущая нода в потоке
  previousNodeId?: string; // Предыдущая нода
  stack: string[]; // Стек вызова нод
  retryCount: number; // Кол-во повторных попыток
  timeoutAt?: Date; // Время таймаута
  lastActivity: Date; // Последняя активность
}

// ========== ИСПОЛНЕНИЕ ПОТОКОВ ==========

export interface FlowExecutionContext {
  flow: BotFlow;
  session: BotSession;
  ctx: any; // Grammy Context
  variables: Record<string, any>;
  nodeResults: Record<string, any>; // Результаты выполнения нод
}

export interface NodeExecutionResult {
  success: boolean;
  nextNodeId?: string;
  output?: any;
  error?: string;
  variables?: Record<string, any>; // Новые/измененные переменные
}

// ========== API ИНТЕРФЕЙСЫ ==========

export interface CreateFlowRequest {
  name: string;
  description?: string;
  nodes?: BotNode[];
  connections?: BotConnection[];
  variables?: FlowVariable[];
  settings?: FlowSettings;
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  nodes?: BotNode[];
  connections?: BotConnection[];
  variables?: FlowVariable[];
  settings?: FlowSettings;
  isActive?: boolean;
}

export interface FlowExecutionRequest {
  flowId: string;
  userId: string;
  input?: any; // Входные данные
  context?: any; // Grammy context
}

// ========== ДОПОЛНИТЕЛЬНЫЕ ТИПЫ ==========

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  nodes: BotNode[];
  connections: BotConnection[];
  variables?: FlowVariable[];
  settings?: FlowSettings;
  preview?: string; // URL превью изображения
  author: string;
  rating?: number;
  downloads?: number;
}

export interface FlowAnalytics {
  flowId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number; // в секундах
    popularNodes: Array<{
      nodeId: string;
      executions: number;
    }>;
    errorRate: number;
    userRetention: number; // процент завершивших поток
  };
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ТИПЫ ==========

export type NodeInputHandle = {
  id: string;
  type: 'target';
  position: 'left' | 'top';
};

export type NodeOutputHandle = {
  id: string;
  type: 'source';
  position: 'right' | 'bottom';
  connectionType: ConnectionType;
};

export interface FlowValidationResult {
  isValid: boolean;
  errors: Array<{
    nodeId?: string;
    connectionId?: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

export interface FlowCompilationResult {
  success: boolean;
  executableFlow?: CompiledFlow;
  errors?: string[];
  warnings?: string[];
}

export interface CompiledFlow {
  id: string;
  nodes: Map<string, CompiledNode>;
  entryPoints: string[]; // ID стартовых нод
  variables: Map<string, FlowVariable>;
  settings: FlowSettings;
}

export interface CompiledNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
  inputs: string[]; // ID входящих соединений
  outputs: Map<ConnectionType, string>; // тип соединения -> ID целевой ноды
  validationErrors: string[];
}
