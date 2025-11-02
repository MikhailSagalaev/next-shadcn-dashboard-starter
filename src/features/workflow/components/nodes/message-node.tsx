/**
 * @file: src/features/workflow/components/nodes/message-node.tsx
 * @description: Компонент ноды "Сообщение" для конструктора workflow
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { MessageEditor } from '@/components/ui/message-editor';
import type { WorkflowNodeData } from '@/types/workflow';

export const MessageNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const messageText = nodeData.config.message?.text || '';
  
  return (
    <Card className='w-80 shadow-md border-blue-500'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <MessageSquare className='mr-2 inline-block h-4 w-4 text-blue-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-xs text-muted-foreground'>Сообщение</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        {/* Превью сообщения */}
        <div className='text-sm text-muted-foreground bg-gray-50 p-2 rounded border'>
          {messageText ? (
            <div className='line-clamp-3'>
              {messageText.replace(/\{[^}]+\}/g, '🔗 Переменная')}
            </div>
          ) : (
            'Нажмите для редактирования'
          )}
        </div>
        
        {/* Счетчик переменных */}
        {messageText && (
          <div className='text-xs text-blue-600 flex items-center gap-2'>
            <span>Переменных: {(messageText.match(/\{[^}]+\}/g) || []).length}</span>
            {messageText.includes('{') && !messageText.includes('}') && (
              <span className='text-orange-500'>⚠️ Незакрытые</span>
            )}
          </div>
        )}
      </CardContent>
      <Handle 
        type='target' 
        position={Position.Top} 
        className='!bg-blue-500 !w-4 !h-4 !border-2' 
        style={{ width: '14px', height: '14px', border: '2px solid white', borderRadius: '50%' }}
      />
      <Handle 
        type='source' 
        position={Position.Bottom} 
        className='!bg-blue-500 !w-4 !h-4 !border-2' 
        style={{ width: '14px', height: '14px', border: '2px solid white', borderRadius: '50%' }}
      />
    </Card>
  );
});

MessageNode.displayName = 'MessageNode';
