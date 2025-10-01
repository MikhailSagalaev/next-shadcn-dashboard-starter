/**
 * @file: src/features/bot-constructor/components/nodes/node-types.tsx
 * @description: Типы нод для React Flow конструктора
 * @project: SaaS Bonus System
 * @dependencies: React Flow, Node components
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import type { NodeTypes } from '@xyflow/react';

// Import node components
import { StartNode } from './start-node';
import { EndNode } from './end-node';
import { MessageNode } from './message-node';
import { InputNode } from './input-node';
import { CommandNode } from './command-node';
import { CallbackNode } from './callback-node';
import { ConditionNode } from './condition-node';
import { ActionNode } from './action-node';
import { MiddlewareNode } from './middleware-node';
import { SessionNode } from './session-node';

// Define node types mapping
export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  message: MessageNode,
  input: InputNode,
  command: CommandNode,
  callback: CallbackNode,
  condition: ConditionNode,
  action: ActionNode,
  middleware: MiddlewareNode,
  session: SessionNode
};
