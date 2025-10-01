import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BotNode } from '@/types/bot-constructor';

type ConditionNodeProps = NodeProps<BotNode>;

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-orange-500'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          id='true'
          className='h-3 w-3 border-2 border-white bg-green-500'
        />
        <Handle
          type='source'
          position={Position.Right}
          id='false'
          className='h-3 w-3 border-2 border-white bg-red-500'
        />

        <div className='flex items-center space-x-3'>
          <div className='rounded-lg bg-orange-500 p-2'>
            <GitBranch className='h-4 w-4 text-white' />
          </div>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <h3 className='text-sm font-medium'>Условие</h3>
              <Badge variant='secondary' className='text-xs'>
                Логика
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              Условные переходы
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
