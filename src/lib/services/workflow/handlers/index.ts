/**
 * @file: src/lib/services/workflow/handlers/index.ts
 * @description: Экспорт всех обработчиков нод и функция инициализации
 * @project: SaaS Bonus System
 * @dependencies: Node handlers, Registry
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import { nodeHandlersRegistry } from '../node-handlers-registry';

// Import handlers
import {
  CommandTriggerHandler,
  MessageTriggerHandler,
  CallbackTriggerHandler
} from './trigger-handlers';

import { MessageHandler } from './message-handler';

import {
  DatabaseQueryHandler,
  SetVariableHandler,
  GetVariableHandler
} from './action-handlers';

import { ConditionHandler } from './condition-handler';

import {
  DelayFlowHandler,
  EndFlowHandler,
  LoopFlowHandler,
  SubWorkflowFlowHandler,
  JumpFlowHandler
} from './flow-handlers';

import {
  InlineKeyboardHandler,
  ReplyKeyboardHandler
} from './keyboard-handler';

import {
  PhotoMessageHandler,
  VideoMessageHandler,
  DocumentMessageHandler,
  EditMessageHandler,
  DeleteMessageHandler
} from './media-handler';

import { SwitchHandler } from './switch-handler';

/**
 * Инициализирует и регистрирует все обработчики нод
 */
export function initializeNodeHandlers(): void {
  // Trigger handlers
  nodeHandlersRegistry.register(new CommandTriggerHandler());
  nodeHandlersRegistry.register(new MessageTriggerHandler());
  nodeHandlersRegistry.register(new CallbackTriggerHandler());

  // Message handlers
  nodeHandlersRegistry.register(new MessageHandler());
  nodeHandlersRegistry.register(new InlineKeyboardHandler());
  nodeHandlersRegistry.register(new ReplyKeyboardHandler());
  nodeHandlersRegistry.register(new PhotoMessageHandler());
  nodeHandlersRegistry.register(new VideoMessageHandler());
  nodeHandlersRegistry.register(new DocumentMessageHandler());
  nodeHandlersRegistry.register(new EditMessageHandler());
  nodeHandlersRegistry.register(new DeleteMessageHandler());

  // Action handlers
  nodeHandlersRegistry.register(new DatabaseQueryHandler());
  nodeHandlersRegistry.register(new SetVariableHandler());
  nodeHandlersRegistry.register(new GetVariableHandler());

  // Condition handlers
  nodeHandlersRegistry.register(new ConditionHandler());
  nodeHandlersRegistry.register(new SwitchHandler());

  // Flow handlers
  nodeHandlersRegistry.register(new DelayFlowHandler());
  nodeHandlersRegistry.register(new EndFlowHandler());
  nodeHandlersRegistry.register(new LoopFlowHandler());
  nodeHandlersRegistry.register(new SubWorkflowFlowHandler());
  nodeHandlersRegistry.register(new JumpFlowHandler());

  console.log('✅ All node handlers initialized and registered');
}

// Export handlers for direct use if needed
export {
  CommandTriggerHandler,
  MessageTriggerHandler,
  CallbackTriggerHandler,
  MessageHandler,
  DatabaseQueryHandler,
  SetVariableHandler,
  GetVariableHandler,
  ConditionHandler,
  DelayFlowHandler,
  EndFlowHandler,
  LoopFlowHandler,
  SubWorkflowFlowHandler,
  JumpFlowHandler
};
