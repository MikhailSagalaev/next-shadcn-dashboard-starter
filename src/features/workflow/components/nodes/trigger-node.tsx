/**
 * @file: src/features/workflow/components/nodes/trigger-node.tsx
 * @description: Компонент ноды "Триггер" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

export const TriggerNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const triggerType = nodeData.type;
  const triggerValue = nodeData.config['trigger.command']?.command ||
                       nodeData.config['trigger.message']?.pattern ||
                       nodeData.config['trigger.callback']?.callbackData ||
                       'Нажмите для редактирования';
  
  const getTriggerDisplayText = () => {
    switch (triggerType) {
      case 'trigger.command':
        return `Команда: ${triggerValue}`;
      case 'trigger.message':
        return `Сообщение: ${triggerValue}`;
      case 'trigger.email':
        return 'Получение email';
      case 'trigger.callback':
        return `Callback: ${triggerValue}`;
      case 'trigger.webhook':
        return `Webhook: ${triggerValue}`;
      default:
        return `${triggerType}: ${triggerValue}`;
    }
  };

  return (
    <Card className='w-64 shadow-md border-green-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Play className='mr-2 inline-block h-4 w-4 text-green-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>Триггер</span>
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground line-clamp-2'>
          {getTriggerDisplayText()}
        </p>
      </CardContent>
      <Handle type='source' position={Position.Bottom} className='!bg-green-500' />
    </Card>
  );
});

TriggerNode.displayName = 'TriggerNode';
