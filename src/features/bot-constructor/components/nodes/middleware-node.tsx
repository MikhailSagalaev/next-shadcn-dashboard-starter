import { Handle, Position, NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BotNode } from '@/types/bot-constructor';

type MiddlewareNodeProps = NodeProps<BotNode>;

export function MiddlewareNode({ data, selected }: MiddlewareNodeProps) {
  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-gray-500'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-gray-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-gray-500 p-2'>
            <Settings className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Middleware</h3>
              <Badge variant='secondary' className='text-xs'>
                Логика
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Перехват и модификация запросов
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
