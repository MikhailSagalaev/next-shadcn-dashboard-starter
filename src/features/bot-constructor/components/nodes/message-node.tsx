/**
 * @file: src/features/bot-constructor/components/nodes/message-node.tsx
 * @description: Нода отправки сообщения для конструктора бота
 * @project: SaaS Bonus System
 * @dependencies: React Flow, Lucide icons
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Keyboard, Paperclip } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { BotNode } from '@/types/bot-constructor';

type MessageNodeProps = NodeProps<BotNode>;

export function MessageNode({ data, selected }: MessageNodeProps) {
  const config = data.config.message;
  const hasKeyboard = config?.keyboard && config.keyboard.buttons.length > 0;
  const hasAttachments = config?.attachments && config.attachments.length > 0;

  return (
    <Card className={`w-64 ${selected ? 'ring-primary ring-2' : ''}`}>
      <CardContent className='p-3'>
        {/* Input handle */}
        <Handle
          type='target'
          position={Position.Top}
          className='h-3 w-3 border-2 border-white bg-blue-500'
        />

        {/* Output handle */}
        <Handle
          type='source'
          position={Position.Bottom}
          className='h-3 w-3 border-2 border-white bg-blue-500'
        />

        <div className='space-y-3'>
          {/* Header */}
          <div className='flex items-center space-x-3'>
            <div className='rounded-lg bg-blue-500 p-2'>
              <MessageSquare className='h-4 w-4 text-white' />
            </div>

            <div className='flex-1'>
              <div className='flex items-center space-x-2'>
                <h3 className='text-sm font-medium'>Сообщение</h3>
                <Badge variant='secondary' className='text-xs'>
                  Отправка
                </Badge>
              </div>
            </div>
          </div>

          {/* Message preview */}
          <div className='bg-muted min-h-[40px] rounded-lg p-2'>
            <p className='text-muted-foreground line-clamp-2 text-xs'>
              {config?.text || 'Текст сообщения...'}
            </p>
          </div>

          {/* Features */}
          <div className='flex items-center space-x-2'>
            {hasKeyboard && (
              <div className='text-muted-foreground flex items-center space-x-1 text-xs'>
                <Keyboard className='h-3 w-3' />
                <span>Кнопки</span>
              </div>
            )}

            {hasAttachments && (
              <div className='text-muted-foreground flex items-center space-x-1 text-xs'>
                <Paperclip className='h-3 w-3' />
                <span>Вложения</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
