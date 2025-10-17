/**
 * @file: src/features/workflow/components/nodes/action-node.tsx
 * @description: Компонент ноды "Действие" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

export const ActionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const actionType = nodeData.config['action.database_query']?.query ? 'database_query' :
                     nodeData.config['action.set_variable']?.variableName ? 'set_variable' : 'Неизвестно';
  const actionDescription = 'Нажмите для редактирования';
  
  const getActionDisplayText = () => {
    switch (actionType) {
      case 'database_query':
        return 'Запрос к базе данных';
      case 'set_variable':
        return `Переменная: ${nodeData.config['action.set_variable']?.variableName || ''}`;
      default:
        return actionDescription;
    }
  };

  return (
    <Card className='w-64 shadow-md border-purple-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Zap className='mr-2 inline-block h-4 w-4 text-purple-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>{actionType}</span>
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground line-clamp-2'>{getActionDisplayText()}</p>
      </CardContent>
      <Handle type='target' position={Position.Top} className='!bg-purple-500' />
      <Handle type='source' position={Position.Bottom} className='!bg-purple-500' />
    </Card>
  );
});

ActionNode.displayName = 'ActionNode';
