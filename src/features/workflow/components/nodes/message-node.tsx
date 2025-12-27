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
import type { WorkflowNodeData } from '@/types/workflow';

export const MessageNode = memo(({ data }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const messageText = nodeData.config.message?.text || '';

  // Удаляем HTML теги для превью
  const plainText = messageText.replace(/<[^>]*>/g, '');

  return (
    <Card className='w-80 border-blue-500 shadow-md'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          <MessageSquare className='mr-2 inline-block h-4 w-4 text-blue-500' />
          {nodeData.label}
        </CardTitle>
        <span className='text-muted-foreground text-xs'>Сообщение</span>
      </CardHeader>
      <CardContent className='space-y-2'>
        {/* Превью сообщения */}
        <div className='text-muted-foreground bg-muted rounded border p-2 text-sm'>
          {plainText ? (
            <div className='line-clamp-3'>
              {plainText.replace(/\{[^}]+\}/g, '🔗')}
            </div>
          ) : (
            'Нажмите для редактирования'
          )}
        </div>

        {/* Счетчик переменных и символов */}
        {plainText && (
          <div className='flex items-center gap-2 text-xs text-blue-600'>
            <span>{plainText.length} символов</span>
            <span>•</span>
            <span>
              {(messageText.match(/\{[^}]+\}/g) || []).length} переменных
            </span>
          </div>
        )}
      </CardContent>
      <Handle
        type='target'
        position={Position.Top}
        className='!h-4 !w-4 !border-2 !bg-blue-500'
        style={{
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />
      <Handle
        type='source'
        position={Position.Bottom}
        className='!h-4 !w-4 !border-2 !bg-blue-500'
        style={{
          width: '14px',
          height: '14px',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />
    </Card>
  );
});

MessageNode.displayName = 'MessageNode';
