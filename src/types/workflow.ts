/**
 * @file: src/types/workflow.ts
 * @description: Упрощенные типы для конструктора ботов в стиле n8n
 * @project: SaaS Bonus System
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react';

// ========== ОСНОВНЫЕ ТИПЫ НОД ==========

export type WorkflowNodeType =
  // Триггеры
  | 'trigger.command' | 'trigger.message' | 'trigger.callback' | 'trigger.webhook' | 'trigger.email'
  // Сообщения
  | 'message'
  | 'message.keyboard.inline'
  | 'message.keyboard.reply'
  | 'message.photo'
  | 'message.video'
  | 'message.document'
  | 'message.edit'
  | 'message.delete'
  // Действия
  | 'action.api_request' | 'action.database_query' | 'action.set_variable' | 'action.get_variable' | 'action.request_contact'
  | 'action.send_notification' | 'action.check_user_linked' | 'action.find_user_by_contact' | 'action.link_telegram_account' | 'action.get_user_balance'
  // Условия
  | 'condition'
  // Поток управления
  | 'flow.delay' | 'flow.loop' | 'flow.sub_workflow' | 'flow.jump' | 'flow.switch' | 'flow.end'
  // Интеграции
  | 'integration.webhook' | 'integration.analytics';

export type WorkflowConnectionType = 'default' | 'true' | 'false' | 'timeout';

// ========== СТРУКТУРА НОД ==========

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode extends ReactFlowNode {
  id: string;
  type: WorkflowNodeType;
  position: Position;
  data: WorkflowNodeData;
  selected?: boolean;
  dragging?: boolean;
  // Навигационные свойства для workflow
  next?: string; // Следующая нода по умолчанию
  branches?: Record<string, string>; // Ветвления (для условий)
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  config: WorkflowNodeConfig;
  // Статус выполнения
  status?: 'idle' | 'running' | 'success' | 'error' | 'waiting';
  // Результат выполнения
  result?: any;
}

export interface WorkflowNodeConfig {
  // Триггеры
  'trigger.command'?: CommandTriggerConfig;
  'trigger.message'?: MessageTriggerConfig;
  'trigger.callback'?: CallbackTriggerConfig;
  'trigger.webhook'?: WebhookTriggerConfig;
  'trigger.email'?: EmailTriggerConfig;

  // Сообщения
  message?: MessageConfig;
  'message.keyboard.inline'?: InlineKeyboardConfig;
  'message.keyboard.reply'?: ReplyKeyboardConfig;
  'message.photo'?: PhotoMessageConfig;
  'message.video'?: VideoMessageConfig;
  'message.document'?: DocumentMessageConfig;
  'message.edit'?: EditMessageConfig;
  'message.delete'?: DeleteMessageConfig;

  // Действия
  'action.api_request'?: ApiRequestActionConfig;
  'action.database_query'?: DatabaseQueryActionConfig;
  'action.set_variable'?: SetVariableActionConfig;
  'action.get_variable'?: GetVariableActionConfig;
  'action.request_contact'?: RequestContactActionConfig;
  'action.send_notification'?: SendNotificationActionConfig;
  'action.check_user_linked'?: CheckUserLinkedActionConfig;
  'action.find_user_by_contact'?: FindUserByContactActionConfig;
  'action.link_telegram_account'?: LinkTelegramAccountActionConfig;
  'action.get_user_balance'?: GetUserBalanceActionConfig;

  // Условия
  condition?: ConditionConfig;

  // Поток управления
  'flow.delay'?: DelayFlowConfig;
  'flow.loop'?: LoopFlowConfig;
  'flow.sub_workflow'?: SubWorkflowFlowConfig;
  'flow.jump'?: JumpFlowConfig;
  'flow.switch'?: SwitchFlowConfig;
  'flow.end'?: EndFlowConfig;

  // Интеграции
  'integration.webhook'?: WebhookIntegrationConfig;
  'integration.analytics'?: AnalyticsIntegrationConfig;
}

// ========== КОНФИГУРАЦИИ НОД ==========

// Триггеры
export interface CommandTriggerConfig {
  command: string; // Например: '/start', '/help'
}

export interface MessageTriggerConfig {
  pattern?: string; // Регулярное выражение для сопоставления сообщений
  caseSensitive?: boolean;
}

export interface CallbackTriggerConfig {
  callbackData: string; // Callback data от inline кнопок
}

export interface WebhookTriggerConfig {
  webhookUrl: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
}

export interface EmailTriggerConfig {
  email: string;
  subject?: string;
}

export interface MessageConfig {
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  keyboard?: KeyboardConfig;
  attachments?: Attachment[];
}

export interface KeyboardConfig {
  type: 'inline' | 'reply';
  buttons: ButtonConfig[][];
  oneTimeKeyboard?: boolean; // Для reply клавиатур
}

export interface ButtonConfig {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface InlineKeyboardButtonConfig {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
  login_url?: { url: string };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  pay?: boolean;
  goto_node?: string;
}

export interface InlineKeyboardConfig {
  text: string;
  buttons: InlineKeyboardButtonConfig[][];
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
}

export interface ReplyKeyboardButtonActionConfig {
  id?: string;
  type: 'database_query' | 'send_message' | 'condition' | 'set_variable' | 'get_variable' | 'delay';
  query?: string;
  parameters?: Record<string, any>;
  assignTo?: string;
  text?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  variable?: string;
  operator?: 'is_empty' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value?: any;
  true_actions?: ReplyKeyboardButtonActionConfig[];
  false_actions?: ReplyKeyboardButtonActionConfig[];
  key?: string;
  seconds?: number;
}

export interface ReplyKeyboardButtonConfig {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: {
    type?: 'quiz' | 'regular';
  };
  web_app?: { url: string };
  actions?: ReplyKeyboardButtonActionConfig[];
}

export interface ReplyKeyboardConfig {
  text: string;
  buttons: ReplyKeyboardButtonConfig[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface PhotoMessageConfig {
  photo: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  has_spoiler?: boolean;
  disable_notification?: boolean;
}

export interface VideoMessageConfig {
  video: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  has_spoiler?: boolean;
  supports_streaming?: boolean;
  disable_notification?: boolean;
}

export interface DocumentMessageConfig {
  document: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  thumbnail?: string;
  disable_content_type_detection?: boolean;
  disable_notification?: boolean;
}

export interface EditMessageConfig {
  message_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface DeleteMessageConfig {
  message_id: string | number;
}

export interface Attachment {
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation';
  fileId?: string;
  url?: string;
  caption?: string;
}

export interface ConditionConfig {
  // Новое поле для выражений
  expression?: string;

  // Старые поля для обратной совместимости (делаем опциональными)
  variable?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater' | 'less' | 'is_empty' | 'is_not_empty' | '==' | '!=' | '===' | '!==' | '>' | '<' | '>=' | '<=';
  value?: any;
  caseSensitive?: boolean;
}

// Действия
export interface ApiRequestActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  responseMapping?: Record<string, string>; // Маппинг ответа в переменные
  timeout?: number;
}

export interface DatabaseQueryActionConfig {
  query: string; // SQL запрос
  parameters?: any[]; // Параметры для prepared statements
  resultMapping?: Record<string, string>; // Маппинг результата в переменные
  assignTo?: string; // Имя переменной для результата
}

export interface SetVariableActionConfig {
  variableName: string;
  variableValue: any;
  scope?: 'global' | 'project' | 'user' | 'session';
  ttl?: number; // Time to live в секундах
}

export interface GetVariableActionConfig {
  variableName: string;
  defaultValue?: any;
  assignTo?: string; // Имя переменной для присвоения
}

export interface RequestContactActionConfig {
  // Конфигурация для запроса контакта (пока пустая, может быть расширена)
}

export interface SendNotificationActionConfig {
  notificationType: 'email' | 'telegram' | 'webhook';
  recipient: string; // email, telegram id или webhook url
  template?: string;
  templateData?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface CheckUserLinkedActionConfig {
  userIdentifier: string; // telegram id, email или phone
  assignTo: string; // Имя переменной для результата
}

export interface FindUserByContactActionConfig {
  contactType: 'phone' | 'email';
  contactValue: string;
  assignTo: string; // Имя переменной для найденного пользователя
}

export interface LinkTelegramAccountActionConfig {
  telegramId: string;
  contactType: 'phone' | 'email';
  contactValue: string;
}

export interface GetUserBalanceActionConfig {
  userId?: string; // Если не указан, берется из контекста
  assignTo: string; // Имя переменной для баланса
}

// Поток управления
export interface DelayFlowConfig {
  delayMs: number;
  variableDelay?: string; // Имя переменной с задержкой
}

export interface LoopFlowConfig {
  type?: 'count' | 'foreach' | 'while'; // Тип цикла
  iterations: number | string; // Число или имя переменной
  iteratorVariable?: string; // Имя переменной для итератора
  breakCondition?: string; // Условие выхода из цикла
  maxIterations?: number; // Максимальное количество итераций
  count?: number | string; // Количество для count loop
  array?: string; // Имя переменной массива для foreach
  itemVariable?: string; // Имя переменной для элемента в foreach
  indexVariable?: string; // Имя переменной для индекса
  condition?: string; // Условие для while loop
}

export interface SubWorkflowFlowConfig {
  workflowId: string;
  version?: number; // Версия workflow, если не указана - активная
  inputMapping?: Record<string, string>; // Маппинг входных переменных
  outputMapping?: Record<string, string>; // Маппинг выходных переменных
}

export interface JumpFlowConfig {
  targetNodeId: string;
  condition?: string; // Условие для прыжка
}

export interface SwitchCaseConfig {
  value: any;
  label?: string;
}

export interface SwitchFlowConfig {
  variable: string;
  cases: SwitchCaseConfig[];
  hasDefault?: boolean;
}


export interface EndFlowConfig {
  success?: boolean; // Успешное завершение или ошибка
  message?: string; // Сообщение при завершении
}

// Интеграции
export interface WebhookIntegrationConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface AnalyticsIntegrationConfig {
  event: string; // Название события
  properties?: Record<string, any>; // Свойства события
  userId?: string; // ID пользователя для аналитики
}

// ========== СВЯЗИ И WORKFLOW ==========

export interface WorkflowConnection extends ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: WorkflowConnectionType;
  animated?: boolean;
  style?: Record<string, any>;
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isActive: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables?: WorkflowVariable[];
  settings?: WorkflowSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface WorkflowSettings {
  timeout?: number;
  maxRetries?: number;
  errorHandling?: ErrorHandlingConfig;
}

export interface ErrorHandlingConfig {
  action: 'continue' | 'retry' | 'goto_node' | 'stop_workflow';
  gotoNodeId?: string;
  errorMessage?: string;
}

// ========== API ИНТЕРФЕЙСЫ ==========

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnection[];
  variables?: WorkflowVariable[];
  settings?: WorkflowSettings;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnection[];
  variables?: WorkflowVariable[];
  settings?: WorkflowSettings;
  isActive?: boolean;
}

// ========== EXECUTION CONTEXT & HANDLERS ==========

export interface ExecutionContext {
  executionId: string;
  projectId: string;
  workflowId: string;
  version: number;
  sessionId: string;
  userId?: string;
  telegram: TelegramContext;
  variables: VariableManager;
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    debug: (message: string, data?: any) => void;
  };
  services: {
    db: any; // Prisma client
    http: any; // HTTP client
  };
  now: () => Date;
  step: number;
  maxSteps: number;
}

export interface TelegramContext {
  chatId: string;
  userId: string;
  username?: string;
  firstName?: string;
  botToken: string;
  message?: {
    text?: string;
    callbackData?: string;
  };
  contact?: TelegramContact;
}

export interface TelegramContact {
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  vcard?: string;
}

export interface WaitingState {
  nodeId: string;
  reason: 'contact';
  since: Date;
  timeoutMs?: number;
}

export interface VariableManager {
  get: (name: string, scope?: VariableScope) => Promise<any>;
  getSync: (name: string, scope?: VariableScope) => any; // Синхронная версия для выражений
  set: (name: string, value: any, scope?: VariableScope, ttl?: number) => Promise<void>;
  has: (name: string, scope?: VariableScope) => Promise<boolean>;
  delete: (name: string, scope?: VariableScope) => Promise<void>;
  list: (scope?: VariableScope) => Promise<Record<string, any>>;
  cleanupExpired: () => Promise<number>;
}

export type VariableScope = 'global' | 'project' | 'user' | 'session';

export type HandlerResult = string | null;

export interface NodeHandler<TConfig = any> {
  canHandle: (nodeType: WorkflowNodeType) => boolean;
  execute: (node: WorkflowNode, context: ExecutionContext) => Promise<HandlerResult>;
  validate?: (config: TConfig) => Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface NodeHandlerRegistry {
  register: (handler: NodeHandler) => void;
  get: (nodeType: WorkflowNodeType) => NodeHandler | null;
  list: () => NodeHandler[];
}

// Workflow Version согласно плану
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  nodes: Record<string, WorkflowNode>;
  entryNodeId: string;
  connections?: WorkflowConnection[];
  variables?: WorkflowVariable[];
  settings?: WorkflowSettings;
  isActive?: boolean;
  createdAt: Date;
}

// Execution tracking
export interface WorkflowExecution {
  id: string;
  projectId: string;
  workflowId: string;
  version: number;
  sessionId: string;
  userId?: string;
  telegramChatId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
  stepCount?: number;
  currentNodeId?: string;
  waitType?: 'contact';
  waitPayload?: any;
  resumeData?: any;
}

// Execution logs
export interface WorkflowLog {
  id: string;
  executionId: string;
  step: number;
  nodeId: string;
  nodeType: WorkflowNodeType;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}
