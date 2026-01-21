import { Handle, Position, NodeProps } from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BotNode } from '@/types/bot-constructor';

type ActionNodeProps = NodeProps<BotNode>;

export function ActionNode({ data, selected }: ActionNodeProps) {
  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-pink-500'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-pink-500'
        />
        {/* Error Handle for API failures */}
        <Handle
          type='source'
          position={Position.Right}
          id='error'
          className='h-3 w-3 border-2 border-white bg-red-700'
          title='Ошибка выполнения'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-pink-500 p-2'>
            <Workflow className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Действие</h3>
              <Badge
                variant='outline'
                className='border-pink-200 text-xs text-pink-700'
              >
                API / DB
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              API, БД, Переменные
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
