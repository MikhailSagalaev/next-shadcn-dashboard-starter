/**
 * @file: src/features/bot-constructor/components/bot-constructor-toolbar.tsx
 * @description: Панель инструментов с перетаскиваемыми нодами
 * @project: SaaS Bonus System
 * @dependencies: React, Lucide icons
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import {
  Circle,
  MessageSquare,
  Zap,
  GitBranch,
  Settings,
  Database,
  Eye,
  ArrowRight,
  Target
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import type { NodeType, Position } from '@/types/bot-constructor';

interface BotConstructorToolbarProps {
  onAddNode: (nodeType: NodeType, position: Position) => void;
  canvasRef?: React.RefObject<HTMLDivElement>;
}

interface NodeTemplate {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'flow' | 'logic' | 'action' | 'data' | 'ui';
  color: string;
}

const nodeTemplates: NodeTemplate[] = [
  // Flow Control
  {
    type: 'start',
    label: 'Старт',
    description: 'Точка входа в диалог',
    icon: Circle,
    category: 'flow',
    color: 'bg-green-500'
  },
  {
    type: 'end',
    label: 'Конец',
    description: 'Завершение диалога',
    icon: Target,
    category: 'flow',
    color: 'bg-red-500'
  },

  // Messages & Input
  {
    type: 'message',
    label: 'Сообщение',
    description: 'Отправка текстового сообщения',
    icon: MessageSquare,
    category: 'ui',
    color: 'bg-blue-500'
  },
  {
    type: 'input',
    label: 'Ввод данных',
    description: 'Ожидание ввода от пользователя',
    icon: Eye,
    category: 'ui',
    color: 'bg-purple-500'
  },

  // Commands & Callbacks
  {
    type: 'command',
    label: 'Команда',
    description: 'Обработка команд типа /start',
    icon: Target,
    category: 'ui',
    color: 'bg-indigo-500'
  },
  {
    type: 'callback',
    label: 'Callback',
    description: 'Обработка нажатий кнопок',
    icon: Zap,
    category: 'ui',
    color: 'bg-yellow-500'
  },

  // Logic
  {
    type: 'condition',
    label: 'Условие',
    description: 'Условные переходы с ветвлением',
    icon: GitBranch,
    category: 'logic',
    color: 'bg-orange-500'
  },

  // Actions
  {
    type: 'action',
    label: 'Действие',
    description: 'API вызовы и операции',
    icon: Zap,
    category: 'action',
    color: 'bg-cyan-500'
  },

  // Data & Settings
  {
    type: 'middleware',
    label: 'Middleware',
    description: 'Перехват и модификация запросов',
    icon: Settings,
    category: 'logic',
    color: 'bg-gray-500'
  },
  {
    type: 'session',
    label: 'Сессия',
    description: 'Работа с переменными сессии',
    icon: Database,
    category: 'data',
    color: 'bg-teal-500'
  }
];

const categories = [
  { id: 'flow', label: 'Поток', color: 'border-green-200' },
  { id: 'ui', label: 'Интерфейс', color: 'border-blue-200' },
  { id: 'logic', label: 'Логика', color: 'border-orange-200' },
  { id: 'action', label: 'Действия', color: 'border-cyan-200' },
  { id: 'data', label: 'Данные', color: 'border-teal-200' }
];

export function BotConstructorToolbar({
  onAddNode,
  canvasRef
}: BotConstructorToolbarProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('flow');
  const [draggedNode, setDraggedNode] = useState<NodeTemplate | null>(null);

  const filteredTemplates = nodeTemplates.filter(
    (template) => template.category === selectedCategory
  );

  // Handle drag start
  const handleDragStart = (template: NodeTemplate) => {
    setDraggedNode(template);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  // Handle node click (add to center of canvas)
  const handleNodeClick = (template: NodeTemplate) => {
    // Default position in center of visible area
    const defaultPosition: Position = { x: 300, y: 200 };
    onAddNode(template.type, defaultPosition);
  };

  return (
    <TooltipProvider>
      <div className='bg-background flex w-80 flex-col border-r'>
        {/* Header */}
        <div className='border-b p-4'>
          <h3 className='text-sm font-semibold'>Панель инструментов</h3>
          <p className='text-muted-foreground mt-1 text-xs'>
            Перетащите элементы на холст
          </p>
        </div>

        {/* Categories */}
        <div className='border-b p-4'>
          <div className='flex flex-wrap gap-2'>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={
                  selectedCategory === category.id ? 'default' : 'outline'
                }
                size='sm'
                onClick={() => setSelectedCategory(category.id)}
                className='text-xs'
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Node Templates */}
        <div className='flex-1 space-y-3 overflow-y-auto p-4'>
          {filteredTemplates.map((template) => {
            const Icon = template.icon;

            return (
              <Tooltip key={template.type}>
                <TooltipTrigger asChild>
                  <Card
                    className='hover:border-primary/50 cursor-pointer border-2 transition-shadow hover:shadow-md'
                    draggable
                    onDragStart={() => handleDragStart(template)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleNodeClick(template)}
                  >
                    <CardContent className='p-3'>
                      <div className='flex items-center space-x-3'>
                        <div className={`rounded-lg p-2 ${template.color}`}>
                          <Icon className='h-4 w-4 text-white' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h4 className='truncate text-sm font-medium'>
                            {template.label}
                          </h4>
                          <p className='text-muted-foreground truncate text-xs'>
                            {template.description}
                          </p>
                        </div>
                        <ArrowRight className='text-muted-foreground h-4 w-4' />
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side='right'>
                  <div className='max-w-xs'>
                    <p className='font-medium'>{template.label}</p>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {template.description}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Footer */}
        <div className='border-t p-4'>
          <div className='text-muted-foreground text-xs'>
            <p>💡 Подсказка:</p>
            <p className='mt-1'>
              Перетащите ноду на холст и настройте её свойства в панели справа
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
