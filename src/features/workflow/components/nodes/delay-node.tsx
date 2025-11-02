/**
 * @file: src/features/workflow/components/nodes/delay-node.tsx
 * @description: Компонент ноды "Задержка" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

export const DelayNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const delayMs = nodeData.config['flow.delay']?.delayMs || 0;
  const delayText = delayMs ? `${delayMs / 1000} сек.` : 'Нажмите для редактирования';

  return (
    <Card className='w-64 shadow-md border-yellow-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <Clock className='mr-2 inline-block h-4 w-4 text-yellow-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>Задержка</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-sm text-muted-foreground'>{delayText}</p>
      </CardContent>
      <Handle 
        type='target' 
        position={Position.Top} 
        className='!bg-yellow-500 !w-4 !h-4 !border-2' 
        style={{ width: '14px', height: '14px', border: '2px solid white', borderRadius: '50%' }}
      />
      <Handle 
        type='source' 
        position={Position.Bottom} 
        className='!bg-yellow-500 !w-4 !h-4 !border-2' 
        style={{ width: '14px', height: '14px', border: '2px solid white', borderRadius: '50%' }}
      />
    </Card>
  );
});

DelayNode.displayName = 'DelayNode';
