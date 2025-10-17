/**
 * @file: src/features/workflow/components/workflow-toolbar.tsx
 * @description: Панель инструментов для добавления нод в конструктор workflow
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, lucide-react
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

'use client';

import React, { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play,
  MessageSquare,
  GitBranchPlus,
  Zap,
  Clock,
  Flag,
  Plus,
  Database,
  Webhook,
  Variable,
  Mail,
  PhoneForwarded
} from 'lucide-react';
import { Panel } from '@xyflow/react';
import type { WorkflowNodeType, Position } from '@/types/workflow';

interface NodeTemplate {
  type: WorkflowNodeType;
  label: string;
  icon: React.ElementType;
  color: string;
}

const nodeTemplates: NodeTemplate[] = [
  // Основные типы для MVP
  { type: 'trigger.command', label: 'Команда', icon: Play, color: '#22C55E' }, // green-500
  { type: 'message', label: 'Сообщение', icon: MessageSquare, color: '#3B82F6' }, // blue-500
  { type: 'condition', label: 'Условие', icon: GitBranchPlus, color: '#F59E0B' }, // amber-500
  { type: 'action.database_query', label: 'База данных', icon: Database, color: '#8B5CF6' }, // violet-500
  { type: 'action.set_variable', label: 'Переменная', icon: Variable, color: '#EC4899' }, // pink-500
  { type: 'action.send_notification', label: 'Уведомление', icon: Mail, color: '#F97316' }, // orange-500
  { type: 'flow.delay', label: 'Задержка', icon: Clock, color: '#EAB308' }, // yellow-500
  { type: 'flow.end', label: 'Завершение', icon: Flag, color: '#6B7280' } // gray-500
];

interface WorkflowToolbarProps {
  onAddNode: (nodeType: WorkflowNodeType, position: Position) => void;
}

export function WorkflowToolbar({ onAddNode }: WorkflowToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (event: React.DragEvent, nodeType: WorkflowNodeType) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleAddNodeClick = useCallback(
    (nodeType: WorkflowNodeType) => {
      // Добавляем ноду в случайную позицию
      onAddNode(nodeType, { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 });
    },
    [onAddNode]
  );

  return (
    <TooltipProvider>
      <div
        ref={toolbarRef}
        className='flex flex-col gap-2 rounded-md border bg-background p-2 shadow-lg'
      >
          {nodeTemplates.map((template) => (
            <Tooltip key={template.type}>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  draggable
                  onDragStart={(event) => handleDragStart(event, template.type)}
                  onClick={() => handleAddNodeClick(template.type)}
                  className='h-9 w-9'
                  style={{ color: template.color, borderColor: template.color + '80' }}
                >
                  <template.icon className='h-5 w-5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent side='right'>
                <p>{template.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
    </TooltipProvider>
  );
}
