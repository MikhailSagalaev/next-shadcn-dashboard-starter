/**
 * @file: src/features/workflow/components/nodes/condition-node.tsx
 * @description: Компонент ноды "Условие" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GitBranchPlus } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

export const ConditionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const condition = nodeData.config.condition;
  const conditionText = condition
    ? `${condition.variable} ${condition.operator} ${condition.value}`
    : 'Нажмите для редактирования';

  return (
    <Card className='w-64 shadow-md border-orange-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <GitBranchPlus className='mr-2 inline-block h-4 w-4 text-orange-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>Условие</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-sm text-muted-foreground line-clamp-2'>{conditionText}</p>
      </CardContent>
      <Handle type='target' position={Position.Top} className='!bg-orange-500' />
      <Handle
        type='source'
        position={Position.Bottom}
        id='true'
        className='!bg-green-500 !bottom-1 !left-1/4'
        style={{ left: '25%' }}
      >
        <div className='absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-green-700'>
          True
        </div>
      </Handle>
      <Handle
        type='source'
        position={Position.Bottom}
        id='false'
        className='!bg-red-500 !bottom-1 !right-1/4'
        style={{ right: '25%' }}
      >
        <div className='absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-red-700'>
          False
        </div>
      </Handle>
    </Card>
  );
});

ConditionNode.displayName = 'ConditionNode';
