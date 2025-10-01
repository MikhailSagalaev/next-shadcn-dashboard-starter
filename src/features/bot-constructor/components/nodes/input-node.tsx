/**
 * @file: src/features/bot-constructor/components/nodes/input-node.tsx
 * @description: Нода ввода данных для конструктора бота
 * @project: SaaS Bonus System
 * @dependencies: React Flow, Lucide icons
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Eye } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { BotNode } from '@/types/bot-constructor';

type InputNodeProps = NodeProps<BotNode>;

export function InputNode({ data, selected }: InputNodeProps) {
  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-purple-500'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-purple-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-purple-500 p-2'>
            <Eye className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Ввод данных</h3>
              <Badge variant='secondary' className='text-xs'>
                Ввод
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Ожидание ввода от пользователя
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
