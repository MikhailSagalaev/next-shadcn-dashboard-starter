/**
 * @file: src/features/workflow/components/nodes/end-node.tsx
 * @description: Компонент ноды "Завершение" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Flag } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

export const EndNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  return (
    <Card className='w-64 shadow-md border-gray-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Flag className='mr-2 inline-block h-4 w-4 text-gray-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>Завершение</span>
      </CardHeader>
      <Handle 
        type='target' 
        position={Position.Top} 
        className='!bg-gray-500 !w-4 !h-4 !border-2' 
        style={{ width: '14px', height: '14px', border: '2px solid white', borderRadius: '50%' }}
      />
    </Card>
  );
});

EndNode.displayName = 'EndNode';
