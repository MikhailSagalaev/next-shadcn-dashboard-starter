/**
 * @file: src/features/bot-constructor/components/nodes/start-node.tsx
 * @description: Нода начала диалога для конструктора бота
 * @project: SaaS Bonus System
 * @dependencies: React Flow, Lucide icons
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Circle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { BotNode } from '@/types/bot-constructor';

type StartNodeProps = NodeProps<BotNode>;

export function StartNode({ data, selected }: StartNodeProps) {
  return (
    <Card className={`w-48 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        {/* Output handle */}
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-green-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-green-500 p-2'>
            <Circle className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Старт</h3>
              <Badge variant='secondary' className='text-xs'>
                Начало
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Точка входа в диалог
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
