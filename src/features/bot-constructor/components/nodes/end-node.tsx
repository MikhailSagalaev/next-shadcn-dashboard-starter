/**
 * @file: src/features/bot-constructor/components/nodes/end-node.tsx
 * @description: Нода завершения диалога для конструктора бота
 * @project: SaaS Bonus System
 * @dependencies: React Flow, Lucide icons
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Target } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { BotNode } from '@/types/bot-constructor';

type EndNodeProps = NodeProps<BotNode>;

export function EndNode({ data, selected }: EndNodeProps) {
  return (
    <Card className={`w-48 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        {/* Input handle */}
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-red-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-red-500 p-2'>
            <Target className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Конец</h3>
              <Badge variant='destructive' className='text-xs'>
                Завершение
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Завершение диалога
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
