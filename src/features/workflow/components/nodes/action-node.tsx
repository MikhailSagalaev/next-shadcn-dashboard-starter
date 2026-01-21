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
  const config = nodeData.config || {};
  const actionType = config['action.database_query']?.query
    ? 'database_query'
    : config['action.set_variable']?.variableName
      ? 'set_variable'
      : 'Неизвестно';
  const actionDescription = 'Нажмите для редактирования';

  const getActionDisplayText = () => {
    switch (actionType) {
      case 'database_query':
        return 'Запрос к базе данных';
      case 'set_variable':
        return `Переменная: ${config['action.set_variable']?.variableName || ''}`;
      default:
        return actionDescription;
    }
  };

  return (
    <Card className='w-64 border-purple-500 shadow-md'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Zap className='mr-2 inline-block h-4 w-4 text-purple-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-muted-foreground text-xs'>{actionType}</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-muted-foreground line-clamp-2 text-sm'>
          {getActionDisplayText()}
        </p>
      </CardContent>
      <Handle
        type='target'
        position={Position.Top}
        className='!h-4 !w-4 !border-2 !bg-purple-500'
        style={{
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />
      <Handle
        type='source'
        position={Position.Bottom}
        className='!h-4 !w-4 !border-2 !bg-purple-500'
        style={{
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />
    </Card>
  );
});

ActionNode.displayName = 'ActionNode';
