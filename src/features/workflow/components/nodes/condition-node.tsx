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
import { formatConditionOperator } from '@/features/workflow/lib/condition-operator-labels';
import type { WorkflowNodeData } from '@/types/workflow';

export const ConditionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const condition = nodeData.config.condition;
  const conditionText = (() => {
    if (!condition) return 'Нажмите для редактирования';
    if (condition.expression) return condition.expression;
    if (condition.variable) {
      return `${condition.variable} ${formatConditionOperator(condition.operator)} ${condition.value ?? ''}`.trim();
    }
    return 'Нажмите для редактирования';
  })();

  return (
    <Card className='w-64 border-orange-500 shadow-md'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <GitBranchPlus className='mr-2 inline-block h-4 w-4 text-orange-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-muted-foreground text-xs'>Условие</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-muted-foreground line-clamp-2 text-sm'>
          {conditionText}
        </p>
      </CardContent>
      <Handle
        type='target'
        position={Position.Top}
        className='!h-4 !w-4 !border-2 !bg-orange-500'
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
        id='true'
        className='!bottom-1 !left-1/4 !h-4 !w-4 !border-2 !bg-green-500'
        style={{
          left: '25%',
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      >
        <div className='absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-green-700'>
          True
        </div>
      </Handle>
      <Handle
        type='source'
        position={Position.Bottom}
        id='false'
        className='!right-1/4 !bottom-1 !h-4 !w-4 !border-2 !bg-red-500'
        style={{
          right: '25%',
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      >
        <div className='absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-red-700'>
          False
        </div>
      </Handle>
    </Card>
  );
});

ConditionNode.displayName = 'ConditionNode';
