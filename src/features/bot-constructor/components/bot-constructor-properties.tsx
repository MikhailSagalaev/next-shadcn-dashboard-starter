/**
 * @file: src/features/bot-constructor/components/bot-constructor-properties.tsx
 * @description: Панель свойств для редактирования нод конструктора
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 * @created: 2025-09-30
 * @updated: 2026-01-17 (Refactoring: Decomposed components)
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { ConditionProperties } from './properties/condition-properties';

import type { BotNode } from '@/types/bot-constructor';

// Imported decomposed properties
import { StartProperties } from './properties/start-properties';
import { MessageProperties } from './properties/message-properties';
import { CommandProperties } from './properties/command-properties';
import { CallbackProperties } from './properties/callback-properties';
import { InputProperties } from './properties/input-properties';
import { ActionProperties } from './properties/action-properties';
import { MiddlewareProperties } from './properties/middleware-properties';
import { SessionProperties } from './properties/session-properties';
import { EndProperties } from './properties/end-properties';

interface BotConstructorPropertiesProps {
  node: BotNode;
  onNodeUpdate: (updatedNode: BotNode) => void;
  onClose: () => void;
}

export function BotConstructorProperties({
  node,
  onNodeUpdate,
  onClose
}: BotConstructorPropertiesProps) {
  const [localNode, setLocalNode] = useState<BotNode>(node);

  // Update local state
  const updateNode = (updates: Partial<BotNode>) => {
    const updatedNode = { ...localNode, ...updates };
    setLocalNode(updatedNode);
    onNodeUpdate(updatedNode);
  };

  // Update node data
  const updateNodeData = (dataUpdates: any) => {
    updateNode({
      data: {
        ...localNode.data,
        ...dataUpdates
      }
    });
  };

  // Render different property panels based on node type
  const renderProperties = () => {
    switch (node.type) {
      case 'start':
        return (
          <StartProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'message':
        return (
          <MessageProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'command':
        return (
          <CommandProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'callback':
        return (
          <CallbackProperties
            node={localNode}
            updateNodeData={updateNodeData}
          />
        );
      case 'input':
        return (
          <InputProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'condition':
        return (
          <ConditionProperties
            node={localNode}
            updateNodeData={updateNodeData}
          />
        );
      case 'action':
        return (
          <ActionProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'middleware':
        return (
          <MiddlewareProperties
            node={localNode}
            updateNodeData={updateNodeData}
          />
        );
      case 'session':
        return (
          <SessionProperties node={localNode} updateNodeData={updateNodeData} />
        );
      case 'end':
        return (
          <EndProperties node={localNode} updateNodeData={updateNodeData} />
        );
      default:
        return <div>Свойства для этого типа ноды пока не реализованы</div>;
    }
  };

  return (
    <div className='bg-background flex w-80 flex-col border-l'>
      {/* Header */}
      <div className='flex items-center justify-between border-b p-4'>
        <h3 className='text-sm font-semibold'>Свойства ноды</h3>
        <Button variant='ghost' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        <Card>
          <CardHeader className='pb-3'>
            <h4 className='text-sm font-semibold'>{localNode.data.label}</h4>
          </CardHeader>
          <CardContent>{renderProperties()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
