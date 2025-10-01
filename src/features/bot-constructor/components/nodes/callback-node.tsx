import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BotNode } from '@/types/bot-constructor';

type CallbackNodeProps = NodeProps<BotNode>;

export function CallbackNode({ data, selected }: CallbackNodeProps) {
  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-yellow-500'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-yellow-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-yellow-500 p-2'>
            <Zap className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Callback</h3>
              <Badge variant='secondary' className='text-xs'>
                Кнопки
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Обработка нажатий кнопок
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
